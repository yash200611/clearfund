"""
ClearFund Verification Agent
Gemini 2.5 Pro with function calling — verifies NGO milestone evidence.

Architecture rules (enforced):
- Produces ONLY a structured decision JSON
- Never receives wallet IDs, private keys, or transaction data
- Never triggers any financial action directly
- Max 5 rounds of function calling before forced termination
"""

import asyncio
import io
import json
import os
from typing import Any

import google.generativeai as genai
import httpx
from dotenv import load_dotenv

# Import broker lazily to avoid circular imports when running standalone
try:
    from realtime.broker import manager as _ws_manager
    _HAS_BROKER = True
except ImportError:
    _HAS_BROKER = False

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

MODEL_NAME = "gemini-2.5-pro"
VISION_MODEL_NAME = "gemini-2.5-pro"
MAX_ROUNDS = 5

# ─── WebSocket event emitter ─────────────────────────────────────────────────

async def emit_agent_event(milestone_id: str, event_type: str, payload: dict) -> None:
    print(f"[WS] milestone={milestone_id} event={event_type}")
    if _HAS_BROKER:
        try:
            await _ws_manager.emit(milestone_id, event_type, payload)
        except Exception as e:
            print(f"[WS] Broadcast error: {e}")


# ─── Tool: analyze_image ──────────────────────────────────────────────────────

async def analyze_image(image_url: str, check_for: str) -> dict:
    """Fetch an image and assess it with Gemini Vision."""
    # Fetch the image
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content
            mime_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    except Exception as e:
        return {
            "description": f"Could not fetch image: {e}",
            "authenticity_score": 0,
            "concerns": ["image_unreachable"],
        }

    # Analyze with Gemini Vision
    try:
        import PIL.Image

        image = PIL.Image.open(io.BytesIO(image_bytes))
        vision_model = genai.GenerativeModel(VISION_MODEL_NAME)
        prompt = f"""Analyze this image for the following milestone context: {check_for}

Respond with ONLY valid JSON — no markdown, no explanation:
{{
  "description": "concise description of what is in the image",
  "authenticity_score": <integer 0-10>,
  "concerns": ["list", "of", "specific", "concerns"]
}}

Authenticity score guide:
- 9-10: Clear, unambiguous real evidence with verifiable contextual details
- 7-8: Genuine looking with minor uncertainty
- 5-6: Plausible but key details unverifiable
- 3-4: Staged, stock-photo appearance, or irrelevant
- 0-2: Clearly fabricated, wrong context, or inaccessible

Evaluate: signs of staging, timestamp plausibility, relevance to the
claimed milestone, presence of expected objects/people/locations."""

        response = vision_model.generate_content([prompt, image])
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

        return json.loads(text)

    except Exception as e:
        return {
            "description": f"Vision analysis failed: {e}",
            "authenticity_score": 2,
            "concerns": ["analysis_error", str(e)],
        }


# ─── Tool schemas ─────────────────────────────────────────────────────────────

ANALYZE_IMAGE_DECLARATION = genai.protos.FunctionDeclaration(
    name="analyze_image",
    description=(
        "Fetch and analyze an image URL using Gemini Vision. "
        "Assesses authenticity, relevance to the milestone, and signs of staging."
    ),
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "image_url": genai.protos.Schema(
                type=genai.protos.Type.STRING,
                description="Public URL of the image to analyze.",
            ),
            "check_for": genai.protos.Schema(
                type=genai.protos.Type.STRING,
                description="Context about the milestone — what objects/evidence to look for.",
            ),
        },
        required=["image_url", "check_for"],
    ),
)

SUBMIT_RESULT_DECLARATION = genai.protos.FunctionDeclaration(
    name="submit_verification_result",
    description=(
        "TERMINAL TOOL — call this as your absolute final action. "
        "Submits the structured verification decision and terminates the agent loop."
    ),
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "confidence_score": genai.protos.Schema(
                type=genai.protos.Type.INTEGER,
                description=(
                    "0-100. Score >= 75 ONLY if evidence is concrete and independently verifiable. "
                    "Anything unverifiable must score below 60."
                ),
            ),
            "recommendation": genai.protos.Schema(
                type=genai.protos.Type.STRING,
                enum=["approve", "reject", "needs_info"],
            ),
            "reasoning": genai.protos.Schema(
                type=genai.protos.Type.STRING,
                description="Minimum 50 characters. Detailed explanation of the decision.",
            ),
            "evidence_quality": genai.protos.Schema(
                type=genai.protos.Type.STRING,
                enum=["strong", "moderate", "weak"],
            ),
            "red_flags": genai.protos.Schema(
                type=genai.protos.Type.ARRAY,
                items=genai.protos.Schema(type=genai.protos.Type.STRING),
                description="Any concerns, inconsistencies, or suspicious elements found.",
            ),
            "verified_claims": genai.protos.Schema(
                type=genai.protos.Type.ARRAY,
                items=genai.protos.Schema(type=genai.protos.Type.STRING),
                description="Specific claims that were independently verified.",
            ),
        },
        required=[
            "confidence_score",
            "recommendation",
            "reasoning",
            "evidence_quality",
            "red_flags",
            "verified_claims",
        ],
    ),
)

# Tool 1: Google Search grounding (handled natively by Gemini)
GOOGLE_SEARCH_TOOL = genai.protos.Tool(
    google_search_retrieval=genai.protos.GoogleSearchRetrieval()
)

# Tools 2 & 3: Function declarations we execute manually
FUNCTION_TOOLS = genai.protos.Tool(
    function_declarations=[ANALYZE_IMAGE_DECLARATION, SUBMIT_RESULT_DECLARATION]
)


