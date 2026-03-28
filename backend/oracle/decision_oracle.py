"""
ClearFund Decision Oracle
Pure deterministic Python — no AI, no probability.
Validates AI decisions against hard safety rules before any funds move.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


# ─── Hard constants — NOT configurable at runtime ────────────────────────────

MIN_CONFIDENCE: int = 75
MAX_RELEASE_FRACTION: float = 0.40   # no milestone can release >40% of total_raised
MAX_RED_FLAGS: int = 1               # >1 red flag = BLOCKED regardless of score
MIN_DAYS_BETWEEN_RELEASES: int = 3
MAX_DAILY_RELEASE_SOL: float = 50.0


# ─── Types ────────────────────────────────────────────────────────────────────

class OracleVerdict(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BLOCKED  = "BLOCKED"


@dataclass
class OracleResult:
    verdict: OracleVerdict
    reason: str
    checks_passed: list[str] = field(default_factory=list)
    checks_failed: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict.value,
            "reason": self.reason,
            "checks_passed": self.checks_passed,
            "checks_failed": self.checks_failed,
        }


# ─── Oracle ───────────────────────────────────────────────────────────────────

class DecisionOracle:

    @staticmethod
    def evaluate(
        ai_decision: dict,
        milestone: dict,
        campaign: dict,
        last_release_at: Optional[datetime] = None,
    ) -> OracleResult:
        """
        Evaluate an AI decision against hard safety rules.

        Hard blocks return immediately with BLOCKED verdict.
        Soft checks are collected — any failure → REJECTED.
        All soft checks passing → APPROVED.
        """
        passed: list[str] = []
        failed: list[str] = []

        red_flags      = ai_decision.get("red_flags", [])
        amount_sol     = float(milestone.get("amount_sol", 0))
        total_raised   = float(campaign.get("total_raised_sol", 0))
        failure_count  = int(campaign.get("failure_count", 0))
        status         = milestone.get("status", "")
        confidence     = int(ai_decision.get("confidence_score", 0))
        recommendation = ai_decision.get("recommendation", "")
        evidence_qual  = ai_decision.get("evidence_quality", "weak")

        # ── Hard blocks ───────────────────────────────────────────────────────

        if failure_count >= 3:
            return OracleResult(
                verdict=OracleVerdict.BLOCKED,
                reason=f"Campaign is suspended (failure_count={failure_count} >= 3).",
                checks_passed=passed,
                checks_failed=["campaign_not_suspended"],
            )

        if len(red_flags) > MAX_RED_FLAGS:
            return OracleResult(
                verdict=OracleVerdict.BLOCKED,
                reason=f"Too many red flags ({len(red_flags)}). Max allowed: {MAX_RED_FLAGS}.",
                checks_passed=passed,
                checks_failed=["red_flags_within_limit"],
            )

        if status != "submitted":
            return OracleResult(
                verdict=OracleVerdict.BLOCKED,
                reason=f"Milestone status must be 'submitted', got '{status}'.",
                checks_passed=passed,
                checks_failed=["milestone_status_submitted"],
            )

        if total_raised > 0 and (amount_sol / total_raised) > MAX_RELEASE_FRACTION:
            fraction = amount_sol / total_raised
            return OracleResult(
                verdict=OracleVerdict.BLOCKED,
                reason=(
                    f"Release fraction {fraction:.1%} exceeds maximum "
                    f"{MAX_RELEASE_FRACTION:.0%} of total raised."
                ),
                checks_passed=passed,
                checks_failed=["release_fraction_within_limit"],
            )

        # ── Soft checks ───────────────────────────────────────────────────────

        # 1. Confidence score
        if confidence >= MIN_CONFIDENCE:
            passed.append(f"confidence_score ({confidence} >= {MIN_CONFIDENCE})")
        else:
            failed.append(f"confidence_score ({confidence} < {MIN_CONFIDENCE})")

        # 2. Recommendation
        if recommendation == "approve":
            passed.append("recommendation=approve")
        else:
            failed.append(f"recommendation='{recommendation}' (expected 'approve')")

        # 3. Evidence quality
        if evidence_qual in ("strong", "moderate"):
            passed.append(f"evidence_quality={evidence_qual}")
        else:
            failed.append(f"evidence_quality='{evidence_qual}' (need strong or moderate)")

        # 4. Cooldown between releases
        if last_release_at is not None:
            now = datetime.now(timezone.utc)
            if last_release_at.tzinfo is None:
                last_release_at = last_release_at.replace(tzinfo=timezone.utc)
            days_since = (now - last_release_at).days
            if days_since >= MIN_DAYS_BETWEEN_RELEASES:
                passed.append(f"cooldown ({days_since}d >= {MIN_DAYS_BETWEEN_RELEASES}d)")
            else:
                failed.append(
                    f"cooldown ({days_since}d < {MIN_DAYS_BETWEEN_RELEASES}d required)"
                )

        # 5. Amount cap
        if amount_sol <= MAX_DAILY_RELEASE_SOL:
            passed.append(f"amount_sol ({amount_sol} <= {MAX_DAILY_RELEASE_SOL})")
        else:
            failed.append(f"amount_sol ({amount_sol} > {MAX_DAILY_RELEASE_SOL})")

        # ── Verdict ───────────────────────────────────────────────────────────

        if failed:
            return OracleResult(
                verdict=OracleVerdict.REJECTED,
                reason=f"Failed checks: {', '.join(failed)}",
                checks_passed=passed,
                checks_failed=failed,
            )

        return OracleResult(
            verdict=OracleVerdict.APPROVED,
            reason="All safety checks passed.",
            checks_passed=passed,
            checks_failed=[],
        )
