"""
Oracle unit tests — every hard rule and soft check covered.
Run with: pytest backend/tests/test_oracle.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone, timedelta
from oracle.decision_oracle import DecisionOracle, OracleVerdict


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def good_ai_decision(**overrides) -> dict:
    base = {
        "confidence_score": 80,
        "recommendation":   "approve",
        "evidence_quality": "strong",
        "red_flags":        [],
        "verified_claims":  ["3 vans photographed", "registration confirmed"],
    }
    return {**base, **overrides}


def good_milestone(**overrides) -> dict:
    base = {
        "amount_sol": 5.0,
        "status":     "submitted",
    }
    return {**base, **overrides}


def good_campaign(**overrides) -> dict:
    base = {
        "total_raised_sol": 20.0,
        "failure_count":    0,
    }
    return {**base, **overrides}


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_approved_normal_case():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(),
        campaign=good_campaign(),
        last_release_at=None,
    )
    assert result.verdict == OracleVerdict.APPROVED
    assert result.checks_failed == []
    assert len(result.checks_passed) >= 3


def test_blocked_too_many_red_flags():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(red_flags=["no_receipts", "wrong_location", "date_mismatch"]),
        milestone=good_milestone(),
        campaign=good_campaign(),
    )
    assert result.verdict == OracleVerdict.BLOCKED
    assert "red_flags_within_limit" in result.checks_failed


def test_blocked_amount_too_large():
    # 5 SOL out of 10 SOL total = 50% > 40% max
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(amount_sol=5.0),
        campaign=good_campaign(total_raised_sol=10.0),
    )
    assert result.verdict == OracleVerdict.BLOCKED
    assert "release_fraction_within_limit" in result.checks_failed


def test_blocked_suspended_campaign():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(),
        campaign=good_campaign(failure_count=3),
    )
    assert result.verdict == OracleVerdict.BLOCKED
    assert "campaign_not_suspended" in result.checks_failed


def test_blocked_wrong_milestone_status():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(status="pending"),
        campaign=good_campaign(),
    )
    assert result.verdict == OracleVerdict.BLOCKED
    assert "milestone_status_submitted" in result.checks_failed


def test_rejected_low_confidence():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(confidence_score=60),
        milestone=good_milestone(),
        campaign=good_campaign(),
    )
    assert result.verdict == OracleVerdict.REJECTED
    assert any("confidence_score" in f for f in result.checks_failed)


def test_rejected_recommendation_not_approve():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(recommendation="needs_info"),
        milestone=good_milestone(),
        campaign=good_campaign(),
    )
    assert result.verdict == OracleVerdict.REJECTED
    assert any("recommendation" in f for f in result.checks_failed)


def test_rejected_weak_evidence():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(evidence_quality="weak"),
        milestone=good_milestone(),
        campaign=good_campaign(),
    )
    assert result.verdict == OracleVerdict.REJECTED
    assert any("evidence_quality" in f for f in result.checks_failed)


def test_rejected_cooldown_violation():
    recent = datetime.now(timezone.utc) - timedelta(days=1)  # only 1 day ago
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(),
        campaign=good_campaign(),
        last_release_at=recent,
    )
    assert result.verdict == OracleVerdict.REJECTED
    assert any("cooldown" in f for f in result.checks_failed)


def test_approved_cooldown_just_met():
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(),
        campaign=good_campaign(),
        last_release_at=three_days_ago,
    )
    assert result.verdict == OracleVerdict.APPROVED


def test_rejected_amount_exceeds_daily_cap():
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(),
        milestone=good_milestone(amount_sol=51.0),
        campaign=good_campaign(total_raised_sol=200.0),
    )
    assert result.verdict == OracleVerdict.REJECTED
    assert any("amount_sol" in f for f in result.checks_failed)


def test_one_red_flag_allowed():
    # Exactly 1 red flag should NOT block
    result = DecisionOracle.evaluate(
        ai_decision=good_ai_decision(red_flags=["minor_concern"]),
        milestone=good_milestone(),
        campaign=good_campaign(),
    )
    # Should not be BLOCKED (may be REJECTED for other reasons, but not red flags)
    assert result.verdict != OracleVerdict.BLOCKED or "red_flags" not in str(result.checks_failed)
