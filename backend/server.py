import asyncio
import json
import os
import time
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

from auth import (
    AUTH0_AUDIENCE,
    AUTH0_DOMAIN,
    TokenData,
    decode_token,
    get_current_user,
    get_jwks,
)
from agents.campaign_review_agent import run_campaign_review_agent
from pipeline.milestone_pipeline import process_milestone_submission
from realtime.broker import manager
from analytics.lava_client import LavaClient
from wallet.privy_client import PrivyClient
from analytics.cached_lava import get_cached_vault_transactions, get_cached_vault_stats
from models import (
    Campaign,
    CreateCampaignRequest,
    CreateDonationRequest,
    CreateDonationTransferRequest,
    CreateMilestoneRequest,
    Donation,
    Milestone,
    SubmitEvidenceRequest,
    User,
)

load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("clearfund.server")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "clearfund")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SOLANA_NETWORK = os.getenv("SOLANA_NETWORK", "devnet")
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", f"https://api.{SOLANA_NETWORK}.solana.com")

LAMPORTS_PER_SOL = 1_000_000_000
EXPLORER_BASE = "https://explorer.solana.com/tx"

app = FastAPI(title="Milestone Escrow API")

_allowed_origins = list(filter(None, [
    "http://localhost:5173",
    "http://localhost:3000",
    FRONTEND_URL,
    "https://clearfund-lovat.vercel.app",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())[:8]
    method = request.method
    path = request.url.path
    query = request.url.query
    start = time.perf_counter()
    client_host = request.client.host if request.client else "-"

    logger.info(
        "[REQ %s] -> %s %s%s client=%s",
        req_id,
        method,
        path,
        f"?{query}" if query else "",
        client_host,
    )
    try:
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "[REQ %s] <- %s %s status=%s dur_ms=%.2f",
            req_id,
            method,
            path,
            response.status_code,
            elapsed_ms,
        )
        response.headers["x-request-id"] = req_id
        return response
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "[REQ %s] !! unhandled error %s %s after %.2fms",
            req_id,
            method,
            path,
            elapsed_ms,
        )
        raise


@app.exception_handler(HTTPException)
async def log_http_exception(request: Request, exc: HTTPException):
    logger.warning(
        "[HTTPException] %s %s status=%s detail=%s",
        request.method,
        request.url.path,
        exc.status_code,
        exc.detail,
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def log_unhandled_exception(request: Request, exc: Exception):
    logger.exception(
        "[UnhandledException] %s %s error=%s",
        request.method,
        request.url.path,
        str(exc),
    )
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# DB client
mongo_client: AsyncIOMotorClient = None
db = None
lava_client: Optional[LavaClient] = None


async def resolve_app_user(user: TokenData = Depends(get_current_user)) -> TokenData:
    """
    Resolve effective role from DB first (source of truth), then fallback to token claim.
    This prevents Auth0 claim drift from breaking app role selection.
    """
    token_role = user.role
    doc = await db.users.find_one({"auth0_sub": user.sub}, {"role": 1})
    db_role = doc.get("role") if doc else None
    effective_role = db_role or token_role
    user.role = effective_role
    logger.info(
        "[Authz] sub=%s token_role=%s db_role=%s effective_role=%s",
        user.sub,
        token_role,
        db_role,
        effective_role,
    )
    return user


def require_roles(*allowed_roles: str):
    async def _dep(user: TokenData = Depends(resolve_app_user)) -> TokenData:
        if user.role not in allowed_roles and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{'/'.join(allowed_roles)} access required",
            )
        return user
    return _dep


require_donor_role = require_roles("donor")
require_ngo_role = require_roles("ngo")
require_verifier_role = require_roles("verifier")


