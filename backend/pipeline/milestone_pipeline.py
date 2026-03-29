"""
ClearFund Milestone Pipeline
Wires Gemini agent -> Oracle -> Executor in sequence.
Called as a FastAPI BackgroundTask after evidence submission.
"""

import os
from datetime import datetime, timezone
from typing import Optional as _Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from agents.verification_agent import run_verification_agent
from oracle.decision_oracle import DecisionOracle, OracleVerdict
from executor.escrow_executor import EscrowExecutor
from realtime.broker import manager

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "clearfund")
SLASH_PERCENT = max(0.0, min(100.0, float(os.getenv("MILESTONE_SLASH_PERCENT", "10"))))
MAX_SLASH_EVENTS_BEFORE_FREEZE = 2

_client: _Optional[AsyncIOMotorClient] = None


def _get_db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            MONGO_URL,
            tls=True,
            tlsAllowInvalidCertificates=False,
            serverSelectionTimeoutMS=30000,
        )
    return _client[DB_NAME]


def _serialize(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def _round_sol(value: float) -> float:
    return round(float(value or 0.0), 9)


def _is_approved_status(status_value: str) -> bool:
    return status_value in ("approved", "released")


async def _sync_campaign_milestone(
    db,
    *,
    campaign_id: str,
    milestone_id: str,
    update_fields: dict,
) -> None:
    if not ObjectId.is_valid(campaign_id):
        return
    set_payload = {f"milestones.$[m].{k}": v for k, v in update_fields.items()}
    if not set_payload:
        return
    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": set_payload},
        array_filters=[{"m.milestone_id": milestone_id}],
    )


async def _find_next_milestone(db, campaign_id: str, current_milestone: dict):
    current_order = current_milestone.get("order_index")
    if current_order is not None:
        return await db.milestones.find_one(
            {"campaign_id": campaign_id, "order_index": {"$gt": current_order}},
            sort=[("order_index", 1), ("created_at", 1)],
        )

    # Legacy fallback for milestones created before order_index existed.
    return await db.milestones.find_one(
        {
            "campaign_id": campaign_id,
            "_id": {"$ne": current_milestone.get("_id")},
            "created_at": {"$gt": current_milestone.get("created_at")},
        },
        sort=[("created_at", 1)],
    )


async def _audit(db, milestone_id: str, campaign_id: str, event_type: str, payload: dict) -> None:
    """Write to audit log and broadcast over WebSocket."""
    now = datetime.now(timezone.utc)
    await db.agent_audit_logs.insert_one(
        {
            "milestone_id": milestone_id,
            "campaign_id": campaign_id,
            "event_type": event_type,
            "payload": payload,
            "created_at": now,
        }
    )
    await manager.emit(milestone_id, event_type, payload)


