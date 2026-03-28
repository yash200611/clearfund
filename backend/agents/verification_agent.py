"""
ClearFund Verification Agent
Gemini 2.0 Flash with function calling — verifies NGO milestone evidence.
Never receives wallet IDs, private keys, or transaction data.
Never triggers financial actions directly.
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Any

import google.generativeai as genai
import httpx
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

MAX_ROUNDS = 5

# ─── Stub websocket emitter (replaced in Phase 4) ────────────────────────────

def emit_agent_event(milestone_id: str, event_type: str, payload: dict):
    print(f"[WS EVENT] milestone={milestone_id} type={event_type} payload={json.dumps(payload, indent=2)}")


# ─── Tool implementations ─────────────────────────────────────────────────────

async def analyze_image(image_url: str, check_for: str) -> dict:
    """Make a Gemini Vision call to assess image authenticity."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content
            mime_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    except Exception as e:
        return {
            "description": f"Could not fetch image: {str(e)}",
            "authenticity_score": 0,
            "concerns": ["image_unreachable"],
        }

    try:
        vision_model = genai.GenerativeModel("gemini-2.0-flash")
        vision_prompt = f"""Analyze this image for the following context: {check_for}

Assess and respond with ONLY valid JSON in this exact format:
{{
  "description": "what is in the image",
  "authenticity_score": <integer 0-10>,
  "concerns": ["list", "of", "concerns"]
}}

Authenticity score guide:
- 9-10: Clear, unambiguous real evidence with contextual details
- 7-8: Genuine looking, minor uncertainty
- 5-6: Plausible but unverifiable details
- 3-4: Staged or stock-photo appearance
- 0-2: Clearly fabricated, irrelevant, or inaccessible

In your concerns, note: signs of staging, timestamp plausibility,
relevance to claimed milestone, presence of expected objects/people/locations."""

        import PIL.Image
        import io
        image = PIL.Image.open(io.BytesIO(image_bytes))
        response = vision_model.generate_content([vision_prompt, image])
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        return {
            "description": f"Vision analysis failed: {str(e)}",
            "authenticity_score": 3,
            "concerns": ["analysis_error"],
        }


def build_submit_verification_result_schema() -> dict:
    return {
        "name": "submit_verification_result",
        "description": (
            "TERMINAL TOOL — call this as your final action to submit the verification decision. "
            "Once called, the agent loop terminates."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "confidence_score": {
                    "type": "integer",
                    "description": "0-100. Score >= 75 only if evidence is concrete and independently verifiable.",
                },
                "recommendation": {
                    "type": "string",
                    "enum": ["approve", "reject", "needs_info"],
                },
                "reasoning": {
                    "type": "string",
                    "description": "Minimum 50 characters. Explain your decision in detail.",
                },
                "evidence_quality": {
                    "type": "string",
                    "enum": ["strong", "moderate", "weak"],
                },
                "red_flags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List any concerns, inconsistencies, or suspicious elements found.",
                },
                "verified_claims": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Claims that could be independently verified.",
                },
            },
            "required": [
                "confidence_score",
                "recommendation",
                "reasoning",
                "evidence_quality",
                "red_flags",
                "verified_claims",
            ],
        },
    }


def build_analyze_image_schema() -> dict:
    return {
        "name": "analyze_image",
        "description": "Fetch and analyze an image URL using Gemini Vision to assess authenticity and relevance to the milestone.",
        "parameters": {
            "type": "object",
            "properties": {
                "image_url": {
                    "type": "string",
                    "description": "Public URL of the image to analyze.",
                },
                "check_for": {
                    "type": "string",
                    "description": "What to look for in the image (context about the milestone).",
                },
            },
            "required": ["image_url", "check_for"],
        },
    }


# ─── Main agent ───────────────────────────────────────────────────────────────

