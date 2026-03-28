import os
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import TokenData, get_current_user, require_donor, require_ngo, require_verifier
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


@app.on_event("startup")
async def startup():
    global mongo_client, db
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]


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
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── Auth ────────────────────────────────────────────────────────────────────

@app.get("/api/auth/me")
async def get_me(user: TokenData = Depends(get_current_user)):
    doc = await db.users.find_one({"auth0_sub": user.sub})
    if not doc:
        new_user = {
            "auth0_sub": user.sub,
            "email": user.email,
            "role": user.role,
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


async def run_agent_pipeline(milestone_id: str):
    """Stub: agent pipeline fires here after evidence submission."""
    print(f"[agent] Pipeline triggered for milestone {milestone_id}")
    # TODO: call Gemini + oracle + Solana release logic


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

    background_tasks.add_task(run_agent_pipeline, milestone_id)

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

@app.get("/api/analytics/platform")
async def platform_analytics(user: TokenData = Depends(get_current_user)):
    total_campaigns = await db.campaigns.count_documents({})
    active_campaigns = await db.campaigns.count_documents({"status": "active"})
    total_donations_cursor = db.donations.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount_sol"}, "released": {"$sum": "$released_sol"}}}
    ])
    agg = await total_donations_cursor.to_list(1)
    totals = agg[0] if agg else {"total": 0, "released": 0}
    return {
        "total_campaigns": total_campaigns,
        "active_campaigns": active_campaigns,
        "total_raised_sol": totals.get("total", 0),
        "total_released_sol": totals.get("released", 0),
    }


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
    name: str | None = None
    email: str | None = None

class UpdatePasswordRequest(_BaseModel):
    current: str
    next: str

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