async def process_milestone_submission(milestone_id: str) -> None:
    db = _get_db()

    if not ObjectId.is_valid(milestone_id):
        print(f"[Pipeline] Invalid milestone id {milestone_id}")
        return

    milestone_doc = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
    if not milestone_doc:
        print(f"[Pipeline] Milestone {milestone_id} not found.")
        return

    campaign_id = str(milestone_doc.get("campaign_id") or "")
    if not ObjectId.is_valid(campaign_id):
        print(f"[Pipeline] Invalid campaign_id on milestone {milestone_id}")
        return

    campaign_doc = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign_doc:
        print(f"[Pipeline] Campaign {campaign_id} not found.")
        return

    milestone = _serialize(dict(milestone_doc))
    campaign = _serialize(dict(campaign_doc))

    await db.milestones.update_one(
        {"_id": ObjectId(milestone_id)},
        {"$set": {"status": "processing"}},
    )
    await _sync_campaign_milestone(
        db,
        campaign_id=campaign_id,
        milestone_id=milestone_id,
        update_fields={"status": "submitted"},
    )

    try:
        print(f"[Pipeline] Running verification agent for milestone {milestone_id}")
        ai_decision = await run_verification_agent(milestone, campaign)

        await db.milestones.update_one(
            {"_id": ObjectId(milestone_id)},
            {"$set": {"ai_decision": ai_decision}},
        )
        await _audit(
            db,
            milestone_id,
            campaign_id,
            "agent_decision",
            {
                "confidence_score": ai_decision.get("confidence_score"),
                "recommendation": ai_decision.get("recommendation"),
                "reasoning": ai_decision.get("reasoning"),
                "red_flags": ai_decision.get("red_flags", []),
            },
        )

        print(f"[Pipeline] Running oracle for milestone {milestone_id}")
        last_released_milestone = await db.milestones.find_one(
            {"campaign_id": campaign_id, "status": "released"},
            sort=[("created_at", -1)],
        )
        last_release_at = last_released_milestone.get("released_at") if last_released_milestone else None

        milestone_doc = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
        milestone = _serialize(dict(milestone_doc))
        milestone["status"] = "submitted"

        oracle_result = DecisionOracle.evaluate(
            ai_decision=ai_decision,
            milestone=milestone,
            campaign=campaign,
            last_release_at=last_release_at,
        )

        await db.milestones.update_one(
            {"_id": ObjectId(milestone_id)},
            {"$set": {"oracle_result": oracle_result.to_dict()}},
        )
        await _audit(
            db,
            milestone_id,
            campaign_id,
            "oracle_result",
            {
                "verdict": oracle_result.verdict.value,
                "reason": oracle_result.reason,
                "checks_passed": oracle_result.checks_passed,
                "checks_failed": oracle_result.checks_failed,
            },
        )

        print(f"[Pipeline] Oracle verdict: {oracle_result.verdict} - {oracle_result.reason}")

        if oracle_result.verdict in (OracleVerdict.BLOCKED, OracleVerdict.REJECTED):
            rejected_at = datetime.now(timezone.utc)
            await db.milestones.update_one(
                {"_id": ObjectId(milestone_id)},
                {"$set": {"status": "rejected", "rejected_at": rejected_at}},
            )
            await _sync_campaign_milestone(
                db,
                campaign_id=campaign_id,
                milestone_id=milestone_id,
                update_fields={
                    "status": "rejected",
                    "rejected_at": rejected_at,
                    "oracle_result": oracle_result.to_dict(),
                },
            )

            next_milestone_doc = await _find_next_milestone(db, campaign_id, milestone_doc)
            slash_event = {
                "milestone_id": milestone_id,
                "reason": oracle_result.reason,
                "percentage_slashed": SLASH_PERCENT,
                "timestamp": rejected_at,
                "next_milestone_id": None,
                "slashed_amount_sol": 0.0,
            }

            if next_milestone_doc and not _is_approved_status(str(next_milestone_doc.get("status", "pending"))):
                next_milestone_id = str(next_milestone_doc["_id"])
                current_amount = _round_sol(next_milestone_doc.get("amount_sol", 0.0))
                slashed_amount_sol = _round_sol(current_amount * (SLASH_PERCENT / 100.0))
                new_next_amount = max(0.0, _round_sol(current_amount - slashed_amount_sol))

                slash_event["next_milestone_id"] = next_milestone_id
                slash_event["slashed_amount_sol"] = slashed_amount_sol

                if slashed_amount_sol > 0 and new_next_amount < current_amount:
                    await db.milestones.update_one(
                        {"_id": next_milestone_doc["_id"]},
                        {"$set": {"amount_sol": new_next_amount, "slashed_by_milestone_id": milestone_id}},
                    )
                    await _sync_campaign_milestone(
                        db,
                        campaign_id=campaign_id,
                        milestone_id=next_milestone_id,
                        update_fields={
                            "amount_sol": new_next_amount,
                            "last_slashed_at": rejected_at,
                            "last_slash_source_milestone_id": milestone_id,
                        },
                    )

            new_failure_count = int(campaign.get("failure_count", 0) or 0) + 1
            await db.campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {"$inc": {"failure_count": 1}, "$push": {"slash_history": slash_event}},
            )
            await _audit(
                db,
                milestone_id,
                campaign_id,
                "milestone_rejected",
                {
                    "reason": oracle_result.reason,
                    "failure_count": new_failure_count,
                    "slash_event": slash_event,
                },
            )
            await _audit(db, milestone_id, campaign_id, "slash_applied", slash_event)

            campaign_after_slash = await db.campaigns.find_one({"_id": ObjectId(campaign_id)}, {"slash_history": 1})
            slash_history = (campaign_after_slash or {}).get("slash_history") or []
            slash_count = len(slash_history)

            if slash_count > MAX_SLASH_EVENTS_BEFORE_FREEZE:
                print(f"[Pipeline] Campaign {campaign_id} frozen after {slash_count} slash events. Triggering refunds.")
                await db.campaigns.update_one(
                    {"_id": ObjectId(campaign_id)},
                    {"$set": {"status": "frozen", "frozen_at": rejected_at}},
                )

                donations = []
                async for d in db.donations.find({"campaign_id": campaign_id}):
                    donations.append(d)

                total_refunded = 0.0
                if donations:
                    executor = EscrowExecutor()
                    refunds = await executor.refund_donors(campaign, donations)

                    for refund in refunds:
                        total_refunded += refund["amount_sol"]
                        await db.donations.update_one(
                            {"donor_id": refund["donor_id"], "campaign_id": campaign_id},
                            {
                                "$set": {"locked_sol": 0},
                                "$inc": {"refunded_sol": refund["amount_sol"]},
                            },
                        )

                    await _audit(
                        db,
                        milestone_id,
                        campaign_id,
                        "campaign_frozen",
                        {
                            "campaign_id": campaign_id,
                            "slash_event_count": slash_count,
                            "total_refunded_sol": total_refunded,
                        },
                    )
            return

        print(f"[Pipeline] Approved. Executing release for milestone {milestone_id}")
        donations = []
        async for d in db.donations.find({"campaign_id": campaign_id}):
            donations.append(d)

        executor = EscrowExecutor()
        release = await executor.release_milestone(
            campaign=campaign,
            milestone=milestone,
            oracle_result=oracle_result,
            donations=donations,
        )

        released_at = datetime.now(timezone.utc)
        await db.milestones.update_one(
            {"_id": ObjectId(milestone_id)},
            {
                "$set": {
                    "status": "released",
                    "solana_tx": release["signature"],
                    "released_at": released_at,
                }
            },
        )
        await _sync_campaign_milestone(
            db,
            campaign_id=campaign_id,
            milestone_id=milestone_id,
            update_fields={
                "status": "approved",
                "released_at": released_at,
                "solana_tx": release["signature"],
                "oracle_result": oracle_result.to_dict(),
            },
        )

        for entry in release["per_donor_released"]:
            await db.donations.update_one(
                {"donor_id": entry["donor_id"], "campaign_id": campaign_id},
                {
                    "$inc": {
                        "released_sol": entry["amount_sol"],
                        "locked_sol": -entry["amount_sol"],
                    }
                },
            )

        await _audit(
            db,
            milestone_id,
            campaign_id,
            "funds_released",
            {
                "amount_sol": milestone.get("amount_sol"),
                "solana_tx": release["signature"],
                "explorer_url": release["explorer_url"],
            },
        )
        print(f"[Pipeline] Released. TX: {release['signature']}")

    except Exception as e:
        print(f"[Pipeline] ERROR for milestone {milestone_id}: {e}")
        await db.milestones.update_one(
            {"_id": ObjectId(milestone_id)},
            {"$set": {"status": "submitted", "pipeline_error": str(e)}},
        )
        await _sync_campaign_milestone(
            db,
            campaign_id=campaign_id,
            milestone_id=milestone_id,
            update_fields={"status": "submitted", "pipeline_error": str(e)},
        )
        raise

