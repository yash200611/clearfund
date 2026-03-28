"""
ClearFund Seed Script
Run with: python seed.py

Seeds test users, campaigns, milestones, and donations.
Uses upsert logic — safe to run multiple times without duplicates.
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "clearfund")

# Devnet vault address (Phase 0 keypair)
VAULT_ADDRESS = "2hdLtoGgxfbxqgrVFqNiAy7G14LDyd4ePPHvV8Ti16Vo"

NOW = datetime.now(timezone.utc)


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"[Seed] Connected to {DB_NAME}")

    # ── Users ────────────────────────────────────────────────────────────────
    users_data = [
        {
            "email": "donor@clearfund.app",
            "role": "donor",
            "auth0_sub": "seed|donor",
            "privy_wallet_id": None,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "created_at": NOW,
        },
        {
            "email": "ngo@clearfund.app",
            "role": "ngo",
            "auth0_sub": "seed|ngo",
            "privy_wallet_id": None,
            "wallet_address": "NgoWa11etAddressFakeForSeedData222222222222",
            "created_at": NOW,
        },
        {
            "email": "admin@clearfund.app",
            "role": "admin",
            "auth0_sub": "seed|admin",
            "privy_wallet_id": None,
            "wallet_address": None,
            "created_at": NOW,
        },
    ]

    user_ids = {}
    for u in users_data:
        result = await db.users.update_one(
            {"auth0_sub": u["auth0_sub"]},
            {"$setOnInsert": u},
            upsert=True,
        )
        doc = await db.users.find_one({"auth0_sub": u["auth0_sub"]})
        user_ids[u["role"]] = str(doc["_id"])
        action = "inserted" if result.upserted_id else "exists"
        print(f"  [User] {u['email']} ({u['role']}) — {action}")

    ngo_id = user_ids["ngo"]
    donor_id = user_ids["donor"]

    # ── Campaigns ────────────────────────────────────────────────────────────
    campaigns_data = [
        {
            "slug": "rural-health-van",
            "ngo_id": ngo_id,
            "title": "Rural Health Van Project",
            "description": "Deploying mobile medical units to underserved rural communities in Maharashtra.",
            "category": "Healthcare",
            "total_raised_sol": 45.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "HealthForAll Foundation",
            "status": "active",
            "trust_score": 82.0,
            "failure_count": 0,
            "created_at": NOW - timedelta(days=60),
        },
        {
            "slug": "solar-water-pumps",
            "ngo_id": ngo_id,
            "title": "Solar Water Pumps Initiative",
            "description": "Installing solar-powered water pumps in drought-affected villages.",
            "category": "Water & Sanitation",
            "total_raised_sol": 30.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "CleanWaterNow",
            "status": "active",
            "trust_score": 70.0,
            "failure_count": 0,
            "created_at": NOW - timedelta(days=45),
        },
        {
            "slug": "womens-shelter",
            "ngo_id": ngo_id,
            "title": "Women's Shelter Renovation",
            "description": "Renovating and furnishing a shelter for survivors of domestic violence.",
            "category": "Social Services",
            "total_raised_sol": 25.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "SafeHaven Trust",
            "status": "active",
            "trust_score": 75.0,
            "failure_count": 0,
            "created_at": NOW - timedelta(days=30),
        },
        {
            "slug": "youth-stem-lab",
            "ngo_id": ngo_id,
            "title": "Youth STEM Lab",
            "description": "Equipping a STEM lab for underprivileged youth to learn coding and robotics.",
            "category": "Education",
            "total_raised_sol": 20.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "EduFuture",
            "status": "active",
            "trust_score": 68.0,
            "failure_count": 0,
            "created_at": NOW - timedelta(days=20),
        },
    ]

    campaign_ids = {}
    for c in campaigns_data:
        slug = c.pop("slug")
        result = await db.campaigns.update_one(
            {"title": c["title"]},
            {"$setOnInsert": c},
            upsert=True,
        )
        doc = await db.campaigns.find_one({"title": c["title"]})
        campaign_ids[slug] = str(doc["_id"])
        action = "inserted" if result.upserted_id else "exists"
        print(f"  [Campaign] {c['title']} — {action}")

    # ── Milestones ────────────────────────────────────────────────────────────
    milestones_data = [
        # Rural Health Van
        {
            "campaign_slug": "rural-health-van",
            "title": "Vehicle Purchase",
            "description": "Purchased 3 mobile medical vans",
            "amount_sol": 18.0,
            "due_date": "2025-03-31",
            "status": "released",
            "evidence_urls": [],
            "ai_decision": {"confidence_score": 87, "recommendation": "approve"},
            "oracle_result": {"verdict": "approved", "reason": "Evidence verified"},
            "solana_tx": "demo_tx_1",
            "released_at": NOW - timedelta(days=40),
            "created_at": NOW - timedelta(days=55),
        },
        {
            "campaign_slug": "rural-health-van",
            "title": "Staff Training",
            "description": "Trained 12 paramedics for mobile clinic operations",
            "amount_sol": 12.0,
            "due_date": "2025-05-31",
            "status": "submitted",
            "evidence_urls": ["https://picsum.photos/800/600?random=1"],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=10),
        },
        {
            "campaign_slug": "rural-health-van",
            "title": "First Deployment",
            "description": "Begin operations in 5 target villages",
            "amount_sol": 15.0,
            "due_date": "2025-07-31",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=5),
        },
        # Solar Water Pumps
        {
            "campaign_slug": "solar-water-pumps",
            "title": "Equipment Import",
            "description": "Import solar pumps and installation materials",
            "amount_sol": 15.0,
            "due_date": "2025-06-30",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=40),
        },
        {
            "campaign_slug": "solar-water-pumps",
            "title": "Installation",
            "description": "Install pumps in 20 villages",
            "amount_sol": 15.0,
            "due_date": "2025-08-31",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=38),
        },
        # Women's Shelter
        {
            "campaign_slug": "womens-shelter",
            "title": "Materials",
            "description": "Purchase construction materials",
            "amount_sol": 10.0,
            "due_date": "2025-02-28",
            "status": "released",
            "evidence_urls": [],
            "ai_decision": {"confidence_score": 79, "recommendation": "approve"},
            "oracle_result": {"verdict": "approved", "reason": "Evidence verified"},
            "solana_tx": "demo_tx_2",
            "released_at": NOW - timedelta(days=20),
            "created_at": NOW - timedelta(days=28),
        },
        {
            "campaign_slug": "womens-shelter",
            "title": "Construction",
            "description": "Complete structural renovations",
            "amount_sol": 10.0,
            "due_date": "2025-04-30",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=25),
        },
        {
            "campaign_slug": "womens-shelter",
            "title": "Furnishing",
            "description": "Furnish and equip shelter rooms",
            "amount_sol": 5.0,
            "due_date": "2025-05-31",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=22),
        },
        # STEM Lab
        {
            "campaign_slug": "youth-stem-lab",
            "title": "Equipment",
            "description": "Purchase computers, robotics kits, and lab furniture",
            "amount_sol": 12.0,
            "due_date": "2025-06-30",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=18),
        },
        {
            "campaign_slug": "youth-stem-lab",
            "title": "Launch Event",
            "description": "Host opening ceremony and first training cohort",
            "amount_sol": 8.0,
            "due_date": "2025-07-31",
            "status": "pending",
            "evidence_urls": [],
            "ai_decision": {},
            "oracle_result": {},
            "solana_tx": None,
            "created_at": NOW - timedelta(days=16),
        },
    ]

    milestone_ids = {}
    for m in milestones_data:
        slug = m.pop("campaign_slug")
        campaign_id = campaign_ids[slug]
        m["campaign_id"] = campaign_id

        result = await db.milestones.update_one(
            {"campaign_id": campaign_id, "title": m["title"]},
            {"$setOnInsert": m},
            upsert=True,
        )
        action = "inserted" if result.upserted_id else "exists"
        print(f"  [Milestone] {m['title']} ({slug}) — {action}")

        doc = await db.milestones.find_one({"campaign_id": campaign_id, "title": m["title"]})
        milestone_ids[f"{slug}_{m['title']}"] = str(doc["_id"])

    # ── Donations ────────────────────────────────────────────────────────────
    donations_data = [
        # Rural Health Van — 18 SOL released, 12 locked (staff training submitted), 15 pending
        {
            "campaign_slug": "rural-health-van",
            "donor_id": donor_id,
            "amount_sol": 20.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_1",
            "released_sol": 8.0,
            "locked_sol": 12.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=58),
        },
        {
            "campaign_slug": "rural-health-van",
            "donor_id": donor_id,
            "amount_sol": 15.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_2",
            "released_sol": 5.0,
            "locked_sol": 10.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=50),
        },
        {
            "campaign_slug": "rural-health-van",
            "donor_id": donor_id,
            "amount_sol": 10.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_3",
            "released_sol": 5.0,
            "locked_sol": 5.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=45),
        },
        # Solar Water Pumps
        {
            "campaign_slug": "solar-water-pumps",
            "donor_id": donor_id,
            "amount_sol": 15.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_4",
            "released_sol": 0.0,
            "locked_sol": 15.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=43),
        },
        {
            "campaign_slug": "solar-water-pumps",
            "donor_id": donor_id,
            "amount_sol": 15.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_5",
            "released_sol": 0.0,
            "locked_sol": 15.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=40),
        },
        # Women's Shelter — 10 SOL released
        {
            "campaign_slug": "womens-shelter",
            "donor_id": donor_id,
            "amount_sol": 25.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_6",
            "released_sol": 10.0,
            "locked_sol": 15.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=28),
        },
        # STEM Lab
        {
            "campaign_slug": "youth-stem-lab",
            "donor_id": donor_id,
            "amount_sol": 12.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_7",
            "released_sol": 0.0,
            "locked_sol": 12.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=18),
        },
        {
            "campaign_slug": "youth-stem-lab",
            "donor_id": donor_id,
            "amount_sol": 8.0,
            "wallet_address": "DonorWa11etAddressFakeForSeedData111111111",
            "solana_tx": "donor_tx_8",
            "released_sol": 0.0,
            "locked_sol": 8.0,
            "refunded_sol": 0.0,
            "created_at": NOW - timedelta(days=15),
        },
    ]

    for d in donations_data:
        slug = d.pop("campaign_slug")
        campaign_id = campaign_ids[slug]
        d["campaign_id"] = campaign_id

        result = await db.donations.update_one(
            {"campaign_id": campaign_id, "solana_tx": d["solana_tx"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        action = "inserted" if result.upserted_id else "exists"
        print(f"  [Donation] {d['amount_sol']} SOL → {slug} ({d['solana_tx']}) — {action}")

    print("\n[Seed] Done.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
