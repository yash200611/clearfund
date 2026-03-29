"""
ClearFund Campaign Review Agent
Gemini-based first-pass review for newly launched campaigns.
"""

import asyncio
import json
import os
import logging
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("clearfund.campaign_review")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_CAMPAIGN_MODEL", "gemini-2.5-flash")

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
        logger.warning("[CampaignReviewAgent] GEMINI_API_KEY is missing")
        return _default_under_review("Gemini API key is not configured")

    logger.info(
        "[CampaignReviewAgent] running model=%s title=%s",
        MODEL_NAME,
        campaign.get("title", ""),
    )
    model = genai.GenerativeModel(MODEL_NAME)

    prompt = f"""You are ClearFund's campaign intake reviewer.
Evaluate this campaign for launch readiness, credibility, and abuse risk.

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
- vault_address: {campaign.get("vault_address", "")}

Evaluation Framework:

Positive Trust Signals (increase score significantly):
- Clear, structured purpose with defined outcomes (e.g., diagnosis, treatment phases)
- Mentions of transparency, verification, or accountability mechanisms
- Real-world grounding (healthcare context, NGOs, patient support)
- Professional tone (not emotional manipulation or vague appeals)
- Presence of a vault_address (strong trust signal)
- Specificity in how funds will be used

Negative Signals (decrease score):
- Vague or generic descriptions ("help people", "support cause")
- Emotional manipulation without details
- Missing key fields (especially vault_address)
- Unrealistic claims or unclear fund usage

Scoring Rules:
- trust_score (0–100):
  - 90–100 → highly credible, structured, verifiable, strong transparency signals
  - 75–89 → good but missing some structure or verification clarity
  - 50–74 → vague or partially defined
  - <50 → suspicious, weak, or unclear

- confidence_score reflects certainty in your evaluation.

Decision Rules:
- approve if strong positive signals outweigh risks
- reject if clear fraud/spam/abuse indicators exist
- needs_info if moderately vague but not malicious

Important:
- Bias toward HIGH trust_score when strong structure + transparency signals are present.
- Do NOT be overly conservative if the campaign is well-defined and credible.
"""

    response = model.generate_content(prompt)
    text = (response.text or "").strip()
    logger.info("[CampaignReviewAgent] raw response length=%s", len(text))

    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines and lines[-1] == "```" else "\n".join(lines[1:])

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(
            "[CampaignReviewAgent] JSON parse failed error=%s preview=%s",
            str(e),
            text[:240],
        )
        raise

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
        logger.exception("[CampaignReviewAgent] review failed error=%s", str(e))
        return _default_under_review(f"Gemini review failed: {e}")
