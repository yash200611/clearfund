"""
ClearFund Milestone Pipeline
Wires Gemini agent → Oracle → Executor in sequence.
Called as a FastAPI BackgroundTask after evidence submission.
"""

import os
from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from agents.verification_agent import run_verification_agent
from oracle.decision_oracle import DecisionOracle, OracleVerdict
from executor.escrow_executor import EscrowExecutor
from realtime.broker import manager

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "clearfund")

from typing import Optional as _Optional
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


async def _audit(db, milestone_id: str, campaign_id: str, event_type: str, payload: dict) -> None:
    """Write to audit log AND broadcast over WebSocket."""
    now = datetime.now(timezone.utc)
    await db.agent_audit_logs.insert_one({
        "milestone_id": milestone_id,
        "campaign_id":  campaign_id,
        "event_type":   event_type,
        "payload":      payload,
        "created_at":   now,
    })
    await manager.emit(milestone_id, event_type, payload)


async def process_milestone_submission(milestone_id: str) -> None:
    db = _get_db()

    # ── 1. Fetch documents ────────────────────────────────────────────────────
    milestone_doc = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
    if not milestone_doc:
        print(f"[Pipeline] Milestone {milestone_id} not found.")
        return

    campaign_id  = milestone_doc.get("campaign_id", "")
    campaign_doc = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign_doc:
        print(f"[Pipeline] Campaign {campaign_id} not found.")
        return

    milestone = _serialize(dict(milestone_doc))
    campaign  = _serialize(dict(campaign_doc))

    # ── 2. Mark as processing ─────────────────────────────────────────────────
    await db.milestones.update_one(
        {"_id": ObjectId(milestone_id)},
        {"$set": {"status": "processing"}},
    )

    try:
        # ── 3. Gemini verification agent ──────────────────────────────────────
        print(f"[Pipeline] Running verification agent for milestone {milestone_id}")

        # agent_started is emitted inside run_verification_agent
        ai_decision = await run_verification_agent(milestone, campaign)

        await db.milestones.update_one(
            {"_id": ObjectId(milestone_id)},
            {"$set": {"ai_decision": ai_decision}},
        )
        await _audit(db, milestone_id, campaign_id, "agent_decision", {
            "confidence_score": ai_decision.get("confidence_score"),
            "recommendation":   ai_decision.get("recommendation"),
            "reasoning":        ai_decision.get("reasoning"),
            "red_flags":        ai_decision.get("red_flags", []),
        })

        # ── 4. Oracle evaluation ──────────────────────────────────────────────
        print(f"[Pipeline] Running oracle for milestone {milestone_id}")

        last_released_milestone = await db.milestones.find_one(
            {"campaign_id": campaign_id, "status": "released"},
            sort=[("created_at", -1)],
        )
        last_release_at = (
            last_released_milestone.get("released_at")
            if last_released_milestone
            else None
        )

        milestone_doc = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
        milestone     = _serialize(dict(milestone_doc))
        milestone["status"] = "submitted"  # oracle needs submitted status

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
        await _audit(db, milestone_id, campaign_id, "oracle_result", {
            "verdict":        oracle_result.verdict.value,
            "reason":         oracle_result.reason,
            "checks_passed":  oracle_result.checks_passed,
            "checks_failed":  oracle_result.checks_failed,
        })

        print(f"[Pipeline] Oracle verdict: {oracle_result.verdict} — {oracle_result.reason}")

        # ── 5a. BLOCKED or REJECTED ───────────────────────────────────────────
        if oracle_result.verdict in (OracleVerdict.BLOCKED, OracleVerdict.REJECTED):
            await db.milestones.update_one(
                {"_id": ObjectId(milestone_id)},
                {"$set": {"status": "rejected"}},
            )
            new_failure_count = campaign.get("failure_count", 0) + 1
            await db.campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {"$inc": {"failure_count": 1}},
            )

            await _audit(db, milestone_id, campaign_id, "milestone_rejected", {
                "reason":        oracle_result.reason,
                "failure_count": new_failure_count,
            })

            if new_failure_count >= 3:
                print(f"[Pipeline] Campaign {campaign_id} suspended. Triggering refunds.")
                await db.campaigns.update_one(
                    {"_id": ObjectId(campaign_id)},
                    {"$set": {"status": "failed"}},
                )
                donations = []
                async for d in db.donations.find({"campaign_id": campaign_id}):
                    donations.append(d)

                total_refunded = 0.0
                if donations:
                    executor = EscrowExecutor()
                    refunds  = await executor.refund_donors(campaign, donations)

                    for refund in refunds:
                        total_refunded += refund["amount_sol"]
                        await db.donations.update_one(
                            {"donor_id": refund["donor_id"], "campaign_id": campaign_id},
                            {
                                "$set": {"locked_sol": 0},
                                "$inc": {"refunded_sol": refund["amount_sol"]},
                            },
                        )

                    await _audit(db, milestone_id, campaign_id, "campaign_failed", {
                        "campaign_id":       campaign_id,
                        "total_refunded_sol": total_refunded,
                    })
            return

        # ── 5b. APPROVED ──────────────────────────────────────────────────────
        print(f"[Pipeline] Approved. Executing release for milestone {milestone_id}")

        donations = []
        async for d in db.donations.find({"campaign_id": campaign_id}):
            donations.append(d)

        executor = EscrowExecutor()
        release  = await executor.release_milestone(
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
                    "status":      "released",
                    "solana_tx":   release["signature"],
                    "released_at": released_at,
                }
            },
        )

        for entry in release["per_donor_released"]:
            await db.donations.update_one(
                {"donor_id": entry["donor_id"], "campaign_id": campaign_id},
                {
                    "$inc": {
                        "released_sol": entry["amount_sol"],
                        "locked_sol":   -entry["amount_sol"],
                    }
                },
            )

        await _audit(db, milestone_id, campaign_id, "funds_released", {
            "amount_sol":   milestone.get("amount_sol"),
            "solana_tx":    release["signature"],
            "explorer_url": release["explorer_url"],
        })

        print(f"[Pipeline] Released. TX: {release['signature']}")

    except Exception as e:
        print(f"[Pipeline] ERROR for milestone {milestone_id}: {e}")
        await db.milestones.update_one(
            {"_id": ObjectId(milestone_id)},
            {"$set": {"status": "submitted", "pipeline_error": str(e)}},
        )
        raise