# ─── Main agent ───────────────────────────────────────────────────────────────

async def run_verification_agent(milestone: dict, campaign: dict) -> dict:
    milestone_id = str(milestone.get("id", milestone.get("_id", "unknown")))

    await emit_agent_event(milestone_id, "agent_started", {
        "milestone_title": milestone.get("title", ""),
        "campaign_name":   campaign.get("title", ""),
    })

    system_prompt = """You are ClearFund's Verification Agent — an autonomous AI auditor for a milestone-based escrow donation platform.

Your job: determine if an NGO genuinely completed a milestone before donor funds are released from escrow.

STRICT RULES:
- You MUST call submit_verification_result as your ABSOLUTE FINAL action — no exceptions.
- Score >= 75 ONLY if evidence is concrete, specific, and independently verifiable.
- Anything that cannot be independently verified must score below 60.
- If you find any red flag, list it explicitly in red_flags.
- Use google_search to cross-check NGO claims against public records, news, or official registries.
- Call analyze_image on EVERY image URL provided — do not skip any.
- Be rigorous. Vague, staged, or unverifiable evidence = rejection.
- You do NOT have access to wallet addresses, private keys, or transaction data. Do not ask for them."""

    evidence_urls = milestone.get("evidence_urls", [])
    evidence_str = (
        "\n".join(f"  - {url}" for url in evidence_urls)
        if evidence_urls
        else "  (no evidence provided)"
    )

    user_message = f"""Please verify the following milestone completion claim:

CAMPAIGN: {campaign.get('title', 'Unknown')}
NGO: {campaign.get('ngo_name', campaign.get('ngo_id', 'Unknown'))}

MILESTONE TITLE: {milestone.get('title', 'Unknown')}
CLAIMED COMPLETION: {milestone.get('description', 'No description provided')}
AMOUNT IN ESCROW: {milestone.get('amount_sol', 0)} SOL
DUE DATE: {milestone.get('due_date', 'Unknown')}

EVIDENCE PROVIDED:
{evidence_str}

Steps:
1. Search for public information about this NGO and their claimed work
2. Analyze every image URL provided using analyze_image
3. Assess overall credibility and cross-reference all findings
4. Submit your final verdict using submit_verification_result"""

    timeout_result = {
        "confidence_score": 0,
        "recommendation": "reject",
        "reasoning": "Agent did not reach a decision within the maximum number of rounds. Manual review required.",
        "evidence_quality": "weak",
        "red_flags": ["agent_timeout"],
        "verified_claims": [],
    }

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=system_prompt,
        tools=[GOOGLE_SEARCH_TOOL, FUNCTION_TOOLS],
    )

    chat = model.start_chat(history=[])

    for round_num in range(MAX_ROUNDS):
        print(f"\n[Agent] ── Round {round_num + 1}/{MAX_ROUNDS} ──")

        # Send user message on round 0, otherwise the chat already has context
        if round_num == 0:
            response = chat.send_message(user_message)
        else:
            # Response was already sent at bottom of previous round via function results
            # This branch is only reached if we looped without sending — shouldn't happen
            break

        # Process all rounds via function call handling below
        while True:
            candidate = response.candidates[0]
            parts = candidate.content.parts

            function_calls = [p.function_call for p in parts if hasattr(p, "function_call") and p.function_call.name]

            if not function_calls:
                # Model returned text with no function calls — no decision reached
                print(f"[Agent] No function calls in round {round_num + 1}, forcing termination.")
                return timeout_result

            function_responses = []

            for fc in function_calls:
                tool_name = fc.name
                tool_args = dict(fc.args)

                await emit_agent_event(milestone_id, "tool_called", {"tool": tool_name, "args": tool_args})

                # ── Terminal tool ─────────────────────────────────────────
                if tool_name == "submit_verification_result":
                    result = {
                        "confidence_score": int(tool_args.get("confidence_score", 0)),
                        "recommendation": tool_args.get("recommendation", "reject"),
                        "reasoning": tool_args.get("reasoning", ""),
                        "evidence_quality": tool_args.get("evidence_quality", "weak"),
                        "red_flags": list(tool_args.get("red_flags", [])),
                        "verified_claims": list(tool_args.get("verified_claims", [])),
                    }
                    await emit_agent_event(milestone_id, "agent_decision", result)
                    return result

                # ── analyze_image ─────────────────────────────────────────
                elif tool_name == "analyze_image":
                    tool_result = await analyze_image(
                        image_url=tool_args["image_url"],
                        check_for=tool_args["check_for"],
                    )
                    await emit_agent_event(milestone_id, "tool_result", {"tool": tool_name, "result": tool_result})
                    function_responses.append(
                        genai.protos.Part(
                            function_response=genai.protos.FunctionResponse(
                                name=tool_name,
                                response={"result": tool_result},
                            )
                        )
                    )

                # ── google_search is grounded natively — no manual handling ──
                else:
                    print(f"[Agent] Native tool response for: {tool_name}")

            # Send function results back and get next response
            if function_responses:
                round_num += 1
                if round_num >= MAX_ROUNDS:
                    print("[Agent] Max rounds reached.")
                    return timeout_result
                print(f"\n[Agent] ── Round {round_num + 1}/{MAX_ROUNDS} ──")
                response = chat.send_message(function_responses)
            else:
                # Only grounding tools were called (google_search) — model will continue
                # Gemini returns the next response inline, no need to re-send
                break

        break  # Exit outer loop after inner while handles all rounds

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
