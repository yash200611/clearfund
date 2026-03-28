"""
ClearFund Seed Script
Run with: python seed.py

Seeds campaigns and milestones only.
All SOL amounts start at 0 — real on-chain activity drives the numbers.
No fake donations, no fake transaction IDs.
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

# Real devnet vault address — fund with: solana airdrop 2 <address> --url devnet
VAULT_ADDRESS = "2hdLtoGgxfbxqgrVFqNiAy7G14LDyd4ePPHvV8Ti16Vo"

NOW = datetime.now(timezone.utc)


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"[Seed] Connected to {DB_NAME}")

    # ── NGO user (placeholder — gets replaced when real user logs in via Auth0)
    ngo = await db.users.find_one({"role": "ngo"})
    if not ngo:
        result = await db.users.insert_one({
            "email": "ngo@clearfund.app",
            "role": "ngo",
            "auth0_sub": "seed|ngo",
            "privy_wallet_id": None,
            "wallet_address": None,
            "created_at": NOW,
        })
        ngo_id = str(result.inserted_id)
        print("  [User] ngo@clearfund.app — inserted")
    else:
        ngo_id = str(ngo["_id"])
        print("  [User] ngo@clearfund.app — exists")

    # ── Campaigns ─────────────────────────────────────────────────────────────
    campaigns_data = [
        {
            "slug": "rural-health-van",
            "title": "Rural Health Van Project",
            "description": (
                "Deploying 3 mobile medical units to underserved rural communities "
                "in Maharashtra, India. Each van serves 5 villages per week, providing "
                "free consultations, diagnostics, and essential medicines to over "
                "15,000 people who have no access to healthcare facilities."
            ),
            "category": "Healthcare",
            "target_sol": 45.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "HealthForAll Foundation",
            "milestones": [
                {
                    "title": "Vehicle Purchase & Outfitting",
                    "description": (
                        "Purchase 3 second-hand ambulance-grade vans and outfit each "
                        "with a medical examination table, basic diagnostic equipment "
                        "(BP monitor, glucometer, pulse oximeter), a refrigeration unit "
                        "for vaccines, and first aid supplies."
                    ),
                    "amount_sol": 18.0,
                    "due_date": "2025-06-30",
                },
                {
                    "title": "Medical Staff Training",
                    "description": (
                        "Train 12 paramedics and 3 supervising doctors in mobile clinic "
                        "operations, rural triage protocols, and telemedicine. Includes "
                        "a 2-week intensive program run by Apollo Hospital volunteers."
                    ),
                    "amount_sol": 12.0,
                    "due_date": "2025-08-31",
                },
                {
                    "title": "First 90-Day Deployment",
                    "description": (
                        "Launch operations across 15 target villages. Track patient "
                        "visits, diagnoses, and referrals. Provide monthly public "
                        "impact reports with photo evidence submitted on-chain."
                    ),
                    "amount_sol": 15.0,
                    "due_date": "2025-11-30",
                },
            ],
        },
        {
            "slug": "solar-water-pumps",
            "title": "Solar Water Pumps Initiative",
            "description": (
                "Installing solar-powered water pumps in 20 drought-affected villages "
                "in Rajasthan. Each pump replaces 4-6 hours of daily manual water "
                "collection, freeing women and children to attend school and work. "
                "Covers installation, maintenance training, and 1-year warranty support."
            ),
            "category": "Water & Sanitation",
            "target_sol": 30.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "CleanWaterNow",
            "milestones": [
                {
                    "title": "Equipment Procurement & Import",
                    "description": (
                        "Source and import 20 high-efficiency solar pump kits from "
                        "certified manufacturers. Each kit includes solar panels, "
                        "submersible pump, controller, and 500L storage tank. "
                        "Delivery receipts and import docs submitted as evidence."
                    ),
                    "amount_sol": 15.0,
                    "due_date": "2025-07-31",
                },
                {
                    "title": "Installation & Community Training",
                    "description": (
                        "Install all 20 pumps with local contractor teams. Train 2 "
                        "community members per village in basic maintenance. Final "
                        "milestone evidence: geotagged installation photos and signed "
                        "community handover certificates."
                    ),
                    "amount_sol": 15.0,
                    "due_date": "2025-09-30",
                },
            ],
        },
        {
            "slug": "womens-shelter",
            "title": "Women's Shelter Renovation",
            "description": (
                "Renovating a 3,000 sq ft building in Chennai to serve as a full-time "
                "shelter for survivors of domestic violence. Will house 40 women and "
                "children with private rooms, a counselling centre, a skills training "
                "workshop, and a safe play area for children."
            ),
            "category": "Social Services",
            "target_sol": 25.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "SafeHaven Trust",
            "milestones": [
                {
                    "title": "Structural Renovation & Materials",
                    "description": (
                        "Complete all structural work: roof repair, waterproofing, "
                        "electrical rewiring, plumbing, and partition walls for private "
                        "rooms. Evidence: contractor invoices, before/after photos "
                        "with timestamps."
                    ),
                    "amount_sol": 10.0,
                    "due_date": "2025-06-30",
                },
                {
                    "title": "Interior Fit-Out & Furnishing",
                    "description": (
                        "Install beds, mattresses, wardrobes, kitchen appliances, "
                        "counselling room furniture, and children's play equipment. "
                        "Evidence: purchase receipts and installation photos."
                    ),
                    "amount_sol": 10.0,
                    "due_date": "2025-08-31",
                },
                {
                    "title": "Shelter Launch & First Month Operations",
                    "description": (
                        "Open shelter to residents. Provide evidence of first cohort "
                        "admitted (anonymised), staff hired, and first month operations "
                        "report signed by a certified social worker."
                    ),
                    "amount_sol": 5.0,
                    "due_date": "2025-10-31",
                },
            ],
        },
        {
            "slug": "youth-stem-lab",
            "title": "Youth STEM Lab",
            "description": (
                "Equipping a fully functional STEM lab for 200 underprivileged youth "
                "aged 12-18 in Bengaluru. The lab will run weekend coding, robotics, "
                "and electronics workshops taught by volunteer engineers from local "
                "tech companies. Goal: 50 students placed in tech internships by year 2."
            ),
            "category": "Education",
            "target_sol": 20.0,
            "vault_address": VAULT_ADDRESS,
            "ngo_name": "EduFuture",
            "milestones": [
                {
                    "title": "Lab Equipment & Setup",
                    "description": (
                        "Purchase 20 laptops, 10 Arduino/Raspberry Pi robotics kits, "
                        "a 3D printer, networking equipment, and lab furniture. "
                        "Evidence: purchase receipts, delivery photos, and lab "
                        "readiness sign-off from EduFuture director."
                    ),
                    "amount_sol": 12.0,
                    "due_date": "2025-07-31",
                },
                {
                    "title": "Launch Cohort & First 3-Month Program",
                    "description": (
                        "Enrol first cohort of 50 students. Run 12-week program with "
                        "weekly sessions. Evidence: attendance registers, student "
                        "project photos, and end-of-cohort demo day video."
                    ),
                    "amount_sol": 8.0,
                    "due_date": "2025-10-31",
                },
            ],
        },
    ]

    for c in campaigns_data:
        slug = c.pop("slug")
        milestones_def = c.pop("milestones")

        campaign_doc = {
            "ngo_id": ngo_id,
            "title": c["title"],
            "description": c["description"],
            "category": c["category"],
            "target_sol": c["target_sol"],
            "total_raised_sol": 0.0,
            "vault_address": c["vault_address"],
            "ngo_name": c["ngo_name"],
            "status": "active",
            "trust_score": 0.0,
            "failure_count": 0,
            "created_at": NOW - timedelta(days=7),
        }

        result = await db.campaigns.update_one(
            {"title": c["title"]},
            {"$setOnInsert": campaign_doc},
            upsert=True,
        )
        campaign_doc_db = await db.campaigns.find_one({"title": c["title"]})
        campaign_id = str(campaign_doc_db["_id"])
        action = "inserted" if result.upserted_id else "exists"
        print(f"  [Campaign] {c['title']} — {action}")

        for m in milestones_def:
            milestone_doc = {
                "campaign_id": campaign_id,
                "title": m["title"],
                "description": m["description"],
                "amount_sol": m["amount_sol"],
                "due_date": m["due_date"],
                "status": "pending",
                "evidence_urls": [],
                "ai_decision": {},
                "oracle_result": {},
                "solana_tx": None,
                "created_at": NOW - timedelta(days=6),
            }
            result = await db.milestones.update_one(
                {"campaign_id": campaign_id, "title": m["title"]},
                {"$setOnInsert": milestone_doc},
                upsert=True,
            )
            action = "inserted" if result.upserted_id else "exists"
            print(f"    [Milestone] {m['title']} — {action}")

    print("\n[Seed] Done. All SOL balances start at 0 — fund the vault with real devnet SOL.")
    print(f"[Seed] Vault address: {VAULT_ADDRESS}")
    print("[Seed] Run: solana airdrop 2 <vault_address> --url devnet")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
