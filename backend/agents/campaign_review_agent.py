"""
ClearFund Campaign Review Agent
Gemini-based first-pass review for newly launched campaigns.
"""

import asyncio
import json
import os
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_CAMPAIGN_MODEL", "gemini-2.5-pro")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _default_under_review(reason: str) -> dict[str, Any]:
    return {
        "recommendation": "needs_info",
        "confidence_score": 0,
        "trust_score": 25,
        "reasoning": reason,
        "risk_flags": ["campaign_review_unavailable"],
    }


def _review_sync(campaign: dict) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return _default_under_review("Gemini API key is not configured")

    model = genai.GenerativeModel(MODEL_NAME)

    prompt = f"""You are ClearFund's campaign intake reviewer.
Evaluate this campaign for launch readiness and abuse risk.

Return ONLY valid JSON with this exact schema:
{{
  "recommendation": "approve" | "reject" | "needs_info",
  "confidence_score": <integer 0-100>,
  "trust_score": <integer 0-100>,
  "reasoning": "<string at least 30 chars>",
  "risk_flags": ["<string>", "..."]
}}

Campaign:
- title: {campaign.get("title", "")}
- description: {campaign.get("description", "")}
- category: {campaign.get("category", "")}
- ngo_name: {campaign.get("ngo_name", campaign.get("ngo_id", ""))}
- vault_address: {campaign.get("vault_address", "")}

Rules:
- approve only if description is coherent, specific, and not suspicious.
- reject for obvious fraud/spam/abuse.
- needs_info if details are vague but not clearly malicious.
- confidence_score reflects certainty.
- trust_score should be conservative for short/vague campaigns.
"""

    response = model.generate_content(prompt)
    text = (response.text or "").strip()

    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines and lines[-1] == "```" else "\n".join(lines[1:])

    parsed = json.loads(text)

    recommendation = str(parsed.get("recommendation", "needs_info"))
    if recommendation not in {"approve", "reject", "needs_info"}:
        parsed["recommendation"] = "needs_info"

    parsed["confidence_score"] = int(parsed.get("confidence_score", 0))
    parsed["trust_score"] = int(parsed.get("trust_score", 25))
    parsed["reasoning"] = str(parsed.get("reasoning", "No reasoning provided"))
    parsed["risk_flags"] = parsed.get("risk_flags", [])
    if not isinstance(parsed["risk_flags"], list):
        parsed["risk_flags"] = [str(parsed["risk_flags"])]
    return parsed


async def run_campaign_review_agent(campaign: dict) -> dict[str, Any]:
    try:
        return await asyncio.to_thread(_review_sync, campaign)
    except Exception as e:
        return _default_under_review(f"Gemini review failed: {e}")

