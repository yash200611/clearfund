import asyncio
import json
import os
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import TokenData, decode_token, get_current_user, require_donor, require_ngo, require_verifier
from pipeline.milestone_pipeline import process_milestone_submission
from realtime.broker import manager
from analytics.lava_client import LavaClient
from wallet.privy_client import PrivyClient
from analytics.cached_lava import get_cached_vault_transactions, get_cached_vault_stats
from models import (
    Campaign,
    CreateCampaignRequest,
    CreateDonationRequest,
    CreateMilestoneRequest,
    Donation,
    Milestone,
    SubmitEvidenceRequest,
    User,
)

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "clearfund")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app = FastAPI(title="Milestone Escrow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB client
mongo_client: AsyncIOMotorClient = None
db = None
lava_client: Optional[LavaClient] = None


@app.on_event("startup")
async def startup():
    global mongo_client, db, lava_client
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    try:
        lava_client = LavaClient()
    except RuntimeError as e:
        print(f"[Startup] WARNING: {e} — Lava analytics disabled.")


@app.on_event("shutdown")
async def shutdown():
    if mongo_client:
        mongo_client.close()


def serialize(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    # Lava check
    lava_status = "degraded"
    if lava_client:
        try:
            ok = await lava_client.health_check()
            lava_status = "ok" if ok else "degraded"
        except Exception:
            pass

    # Mongo check
    mongo_status = "degraded"
    try:
        await db.command("ping")
        mongo_status = "ok"
    except Exception:
        pass

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lava": lava_status,
        "mongo": mongo_status,
    }


# ─── Auth ────────────────────────────────────────────────────────────────────

@app.get("/api/auth/me")
async def get_me(user: TokenData = Depends(get_current_user)):
    doc = await db.users.find_one({"auth0_sub": user.sub})
    if not doc:
        new_user = {
            "auth0_sub": user.sub,
            "email": user.email,
            "role": user.role or None,   # null = needs role selection
            "privy_wallet_id": None,
            "wallet_address": None,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(new_user)
        new_user["_id"] = str(result.inserted_id)
        return new_user
    return serialize(doc)


# ─── Campaigns ───────────────────────────────────────────────────────────────

@app.get("/api/campaigns")
async def list_campaigns():
    cursor = db.campaigns.find({"status": "active"})
    campaigns = []
    async for doc in cursor:
        campaigns.append(serialize(doc))
    return campaigns


@app.post("/api/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CreateCampaignRequest,
    user: TokenData = Depends(require_ngo),
):
    ngo_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not ngo_doc:
        raise HTTPException(status_code=404, detail="User not found")

    campaign = {
        "ngo_id": str(ngo_doc["_id"]),
        "title": body.title,
        "description": body.description,
        "category": body.category,
        "total_raised_sol": 0.0,
        "vault_address": body.vault_address,
        "status": "draft",
        "trust_score": 0.0,
        "failure_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.campaigns.insert_one(campaign)
    campaign["_id"] = str(result.inserted_id)
    return campaign


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    doc = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")

    milestones = []
    async for m in db.milestones.find({"campaign_id": campaign_id}):
        milestones.append(serialize(m))

    campaign = serialize(doc)
    campaign["milestones"] = milestones
    return campaign


# ─── Donations ───────────────────────────────────────────────────────────────

@app.post("/api/donations", status_code=status.HTTP_201_CREATED)
async def create_donation(
    body: CreateDonationRequest,
    user: TokenData = Depends(require_donor),
):
    donor_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not donor_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if not ObjectId.is_valid(body.campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.campaigns.find_one({"_id": ObjectId(body.campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    donation = {
        "donor_id": str(donor_doc["_id"]),
        "campaign_id": body.campaign_id,
        "amount_sol": body.amount_sol,
        "wallet_address": body.wallet_address,
        "solana_tx": body.solana_tx,
        "released_sol": 0.0,
        "locked_sol": body.amount_sol,
        "refunded_sol": 0.0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.donations.insert_one(donation)
    donation["_id"] = str(result.inserted_id)

    await db.campaigns.update_one(
        {"_id": ObjectId(body.campaign_id)},
        {"$inc": {"total_raised_sol": body.amount_sol}},
    )
    return donation


# ─── Milestones ──────────────────────────────────────────────────────────────

@app.post("/api/campaigns/{campaign_id}/milestones", status_code=status.HTTP_201_CREATED)
async def create_milestone(
    campaign_id: str,
    body: CreateMilestoneRequest,
    user: TokenData = Depends(require_ngo),
):
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    milestone = {
        "campaign_id": campaign_id,
        "title": body.title,
        "description": body.description,
        "amount_sol": body.amount_sol,
        "due_date": body.due_date,
        "status": "pending",
        "evidence_urls": [],
        "ai_decision": {},
        "oracle_result": {},
        "solana_tx": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.milestones.insert_one(milestone)
    milestone["_id"] = str(result.inserted_id)
    return milestone


@app.post("/api/milestones/{milestone_id}/submit")
async def submit_evidence(
    milestone_id: str,
    body: SubmitEvidenceRequest,
    background_tasks: BackgroundTasks,
    user: TokenData = Depends(require_ngo),
):
    if not ObjectId.is_valid(milestone_id):
        raise HTTPException(status_code=400, detail="Invalid milestone ID")
    milestone = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    await db.milestones.update_one(
        {"_id": ObjectId(milestone_id)},
        {
            "$set": {
                "status": "submitted",
                "description": body.description,
                "evidence_urls": body.evidence_urls,
            }
        },
    )

    background_tasks.add_task(process_milestone_submission, milestone_id)

    updated = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
    return serialize(updated)


# ─── Milestone Review (Verifier) ─────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class ReviewRequest(_BaseModel):
    decision: str
    notes: str = ""

@app.post("/api/milestones/{milestone_id}/review")
async def review_milestone(
    milestone_id: str,
    body: ReviewRequest,
    user: TokenData = Depends(require_verifier),
):
    if not ObjectId.is_valid(milestone_id):
        raise HTTPException(status_code=400, detail="Invalid milestone ID")
    milestone = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    new_status = "approved" if body.decision == "approve" else "rejected"
    await db.milestones.update_one(
        {"_id": ObjectId(milestone_id)},
        {"$set": {"status": new_status, "reviewer_notes": body.notes, "reviewed_by": user.sub}},
    )
    updated = await db.milestones.find_one({"_id": ObjectId(milestone_id)})
    return serialize(updated)


# ─── Donations (mine) ────────────────────────────────────────────────────────

@app.get("/api/donations/mine")
async def get_my_donations(user: TokenData = Depends(get_current_user)):
    donor_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not donor_doc:
        return []
    donations = []
    async for doc in db.donations.find({"donor_id": str(donor_doc["_id"])}):
        donations.append(serialize(doc))
    return donations


# ─── Verification Queue ──────────────────────────────────────────────────────

@app.get("/api/verification/queue")
async def get_verification_queue(user: TokenData = Depends(require_verifier)):
    milestones = []
    async for doc in db.milestones.find({"status": "submitted"}):
        milestones.append(serialize(doc))
    return milestones


# ─── Analytics ───────────────────────────────────────────────────────────────

@app.get("/api/analytics/ngo")
async def ngo_analytics(user: TokenData = Depends(require_ngo)):
    ngo_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not ngo_doc:
        raise HTTPException(status_code=404, detail="User not found")
    ngo_id = str(ngo_doc["_id"])
    campaigns = []
    async for doc in db.campaigns.find({"ngo_id": ngo_id}):
        campaigns.append(serialize(doc))
    total_raised = sum(c.get("total_raised_sol", 0) for c in campaigns)
    return {
        "my_campaigns": campaigns,
        "total_raised_sol": total_raised,
        "campaign_count": len(campaigns),
    }


# ─── Campaign Activity ────────────────────────────────────────────────────────

@app.get("/api/campaigns/{campaign_id}/activity")
async def get_campaign_activity(campaign_id: str):
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    logs = []
    async for doc in db.agent_audit_logs.find(
        {"campaign_id": campaign_id}
    ).sort("created_at", -1).limit(20):
        logs.append(serialize(doc))
    return logs


# ─── User Profile ────────────────────────────────────────────────────────────

class UpdateProfileRequest(_BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class UpdatePasswordRequest(_BaseModel):
    current: str
    next: str

class UpdateRoleRequest(_BaseModel):
    role: str

@app.put("/api/users/me/role")
async def update_role(body: UpdateRoleRequest, user: TokenData = Depends(get_current_user)):
    if body.role not in ("donor", "ngo"):
        raise HTTPException(status_code=400, detail="Role must be 'donor' or 'ngo'")

    existing = await db.users.find_one({"auth0_sub": user.sub})
    update: dict = {"role": body.role}

    # Only create wallet if user doesn't have one yet
    if existing and not existing.get("wallet_address"):
        try:
            privy = PrivyClient()
            wallet = await privy.create_embedded_wallet(user.sub)
            update["privy_wallet_id"] = wallet["wallet_id"]
            update["wallet_address"] = wallet["address"]

            # Donors get 5 devnet SOL so they can demo donations immediately
            if body.role == "donor":
                try:
                    await privy.request_airdrop(wallet["address"], sol=5.0)
                    update["wallet_balance_sol"] = 5.0
                    print(f"[Wallet] Airdropped 5 SOL to donor {wallet['address']}")
                except Exception as e:
                    print(f"[Wallet] Airdrop failed (non-fatal): {e}")

            print(f"[Wallet] Created {body.role} wallet: {wallet['address']}")
        except Exception as e:
            print(f"[Wallet] Wallet creation failed (non-fatal): {e}")

    await db.users.update_one(
        {"auth0_sub": user.sub},
        {"$set": update},
    )
    doc = await db.users.find_one({"auth0_sub": user.sub})
    return serialize(doc)

@app.get("/api/users/me/wallet")
async def get_my_wallet(user: TokenData = Depends(get_current_user)):
    """Returns the user's wallet address and live SOL balance."""
    doc = await db.users.find_one({"auth0_sub": user.sub})
    if not doc or not doc.get("wallet_address"):
        return {"wallet_address": None, "balance_sol": 0.0}
    address = doc["wallet_address"]
    try:
        privy = PrivyClient()
        balance = await privy.get_wallet_balance(address)
    except Exception:
        balance = 0.0
    return {"wallet_address": address, "balance_sol": balance}


@app.put("/api/users/me")
async def update_profile(body: UpdateProfileRequest, user: TokenData = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"auth0_sub": user.sub}, {"$set": update})
    doc = await db.users.find_one({"auth0_sub": user.sub})
    return serialize(doc)

@app.put("/api/users/me/password")
async def update_password(body: UpdatePasswordRequest, user: TokenData = Depends(get_current_user)):
    # Password changes are handled by Auth0 — this is a no-op stub
    return {"success": True}


# ─── WebSocket helpers ────────────────────────────────────────────────────────

async def _ws_authenticate(websocket: WebSocket) -> bool:
    """
    Expect first message: { "token": "<auth0_jwt>" }
    Returns True if valid, sends error and closes if not.
    """
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        data = json.loads(raw)
        token = data.get("token", "")
        decode_token(token)   # raises HTTPException if invalid
        return True
    except asyncio.TimeoutError:
        await websocket.send_text(json.dumps({"error": "auth_timeout"}))
        await websocket.close(code=1008)
        return False
    except Exception:
        await websocket.send_text(json.dumps({"error": "unauthorized"}))
        await websocket.close(code=1008)
        return False


async def _keepalive(websocket: WebSocket, interval: int = 30) -> None:
    """Send ping every `interval` seconds to keep connection alive."""
    while True:
        await asyncio.sleep(interval)
        try:
            await websocket.send_text(json.dumps({"event_type": "ping"}))
        except Exception:
            break


# ─── WebSocket endpoints ──────────────────────────────────────────────────────

@app.websocket("/api/ws/agents")
async def ws_global_feed(websocket: WebSocket):
    """Global agent event feed — Agent Dashboard subscribes here."""
    await websocket.accept()
    if not await _ws_authenticate(websocket):
        return

    await manager.connect(websocket, milestone_id=None)
    keepalive = asyncio.create_task(_keepalive(websocket))
    try:
        await websocket.send_text(json.dumps({"event_type": "connected", "channel": "global"}))
        while True:
            await websocket.receive_text()   # keep the loop alive; client sends pong
    except WebSocketDisconnect:
        pass
    finally:
        keepalive.cancel()
        manager.disconnect(websocket, milestone_id=None)


@app.websocket("/api/ws/milestones/{milestone_id}")
async def ws_milestone_feed(websocket: WebSocket, milestone_id: str):
    """Per-milestone event feed."""
    await websocket.accept()
    if not await _ws_authenticate(websocket):
        return

    await manager.connect(websocket, milestone_id=milestone_id)
    keepalive = asyncio.create_task(_keepalive(websocket))
    try:
        await websocket.send_text(json.dumps({
            "event_type":   "connected",
            "channel":      "milestone",
            "milestone_id": milestone_id,
        }))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        keepalive.cancel()
        manager.disconnect(websocket, milestone_id=milestone_id)


# ─── Agent Audit Log routes ───────────────────────────────────────────────────

@app.get("/api/agent-logs")
async def get_agent_logs(
    limit: int = Query(default=50, le=200),
    user: TokenData = Depends(get_current_user),
):
    """Last N agent audit log entries across all milestones."""
    logs = []
    async for doc in db.agent_audit_logs.find().sort("created_at", -1).limit(limit):
        logs.append(serialize(doc))
    return logs


@app.get("/api/agent-logs/{milestone_id}")
async def get_milestone_logs(
    milestone_id: str,
    user: TokenData = Depends(get_current_user),
):
    """Full audit trail for a specific milestone."""
    logs = []
    async for doc in db.agent_audit_logs.find(
        {"milestone_id": milestone_id}
    ).sort("created_at", 1):
        logs.append(serialize(doc))
    return logs


# ─── Enhanced Platform Analytics ─────────────────────────────────────────────

@app.get("/api/analytics/platform")
async def platform_analytics(user: TokenData = Depends(get_current_user)):
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Campaign counts
    campaigns_active    = await db.campaigns.count_documents({"status": "active"})
    campaigns_completed = await db.campaigns.count_documents({"status": "completed"})

    # Donation aggregation
    donation_agg = await db.donations.aggregate([
        {"$group": {
            "_id":      None,
            "raised":   {"$sum": "$amount_sol"},
            "released": {"$sum": "$released_sol"},
            "locked":   {"$sum": "$locked_sol"},
        }}
    ]).to_list(1)
    d = donation_agg[0] if donation_agg else {}

    # Milestone counts
    milestones_approved = await db.milestones.count_documents({"status": "released"})
    milestones_rejected = await db.milestones.count_documents({"status": "rejected"})

    # Average confidence score from audit logs
    conf_agg = await db.agent_audit_logs.aggregate([
        {"$match": {"event_type": "agent_decision"}},
        {"$group": {"_id": None, "avg": {"$avg": "$payload.confidence_score"}}},
    ]).to_list(1)
    avg_confidence = round(conf_agg[0]["avg"], 1) if conf_agg else 0.0

    # Agent decisions today
    decisions_today = await db.agent_audit_logs.count_documents({
        "event_type": "agent_decision",
        "created_at": {"$gte": today_start},
    })

    # Live Lava balance sum for active vaults
    lava_status = "degraded"
    live_locked_sol = d.get("locked", 0.0)
    if lava_client:
        try:
            active_vaults = []
            async for c in db.campaigns.find(
                {"status": "active", "vault_address": {"$exists": True, "$ne": None}}
            ):
                va = c.get("vault_address")
                if va:
                    active_vaults.append(va)

            if active_vaults:
                balances = 0.0
                for va in active_vaults:
                    balances += await lava_client.get_balance(va)
                live_locked_sol = round(balances, 9)

            ok = await lava_client.health_check()
            lava_status = "ok" if ok else "degraded"
        except Exception:
            pass

    return {
        "total_raised_sol":      d.get("raised", 0.0),
        "total_released_sol":    d.get("released", 0.0),
        "total_locked_sol":      live_locked_sol,
        "campaigns_active":      campaigns_active,
        "campaigns_completed":   campaigns_completed,
        "milestones_approved":   milestones_approved,
        "milestones_rejected":   milestones_rejected,
        "avg_confidence_score":  avg_confidence,
        "agent_decisions_today": decisions_today,
        "lava_status":           lava_status,
    }


# ─── Vault Analytics (Lava) ──────────────────────────────────────────────────

@app.get("/api/analytics/vault/{campaign_id}")
async def vault_transactions(
    campaign_id: str,
    user: TokenData = Depends(get_current_user),
):
    """Transaction history for a campaign's on-chain vault."""
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    vault_address = campaign.get("vault_address")
    if not vault_address:
        raise HTTPException(status_code=422, detail="Campaign has no vault_address")

    if not lava_client:
        raise HTTPException(status_code=503, detail="Lava analytics not configured")

    transactions = await get_cached_vault_transactions(vault_address, lava_client, db)
    return {"vault_address": vault_address, "transactions": transactions}


@app.get("/api/analytics/vault/{campaign_id}/stats")
async def vault_stats(
    campaign_id: str,
    user: TokenData = Depends(get_current_user),
):
    """Aggregated on-chain stats for a campaign vault."""
    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    vault_address = campaign.get("vault_address")
    if not vault_address:
        raise HTTPException(status_code=422, detail="Campaign has no vault_address")

    if not lava_client:
        raise HTTPException(status_code=503, detail="Lava analytics not configured")

    stats = await get_cached_vault_stats(vault_address, lava_client, db)
    return stats


@app.get("/api/analytics/address/{wallet_address}")
async def address_transactions(wallet_address: str):
    """
    Public endpoint — no auth required.
    Returns on-chain transaction history for any wallet address.
    Useful for donors verifying their own activity.
    """
    if not lava_client:
        raise HTTPException(status_code=503, detail="Lava analytics not configured")

    transactions = await lava_client.get_vault_transactions(wallet_address, limit=20)
    return {"wallet_address": wallet_address, "transactions": transactions}