@app.on_event("startup")
async def startup():
    global mongo_client, db, lava_client
    logger.info(
        "[Startup] Booting API DB_NAME=%s FRONTEND_URL=%s LOG_LEVEL=%s",
        DB_NAME,
        FRONTEND_URL,
        LOG_LEVEL,
    )
    logger.info("[Startup] Allowed CORS origins=%s", _allowed_origins)
    logger.info(
        "[Startup] Auth config AUTH0_DOMAIN=%s AUTH0_AUDIENCE=%s",
        AUTH0_DOMAIN,
        AUTH0_AUDIENCE,
    )
    mongo_client = AsyncIOMotorClient(
        MONGO_URL,
        tls=True,
        tlsAllowInvalidCertificates=False,
        serverSelectionTimeoutMS=30000,
    )
    db = mongo_client[DB_NAME]
    try:
        await db.command("ping")
        logger.info("[Startup] Mongo ping OK")
    except Exception as e:
        logger.exception("[Startup] Mongo ping failed error=%s", str(e))
    try:
        jwks = get_jwks()
        logger.info("[Startup] JWKS preflight OK key_count=%s", len(jwks.get("keys", [])))
    except HTTPException as e:
        logger.warning("[Startup] JWKS preflight failed status=%s detail=%s", e.status_code, e.detail)
    except Exception as e:
        logger.exception("[Startup] JWKS preflight unexpected error=%s", str(e))
    try:
        lava_client = LavaClient()
        logger.info("[Startup] Lava client initialized")
    except RuntimeError as e:
        logger.warning("[Startup] Lava disabled: %s", str(e))


@app.on_event("shutdown")
async def shutdown():
    if mongo_client:
        logger.info("[Shutdown] Closing Mongo client")
        mongo_client.close()