async def run_verification_agent(milestone: dict, campaign: dict) -> dict:
    milestone_id = milestone.get("id", "unknown")

    system_prompt = """You are ClearFund's Verification Agent — an autonomous AI auditor for a milestone-based escrow donation platform.

Your job: determine if an NGO genuinely completed a milestone before donor funds are released.

RULES:
- You MUST call submit_verification_result as your FINAL action — no exceptions.
- Score >= 75 ONLY if evidence is concrete, specific, and independently verifiable.
- Anything unverifiable scores below 60.
- If you find a red flag, list it explicitly in red_flags.
- Use google_search to verify NGO claims against public records when possible.
- Use analyze_image on every image URL provided.
- Be rigorous. Fabricated or vague evidence should be rejected.
- You do NOT have access to wallet data, transactions, or private information."""

    evidence_urls = milestone.get("evidence_urls", [])
    evidence_str = "\n".join(f"  - {url}" for url in evidence_urls) if evidence_urls else "  (none provided)"

    user_message = f"""Please verify the following milestone completion claim:

CAMPAIGN: {campaign.get('title', 'Unknown')}
NGO: {campaign.get('ngo_name', 'Unknown')}

MILESTONE: {milestone.get('title', 'Unknown')}
CLAIMED COMPLETION: {milestone.get('description', 'No description')}
AMOUNT IN ESCROW: {milestone.get('amount_sol', 0)} SOL
DUE DATE: {milestone.get('due_date', 'Unknown')}

EVIDENCE PROVIDED:
{evidence_str}

Analyze all evidence, search for supporting or contradicting information,
and submit your final verification decision using submit_verification_result."""

    tools = [
        {"google_search": {}},
        build_analyze_image_schema(),
        build_submit_verification_result_schema(),
    ]

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_prompt,
        tools=tools,
    )

    history = []
    history.append({"role": "user", "parts": [user_message]})

    timeout_result = {
        "confidence_score": 0,
        "recommendation": "reject",
        "reasoning": "Agent did not reach a decision within the maximum number of rounds.",
        "evidence_quality": "weak",
        "red_flags": ["agent_timeout"],
        "verified_claims": [],
    }

    for round_num in range(MAX_ROUNDS):
        print(f"\n[Agent] Round {round_num + 1}/{MAX_ROUNDS}")

        response = model.generate_content(history)
        candidate = response.candidates[0]

        # Collect all parts from the response
        assistant_parts = []
        function_calls_found = []

        for part in candidate.content.parts:
            assistant_parts.append(part)
            if hasattr(part, "function_call") and part.function_call:
                function_calls_found.append(part.function_call)

        history.append({"role": "model", "parts": assistant_parts})

        if not function_calls_found:
            # No tool calls — model gave a text response without deciding
            print("[Agent] No function calls in response, forcing termination.")
            return timeout_result

        tool_results = []

        for fc in function_calls_found:
            tool_name = fc.name
            tool_args = dict(fc.args)

            emit_agent_event(milestone_id, "tool_called", {"tool": tool_name, "args": tool_args})

            # ── Terminal tool ──
            if tool_name == "submit_verification_result":
                # Validate required fields
                result = {
                    "confidence_score": int(tool_args.get("confidence_score", 0)),
                    "recommendation": tool_args.get("recommendation", "reject"),
                    "reasoning": tool_args.get("reasoning", ""),
                    "evidence_quality": tool_args.get("evidence_quality", "weak"),
                    "red_flags": list(tool_args.get("red_flags", [])),
                    "verified_claims": list(tool_args.get("verified_claims", [])),
                }
                emit_agent_event(milestone_id, "agent_decision", result)
                return result

            # ── analyze_image ──
            elif tool_name == "analyze_image":
                tool_result = await analyze_image(
                    image_url=tool_args["image_url"],
                    check_for=tool_args["check_for"],
                )
                emit_agent_event(milestone_id, "tool_result", {"tool": tool_name, "result": tool_result})
                tool_results.append({
                    "function_response": {
                        "name": tool_name,
                        "response": tool_result,
                    }
                })

            # ── google_search is handled natively by Gemini grounding ──
            # Its results appear directly in the model response parts
            else:
                print(f"[Agent] Unknown tool called: {tool_name}")

        if tool_results:
            history.append({"role": "user", "parts": tool_results})

    return timeout_result


# ─── Test harness ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    result = asyncio.run(
        run_verification_agent(
            milestone={
                "id": "test-milestone-001",
                "title": "Deployed 3 medical vans",
                "description": "We deployed 3 mobile medical units to rural Maharashtra",
                "evidence_urls": ["https://example.com/photo.jpg"],
                "amount_sol": 2.5,
                "due_date": "2025-01-31",
            },
            campaign={
                "title": "Rural Health Van Project",
                "ngo_name": "HealthForAll Foundation",
            },
        )
    )
    print("\n=== AGENT DECISION ===")
    print(json.dumps(result, indent=2))