def serialize(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def public_campaign(doc: dict) -> dict:
    out = serialize(doc)
    out.pop("privy_vault_wallet_id", None)
    return out


def _optional_user_from_request(request: Request) -> Optional[TokenData]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = decode_token(token)
        return TokenData(
            sub=payload.get("sub", ""),
            email=payload.get("email", ""),
            role=payload.get("https://clearfund.app/role"),
        )
    except HTTPException as e:
        logger.warning("[Campaigns] optional auth ignored status=%s detail=%s", e.status_code, e.detail)
        return None
    except Exception as e:
        logger.warning("[Campaigns] optional auth ignored error=%s", str(e))
        return None


async def _run_campaign_intake_review(campaign_id: str) -> None:
    """
    Background task: send campaign to Gemini, then update status.
    - approve + trust_score >= 60 + vault_address present -> active
    - reject                                               -> rejected
    - anything else                                        -> under_review
    """
    MIN_TRUST_SCORE = 60

    try:
        if not ObjectId.is_valid(campaign_id):
            logger.warning("[CampaignReview] invalid campaign_id=%s", campaign_id)
            return

        campaign_doc = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
        if not campaign_doc:
            logger.warning("[CampaignReview] campaign not found id=%s", campaign_id)
            return

        campaign = serialize(dict(campaign_doc))
        logger.info("[CampaignReview] started campaign_id=%s title=%s", campaign_id, campaign.get("title"))

        await manager.broadcast_global(
            event_type="campaign_review_started",
            milestone_id="",
            payload={"campaign_id": campaign_id, "title": campaign.get("title", "")},
        )

        result = await run_campaign_review_agent(campaign)

        recommendation = str(result.get("recommendation", "needs_info"))
        trust_score = int(result.get("trust_score", campaign.get("trust_score", 0) or 0))
        trust_score = max(0, min(100, trust_score))
        vault_address = campaign.get("vault_address", "")

        # Campaign only goes live if Gemini approves, score is sufficient, and vault exists
        if recommendation == "reject":
            new_status = "rejected"
        elif recommendation == "approve" and trust_score >= MIN_TRUST_SCORE and vault_address:
            new_status = "active"
        else:
            new_status = "under_review"

        risk_flags = result.get("risk_flags", [])
        if not vault_address:
            risk_flags = list(risk_flags) + ["no_vault_address"]
        if trust_score < MIN_TRUST_SCORE and recommendation == "approve":
            risk_flags = list(risk_flags) + [f"trust_score_below_threshold_{trust_score}"]

        review_update = {
            "status": new_status,
            "trust_score": trust_score,
            "campaign_review": {
                "model": os.getenv("GEMINI_CAMPAIGN_MODEL", "gemini-2.5-flash"),
                "recommendation": recommendation,
                "confidence_score": int(result.get("confidence_score", 0)),
                "reasoning": str(result.get("reasoning", "")),
                "risk_flags": risk_flags,
                "reviewed_at": datetime.now(timezone.utc),
            },
        }

        await db.campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": review_update})
        logger.info(
            "[CampaignReview] complete campaign_id=%s recommendation=%s status=%s trust_score=%s",
            campaign_id, recommendation, new_status, trust_score,
        )

        await manager.broadcast_global(
            event_type="campaign_review_completed",
            milestone_id="",
            payload={
                "campaign_id": campaign_id,
                "title": campaign.get("title", ""),
                "recommendation": recommendation,
                "status": new_status,
                "trust_score": trust_score,
                "confidence_score": int(result.get("confidence_score", 0)),
                "reasoning": str(result.get("reasoning", "")),
                "risk_flags": risk_flags,
            },
        )

        await db.agent_audit_logs.insert_one({
            "campaign_id": campaign_id,
            "milestone_id": None,
            "event_type": "campaign_review_completed",
            "payload": {
                "recommendation": recommendation,
                "status": new_status,
                "confidence_score": int(result.get("confidence_score", 0)),
                "reasoning": str(result.get("reasoning", "")),
                "risk_flags": risk_flags,
            },
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.exception("[CampaignReview] failed campaign_id=%s error=%s", campaign_id, str(e))


def _solana_explorer_url(signature: str) -> str:
    return f"{EXPLORER_BASE}/{signature}?cluster={SOLANA_NETWORK}"


def _normalize_account_key(account_key) -> str:
    if isinstance(account_key, str):
        return account_key
    if isinstance(account_key, dict):
        return str(account_key.get("pubkey", ""))
    return str(account_key or "")


async def _fetch_transaction(signature: str) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTransaction",
        "params": [
            signature,
            {
                "encoding": "jsonParsed",
                "maxSupportedTransactionVersion": 0,
            },
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(SOLANA_RPC_URL, json=payload)
            response.raise_for_status()
            body = response.json()
    except Exception as e:
        logger.exception("[DonationTransfer] Solana RPC failed sig=%s error=%s", signature, str(e))
        raise HTTPException(status_code=503, detail="Unable to verify transaction on Solana RPC")

    if "error" in body:
        logger.warning(
            "[DonationTransfer] Solana RPC returned error sig=%s rpc_error=%s",
            signature,
            body["error"],
        )
        raise HTTPException(status_code=422, detail="Transaction could not be verified yet")

    tx = body.get("result")
    if not tx:
        raise HTTPException(status_code=422, detail="Transaction not found on Solana")
    return tx


def _verify_donor_to_vault_transfer(
    tx: dict,
    *,
    donor_wallet: str,
    vault_address: str,
    expected_lamports: int,
) -> None:
    meta = tx.get("meta") or {}
    if meta.get("err") is not None:
        raise HTTPException(status_code=422, detail="Transaction failed on-chain")

    message = (tx.get("transaction") or {}).get("message") or {}
    raw_keys = message.get("accountKeys") or []
    account_keys = [_normalize_account_key(k) for k in raw_keys]
    if not account_keys:
        raise HTTPException(status_code=422, detail="Transaction missing account keys")

    signer_keys = set()
    for key in raw_keys:
        if isinstance(key, dict) and key.get("signer"):
            signer_keys.add(_normalize_account_key(key))

    if not signer_keys:
        header = message.get("header") or {}
        num_required = int(header.get("numRequiredSignatures", 0))
        signer_keys = set(account_keys[:num_required])

    if donor_wallet not in signer_keys:
        raise HTTPException(status_code=422, detail="Transaction signer does not match donor wallet")

    try:
        donor_idx = account_keys.index(donor_wallet)
        vault_idx = account_keys.index(vault_address)
    except ValueError:
        raise HTTPException(status_code=422, detail="Transaction does not match donor-to-vault transfer")

    pre_balances = meta.get("preBalances") or []
    post_balances = meta.get("postBalances") or []
    if donor_idx >= len(pre_balances) or donor_idx >= len(post_balances):
        raise HTTPException(status_code=422, detail="Transaction balance metadata missing donor account")
    if vault_idx >= len(pre_balances) or vault_idx >= len(post_balances):
        raise HTTPException(status_code=422, detail="Transaction balance metadata missing vault account")

    donor_spent = int(pre_balances[donor_idx]) - int(post_balances[donor_idx])
    vault_received = int(post_balances[vault_idx]) - int(pre_balances[vault_idx])
    if donor_spent < expected_lamports or vault_received < expected_lamports:
        raise HTTPException(status_code=422, detail="Transaction amount does not match requested SOL")


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
    logger.info("[AuthMe] sub=%s email=%s role_claim=%s", user.sub, user.email, user.role)
    doc = await db.users.find_one({"auth0_sub": user.sub})
    if not doc:
        logger.info("[AuthMe] user not found, creating user sub=%s", user.sub)
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
        logger.info("[AuthMe] user created id=%s sub=%s", new_user["_id"], user.sub)
        return new_user
    logger.info(
        "[AuthMe] existing user id=%s role=%s has_wallet=%s",
        str(doc.get("_id")),
        doc.get("role"),
        bool(doc.get("wallet_address")),
    )
    return serialize(doc)


# ─── Campaigns ───────────────────────────────────────────────────────────────

@app.get("/api/campaigns")
async def list_campaigns(
    request: Request,
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    viewer = _optional_user_from_request(request)
    public_statuses = ["active", "under_review"]
    query_parts: list[dict] = []

    if viewer:
        viewer_doc = await db.users.find_one({"auth0_sub": viewer.sub}, {"role": 1})
        viewer_role = (viewer_doc or {}).get("role") or viewer.role
        if viewer_role == "ngo":
            ngo_doc = await db.users.find_one({"auth0_sub": viewer.sub}, {"_id": 1})
            if ngo_doc:
                ngo_id = str(ngo_doc["_id"])
                # NGO can see all of their own campaigns (including under_review/rejected),
                # plus publicly visible campaigns.
                query_parts.append({"$or": [{"status": {"$in": public_statuses}}, {"ngo_id": ngo_id}]})
            else:
                query_parts.append({"status": {"$in": public_statuses}})
        else:
            query_parts.append({"status": {"$in": public_statuses}})
    else:
        query_parts.append({"status": {"$in": public_statuses}})

    if status and status != "All":
        query_parts.append({"status": status})

    if category and category != "All":
        query_parts.append({"category": category})

    if search:
        rx = {"$regex": search, "$options": "i"}
        query_parts.append({"$or": [{"title": rx}, {"description": rx}, {"ngo_name": rx}]})

    query = query_parts[0] if len(query_parts) == 1 else {"$and": query_parts}

    cursor = db.campaigns.find(query).sort("created_at", -1)
    campaigns = []
    async for doc in cursor:
        campaigns.append(public_campaign(doc))
    return campaigns


@app.post("/api/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CreateCampaignRequest,
    background_tasks: BackgroundTasks,
    user: TokenData = Depends(require_ngo_role),
):
    ngo_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not ngo_doc:
        raise HTTPException(status_code=404, detail="User not found")

    campaign_oid = ObjectId()
    campaign_id = str(campaign_oid)

    # Vault must be provisioned before campaign is created.
    try:
        privy = PrivyClient()
        vault_wallet = await asyncio.wait_for(
            privy.create_campaign_vault_wallet(campaign_id),
            timeout=12,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "[CampaignCreate] vault provisioning timed out sub=%s campaign_id=%s",
            user.sub,
            campaign_id,
        )
        raise HTTPException(
            status_code=504,
            detail="Vault provisioning timed out. Please retry in a few seconds.",
        )
    except Exception as e:
        logger.exception(
            "[CampaignCreate] vault provisioning failed sub=%s campaign_id=%s error=%s",
            user.sub,
            campaign_id,
            str(e),
        )
        raise HTTPException(
            status_code=503,
            detail="Unable to provision campaign vault wallet",
        )

    campaign = {
        "_id": campaign_oid,
        "ngo_id": str(ngo_doc["_id"]),
        "ngo_name": ngo_doc.get("name") or ngo_doc.get("email") or "NGO",
        "title": body.title,
        "description": body.description,
        "category": body.category,
        "total_raised_sol": 0.0,
        "vault_address": vault_wallet["address"],
        "privy_vault_wallet_id": vault_wallet["wallet_id"],
        "status": "under_review",
        "trust_score": 0.0,
        "failure_count": 0,
        "campaign_review": {
            "recommendation": "pending",
            "confidence_score": 0,
            "reasoning": "Queued for Gemini intake review",
            "risk_flags": [],
            "reviewed_at": None,
        },
        "created_at": datetime.now(timezone.utc),
    }
    await db.campaigns.insert_one(campaign)
    campaign["_id"] = campaign_id

    logger.info("[CampaignReview] queued campaign_id=%s title=%s", campaign_id, campaign.get("title"))
    background_tasks.add_task(_run_campaign_intake_review, campaign_id)

    return public_campaign(campaign)


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

    campaign = public_campaign(doc)
    campaign["milestones"] = milestones
    return campaign


# ─── Donations ───────────────────────────────────────────────────────────────

@app.post("/api/donations", status_code=status.HTTP_201_CREATED)
async def create_donation(
    body: CreateDonationRequest,
    user: TokenData = Depends(require_donor_role),
):
    donor_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not donor_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if not ObjectId.is_valid(body.campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.campaigns.find_one({"_id": ObjectId(body.campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.get("status") != "active":
        raise HTTPException(status_code=422, detail="Campaign is under review and not accepting donations yet")

    if body.amount_sol <= 0:
        raise HTTPException(status_code=400, detail="amount_sol must be greater than zero")

    vault_address = campaign.get("vault_address")
    if not vault_address:
        raise HTTPException(status_code=422, detail="Campaign has no vault_address")

    existing = await db.donations.find_one({"solana_tx": body.solana_tx})
    if existing:
        raise HTTPException(status_code=409, detail="This transaction is already recorded")

    expected_lamports = int(round(body.amount_sol * LAMPORTS_PER_SOL))
    if expected_lamports <= 0:
        raise HTTPException(status_code=400, detail="amount_sol is too small")

    tx = await _fetch_transaction(body.solana_tx)
    _verify_donor_to_vault_transfer(
        tx,
        donor_wallet=body.wallet_address,
        vault_address=vault_address,
        expected_lamports=expected_lamports,
    )

    donation = {
        "donor_id": str(donor_doc["_id"]),
        "campaign_id": body.campaign_id,
        "amount_sol": body.amount_sol,
        "wallet_address": body.wallet_address,
        "solana_tx": body.solana_tx,
        "tx_signature": body.solana_tx,
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


@app.post("/api/donations/transfer", status_code=status.HTTP_201_CREATED)
async def create_donation_from_transfer(
    body: CreateDonationTransferRequest,
    user: TokenData = Depends(require_donor_role),
):
    donor_doc = await db.users.find_one({"auth0_sub": user.sub})
    if not donor_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if body.amount_sol <= 0:
        raise HTTPException(status_code=400, detail="amount_sol must be greater than zero")

    if not ObjectId.is_valid(body.campaign_id):
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    campaign = await db.campaigns.find_one({"_id": ObjectId(body.campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.get("status") != "active":
        raise HTTPException(status_code=422, detail="Campaign is under review and not accepting donations yet")

    vault_address = campaign.get("vault_address")
    if not vault_address:
        raise HTTPException(status_code=422, detail="Campaign has no vault_address")

    existing = await db.donations.find_one({"solana_tx": body.tx_signature})
    if existing:
        raise HTTPException(status_code=409, detail="This transaction is already recorded")

    expected_lamports = int(round(body.amount_sol * LAMPORTS_PER_SOL))
    if expected_lamports <= 0:
        raise HTTPException(status_code=400, detail="amount_sol is too small")

    tx = await _fetch_transaction(body.tx_signature)
    _verify_donor_to_vault_transfer(
        tx,
        donor_wallet=body.wallet_address,
        vault_address=vault_address,
        expected_lamports=expected_lamports,
    )

    donation = {
        "donor_id": str(donor_doc["_id"]),
        "campaign_id": body.campaign_id,
        "amount_sol": body.amount_sol,
        "wallet_address": body.wallet_address,
        # Keep legacy field + explicit tx_signature field for compatibility.
        "solana_tx": body.tx_signature,
        "tx_signature": body.tx_signature,
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

    logger.info(
        "[DonationTransfer] recorded donor_id=%s campaign_id=%s amount_sol=%.9f wallet=%s tx=%s",
        str(donor_doc["_id"]),
        body.campaign_id,
        body.amount_sol,
        body.wallet_address,
        body.tx_signature,
    )

    out = serialize(donation)
    out["explorer_url"] = _solana_explorer_url(body.tx_signature)
    return out


# ─── Milestones ──────────────────────────────────────────────────────────────

@app.post("/api/campaigns/{campaign_id}/milestones", status_code=status.HTTP_201_CREATED)
async def create_milestone(
    campaign_id: str,
    body: CreateMilestoneRequest,
    user: TokenData = Depends(require_ngo_role),
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
    user: TokenData = Depends(require_ngo_role),
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
    user: TokenData = Depends(require_verifier_role),
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
async def get_verification_queue(user: TokenData = Depends(require_verifier_role)):
    milestones = []
    async for doc in db.milestones.find({"status": "submitted"}):
        milestones.append(serialize(doc))
    return milestones


# ─── Analytics ───────────────────────────────────────────────────────────────

@app.get("/api/analytics/ngo")
async def ngo_analytics(user: TokenData = Depends(require_ngo_role)):
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

async def _provision_wallet(auth0_sub: str, role: str) -> None:
    """Background task: create Privy wallet + airdrop. Non-blocking."""
    try:
        logger.info("[Wallet] provisioning started sub=%s role=%s", auth0_sub, role)
        privy = PrivyClient()
        wallet = await privy.create_embedded_wallet(auth0_sub)
        update: dict = {
            "privy_wallet_id": wallet["wallet_id"],
            "wallet_address": wallet["address"],
        }
        if role == "donor":
            try:
                await privy.request_airdrop(wallet["address"], sol=5.0)
                update["wallet_balance_sol"] = 5.0
                logger.info("[Wallet] airdrop success address=%s amount_sol=5.0", wallet["address"])
            except Exception as e:
                logger.warning("[Wallet] airdrop failed (non-fatal) address=%s error=%s", wallet["address"], str(e))
        db_bg = _get_bg_db()
        await db_bg.users.update_one({"auth0_sub": auth0_sub}, {"$set": update})
        logger.info("[Wallet] provisioning finished sub=%s role=%s address=%s", auth0_sub, role, wallet["address"])
    except Exception as e:
        logger.exception("[Wallet] provisioning failed (non-fatal) sub=%s role=%s error=%s", auth0_sub, role, str(e))


def _get_bg_db():
    """Separate client for background tasks (can't use request-scoped db)."""
    from motor.motor_asyncio import AsyncIOMotorClient as _Client
    c = _Client(MONGO_URL, tls=True, tlsAllowInvalidCertificates=False, serverSelectionTimeoutMS=30000)
    return c[DB_NAME]


@app.put("/api/users/me/role")
async def update_role(
    body: UpdateRoleRequest,
    background_tasks: BackgroundTasks,
    user: TokenData = Depends(get_current_user),
):
    logger.info("[RoleUpdate] sub=%s requested_role=%s", user.sub, body.role)
    if body.role not in ("donor", "ngo"):
        logger.warning("[RoleUpdate] invalid role=%s sub=%s", body.role, user.sub)
        raise HTTPException(status_code=400, detail="Role must be 'donor' or 'ngo'")

    # Save role immediately — do NOT wait for wallet creation
    write_result = await db.users.update_one(
        {"auth0_sub": user.sub},
        {"$set": {"role": body.role}},
    )
    logger.info(
        "[RoleUpdate] role persisted sub=%s matched=%s modified=%s",
        user.sub,
        write_result.matched_count,
        write_result.modified_count,
    )

    # Provision wallet in the background after responding
    existing = await db.users.find_one({"auth0_sub": user.sub})
    if existing and not existing.get("wallet_address"):
        logger.info("[RoleUpdate] scheduling wallet provisioning sub=%s role=%s", user.sub, body.role)
        background_tasks.add_task(_provision_wallet, user.sub, body.role)
    else:
        logger.info("[RoleUpdate] wallet already exists sub=%s", user.sub)

    doc = await db.users.find_one({"auth0_sub": user.sub})
    logger.info("[RoleUpdate] complete sub=%s role=%s", user.sub, doc.get("role") if doc else None)
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
        logger.info("[WS] auth handshake received path=%s token_len=%s", websocket.url.path, len(token))
        decode_token(token)   # raises HTTPException if invalid
        logger.info("[WS] auth handshake success path=%s", websocket.url.path)
        return True
    except asyncio.TimeoutError:
        logger.warning("[WS] auth timeout path=%s", websocket.url.path)
        await websocket.send_text(json.dumps({"error": "auth_timeout"}))
        await websocket.close(code=1008)
        return False
    except Exception as e:
        logger.warning("[WS] auth failed path=%s error=%s", websocket.url.path, str(e))
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
