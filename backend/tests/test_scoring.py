"""Tests for normalization, Composite Maintenance Debt Index (CMDI), boundaries, and explainability."""

import math
import pytest
from app.analyzer.scoring import (
    normalize_indicator_risks,
    compute_cmdi_summary,
    determine_risk_tier,
    build_indicator_scores,
    resolve_indicator_severity,
    construct_evidence_based_interpretation,
    BASE_INDICATOR_WEIGHTS,
    CMDI_DISCLAIMER,
)
from app.models.schemas import ScoringBreakdown, IndicatorBreakdown, MaintainabilitySummary


def test_equal_25_percent_indicator_weights():
    """Verify that the 4 indicators are balanced at equal 25% base weights."""
    assert BASE_INDICATOR_WEIGHTS["complexity_risk"] == 0.25
    assert BASE_INDICATOR_WEIGHTS["duplication_risk"] == 0.25
    assert BASE_INDICATOR_WEIGHTS["coupling_risk"] == 0.25
    assert BASE_INDICATOR_WEIGHTS["error_handling_risk"] == 0.25
    assert sum(BASE_INDICATOR_WEIGHTS.values()) == 1.0


def test_normalization_bounds():
    """Verify standard measurements normalize into [0.0, 100.0]."""
    risks = normalize_indicator_risks(
        max_complexity=38,
        duplication_percent=14.8,
        circular_cycles_count=2,
        max_afferent_coupling=12,
        error_adherence_score=71,
    )

    for k, v in risks.items():
        assert v is not None
        assert 0.0 <= v <= 100.0


def test_normalization_clamping_and_extremes():
    """Verify extreme and boundary inputs are strictly clamped between 0.0 and 100.0."""
    # Under-threshold inputs -> 0.0 risk
    low_risks = normalize_indicator_risks(
        max_complexity=5,
        duplication_percent=0.0,
        circular_cycles_count=0,
        max_afferent_coupling=0,
        error_adherence_score=100,
    )
    assert low_risks["complexity_risk"] == 0.0
    assert low_risks["duplication_risk"] == 0.0
    assert low_risks["coupling_risk"] == 0.0
    assert low_risks["error_handling_risk"] == 0.0

    # Negative inputs -> clamped to 0.0 or 100.0 appropriately
    neg_risks = normalize_indicator_risks(
        max_complexity=-10,
        duplication_percent=-5.0,
        circular_cycles_count=-2,
        max_afferent_coupling=-10,
        error_adherence_score=120,
    )
    assert neg_risks["complexity_risk"] == 0.0
    assert neg_risks["duplication_risk"] == 0.0
    assert neg_risks["coupling_risk"] == 0.0
    assert neg_risks["error_handling_risk"] == 0.0

    # Over-threshold inputs -> clamped to 100.0 max
    high_risks = normalize_indicator_risks(
        max_complexity=120,
        duplication_percent=85.0,
        circular_cycles_count=10,
        max_afferent_coupling=50,
        error_adherence_score=-15,
    )
    assert high_risks["complexity_risk"] == 100.0
    assert high_risks["duplication_risk"] == 100.0
    assert high_risks["coupling_risk"] == 100.0
    assert high_risks["error_handling_risk"] == 100.0


def test_invalid_and_non_finite_inputs():
    """Verify NaN, inf, -inf, and invalid strings do not raise exceptions and return None."""
    risks = normalize_indicator_risks(
        max_complexity=float("nan"),
        duplication_percent=float("inf"),
        circular_cycles_count="not_a_number",
        max_afferent_coupling=None,
        error_adherence_score=float("-inf"),
    )
    assert risks["complexity_risk"] is None
    assert risks["duplication_risk"] is None
    assert risks["coupling_risk"] is None
    assert risks["error_handling_risk"] is None


def test_cmdi_exact_category_boundaries():
    """Test exact boundary values specified: 0, 25, 26, 50, 51, 75, 76, 100, and transitions."""
    test_cases = [
        # (score, expected_category, expected_severity)
        (0.0, "Low Risk", "success"),
        (10.5, "Low Risk", "success"),
        (25.0, "Low Risk", "success"),
        (25.1, "Moderate Risk", "info"),
        (26.0, "Moderate Risk", "info"),
        (35.0, "Moderate Risk", "info"),
        (50.0, "Moderate Risk", "info"),
        (50.1, "High Risk", "medium"),
        (51.0, "High Risk", "medium"),
        (65.0, "High Risk", "medium"),
        (75.0, "High Risk", "medium"),
        (75.1, "Critical Risk", "critical"),
        (76.0, "Critical Risk", "critical"),
        (90.0, "Critical Risk", "critical"),
        (100.0, "Critical Risk", "critical"),
    ]

    for score, exp_cat, exp_sev in test_cases:
        cat, sev = determine_risk_tier(score)
        assert cat == exp_cat, f"Score {score} expected {exp_cat}, got {cat}"
        assert sev == exp_sev, f"Score {score} expected severity {exp_sev}, got {sev}"

    # Out of bounds clamping checks
    cat_neg, sev_neg = determine_risk_tier(-25.0)
    assert cat_neg == "Low Risk"
    assert sev_neg == "success"

    cat_over, sev_over = determine_risk_tier(150.0)
    assert cat_over == "Critical Risk"
    assert sev_over == "critical"

    cat_none, sev_none = determine_risk_tier(None)
    assert cat_none == "Not Available"
    assert sev_none == "info"


def test_clean_low_risk_summary():
    clean_risks = {
        "complexity_risk": 0.0,
        "duplication_risk": 0.0,
        "coupling_risk": 0.0,
        "error_handling_risk": 0.0,
    }
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(clean_risks, 0, 0)
    assert cmdi == 0.0
    assert tier == "Low Risk"
    assert severity == "success"
    assert hours == 0
    assert breakdown.score_available is True
    assert not breakdown.is_dynamically_weighted
    assert breakdown.primary_risk_driver == "None (No significant debt detected)"
    for ind in breakdown.indicators:
        assert ind.contribution == 0.0
        assert ind.contribution_percentage == 0.0


def test_high_risk_summary():
    high_risks = {
        "complexity_risk": 84.0,
        "duplication_risk": 60.0,
        "coupling_risk": 74.0,
        "error_handling_risk": 40.0,
    }
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(high_risks, 18, 3)
    # Expected: (84*0.25) + (60*0.25) + (74*0.25) + (40*0.25) = 21 + 15 + 18.5 + 10 = 64.5
    assert cmdi == 64.5
    assert tier == "High Risk"
    assert severity == "medium"
    assert hours > 0
    assert not breakdown.is_dynamically_weighted
    assert "Cyclomatic Complexity" in breakdown.primary_risk_driver


def test_missing_single_indicator_dynamic_reweighting():
    """Verify that when 1 indicator is missing (None), dynamic reweighting reallocates weight fairly."""
    partial_risks = {
        "complexity_risk": 60.0,
        "duplication_risk": None,  # Unsupported / unmeasurable
        "coupling_risk": 60.0,
        "error_handling_risk": 60.0,
    }
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(partial_risks, 5, 1)

    # 3 available indicators, each gets effective weight 1/3 (~0.333)
    # CMDI = 60*(1/3) + 60*(1/3) + 60*(1/3) = 60.0
    assert cmdi == 60.0
    assert tier == "High Risk"
    assert breakdown.is_dynamically_weighted is True
    assert "Dynamic reweighting applied" in breakdown.formula_expression
    assert "not directly equivalent" in breakdown.formula_expression.lower()

    # Check indicator statuses
    dupl_ind = next(ind for ind in breakdown.indicators if ind.id == "duplication")
    assert dupl_ind.classification == "UNAVAILABLE"
    assert dupl_ind.raw_metric == "Not available"
    assert dupl_ind.normalized_risk is None
    assert dupl_ind.contribution == 0.0
    assert dupl_ind.effective_weight == 0.0

    comp_ind = next(ind for ind in breakdown.indicators if ind.id == "complexity")
    assert comp_ind.classification == "MEASURED"
    assert comp_ind.effective_weight == 0.333
    assert comp_ind.contribution == 20.0


def test_all_missing_indicators_produces_none_cmdi_and_no_contributions():
    """Verify that when all indicators are missing, CMDI is None, score_available=False, and no contributions exist."""
    empty_risks = {
        "complexity_risk": None,
        "duplication_risk": None,
        "coupling_risk": None,
        "error_handling_risk": None,
    }
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(empty_risks, 0, 0)
    assert cmdi is None
    assert tier == "Not Available"
    assert severity == "info"
    assert breakdown.score_available is False
    assert breakdown.formula_expression == "No measurable indicators available to compute CMDI"
    assert "Insufficient metric data" in interp
    for ind in breakdown.indicators:
        assert ind.contribution == 0.0
        assert ind.contribution_percentage == 0.0
        assert ind.effective_weight == 0.0
        assert ind.classification == "UNAVAILABLE"


def test_weighted_contributions_and_percentages_sum():
    """Verify that individual contributions sum to CMDI and percentage shares sum to ~100%."""
    risks = {
        "complexity_risk": 40.0,
        "duplication_risk": 20.0,
        "coupling_risk": 30.0,
        "error_handling_risk": 10.0,
    }
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(risks, 2, 1)
    # CMDI = (40*0.25) + (20*0.25) + (30*0.25) + (10*0.25) = 10 + 5 + 7.5 + 2.5 = 25.0
    assert cmdi == 25.0
    assert tier == "Low Risk"

    contrib_sum = sum(ind.contribution for ind in breakdown.indicators)
    assert abs(contrib_sum - cmdi) < 0.1

    pct_sum = sum(ind.contribution_percentage for ind in breakdown.indicators)
    assert abs(pct_sum - 100.0) < 0.5


def test_scoring_determinism():
    """Verify identical inputs produce the exact same score across repeated executions."""
    fixed_risks = {
        "complexity_risk": 55.4,
        "duplication_risk": 18.2,
        "coupling_risk": 42.0,
        "error_handling_risk": 30.0,
    }

    baseline = compute_cmdi_summary(fixed_risks, 10, 2)
    for _ in range(50):
        run_res = compute_cmdi_summary(fixed_risks, 10, 2)
        assert run_res.cmdi == baseline.cmdi
        assert run_res.risk_category == baseline.risk_category
        assert run_res.risk_severity == baseline.risk_severity
        assert run_res.breakdown.primary_risk_driver == baseline.breakdown.primary_risk_driver
        assert [i.contribution for i in run_res.breakdown.indicators] == [
            i.contribution for i in baseline.breakdown.indicators
        ]


def test_disclaimer_transparency_and_classifications():
    """Verify honest provenance tags: Error-handling is HEURISTIC, others are MEASURED, disclaimer present."""
    risks = normalize_indicator_risks(
        max_complexity=20,
        duplication_percent=5.0,
        circular_cycles_count=0,
        max_afferent_coupling=4,
        error_adherence_score=85,
    )
    indicators = build_indicator_scores(
        normalized_risks=risks,
        complexity_metrics={"max_complexity": 20, "avg_complexity": 4.0, "functions_exceeding_threshold": 1, "total_functions": 10},
        duplication_metrics={"duplication_percent": 5.0, "duplicate_blocks_count": 1, "total_duplicate_lines": 15, "total_code_lines": 300},
        dependency_metrics={"circular_cycles_count": 0, "max_afferent_coupling": 4, "total_dependencies": 8},
        error_metrics={"adherence_score": 85, "violations_count": 2, "bare_except_count": 1},
        cmdi_score=20.0,
    )

    by_id = {ind["id"]: ind for ind in indicators}
    assert by_id["complexity"]["classification"] == "MEASURED"
    assert by_id["duplication"]["classification"] == "MEASURED"
    assert by_id["coupling"]["classification"] == "MEASURED"
    assert by_id["error_handling"]["classification"] == "HEURISTIC"

    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(
        normalized_risks=risks,
        findings_count=3,
        hotspots_count=0,
        indicators_data=indicators,
    )
    assert CMDI_DISCLAIMER in breakdown.scoring_disclaimer
    assert "heuristic" in breakdown.scoring_disclaimer.lower()


def test_circular_dependency_cannot_have_clean_module_boundaries_interpretation():
    """Verify that a detected circular dependency is NEVER described as having 'clean module boundaries'."""
    risks = {
        "complexity_risk": 0.0,
        "duplication_risk": 0.0,
        "coupling_risk": 36.5,  # 1 cycle (35 pts) + 1.5 Ca pts
        "error_handling_risk": 0.0,
    }
    dep_metrics = {
        "circular_cycles_count": 1,
        "max_afferent_coupling": 1,
        "total_dependencies": 3,
    }
    indicators = build_indicator_scores(
        normalized_risks=risks,
        dependency_metrics=dep_metrics,
        cmdi_score=9.1,
    )
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(
        normalized_risks=risks,
        findings_count=1,
        hotspots_count=1,
        indicators_data=indicators,
    )

    # CMDI is 9.1 (Low Risk tier due to 0 in other indicators)
    assert cmdi == 9.1
    assert tier == "Low Risk"
    # CRITICAL: Must not claim clean module boundaries when a circular cycle exists!
    assert "clean module boundaries" not in interp.lower()
    assert "circular dependency cycle" in interp.lower()
    assert "compromised" in interp.lower() or "circular" in interp.lower()


def test_high_duplication_cannot_have_minimal_duplication_interpretation():
    """Verify that significant code duplication is NEVER described as 'minimal duplication'."""
    risks = {
        "complexity_risk": 0.0,
        "duplication_risk": 60.0,  # 15.0% duplication
        "coupling_risk": 0.0,
        "error_handling_risk": 0.0,
    }
    dup_metrics = {
        "duplication_percent": 15.0,
        "duplicate_blocks_count": 3,
        "total_duplicate_lines": 45,
    }
    indicators = build_indicator_scores(
        normalized_risks=risks,
        duplication_metrics=dup_metrics,
        cmdi_score=15.0,
    )
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(
        normalized_risks=risks,
        findings_count=3,
        hotspots_count=0,
        indicators_data=indicators,
    )

    assert "minimal duplication" not in interp.lower()
    assert "duplication" in interp.lower()


def test_high_complexity_cannot_have_low_complexity_interpretation():
    """Verify that high complexity is NEVER described as 'low branching complexity'."""
    risks = {
        "complexity_risk": 70.0,  # Max McCabe = 31
        "duplication_risk": 0.0,
        "coupling_risk": 0.0,
        "error_handling_risk": 0.0,
    }
    comp_metrics = {
        "max_complexity": 31,
        "avg_complexity": 8.5,
        "functions_exceeding_threshold": 3,
    }
    indicators = build_indicator_scores(
        normalized_risks=risks,
        complexity_metrics=comp_metrics,
        cmdi_score=17.5,
    )
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(
        normalized_risks=risks,
        findings_count=3,
        hotspots_count=1,
        indicators_data=indicators,
    )

    assert "low branching complexity" not in interp.lower()
    assert "complexity" in interp.lower()


def test_indicator_severity_thresholds_intentional_and_documented():
    """Verify indicator severity thresholds: <= 25 info, 26-50 medium, 51-75 high, >75 or circular critical."""
    assert resolve_indicator_severity(None) == "info"
    assert resolve_indicator_severity(0.0) == "info"
    assert resolve_indicator_severity(25.0) == "info"
    assert resolve_indicator_severity(25.1) == "medium"
    assert resolve_indicator_severity(40.0) == "medium"
    assert resolve_indicator_severity(50.0) == "medium"
    assert resolve_indicator_severity(50.1) == "high"
    assert resolve_indicator_severity(65.0) == "high"
    assert resolve_indicator_severity(75.0) == "high"
    assert resolve_indicator_severity(75.1) == "critical"
    assert resolve_indicator_severity(90.0) == "critical"

    # Any circular dependency elevates coupling severity to critical immediately
    assert resolve_indicator_severity(10.0, is_circular=True) == "critical"
    assert resolve_indicator_severity(36.5, is_circular=True) == "critical"


def test_maintainability_summary_pydantic_schema():
    """Verify Pydantic MaintainabilitySummary schema with breakdown serializes cleanly."""
    clean_risks = {
        "complexity_risk": 15.0,
        "duplication_risk": 10.0,
        "coupling_risk": 5.0,
        "error_handling_risk": 20.0,
    }
    cmdi, tier, severity, interp, hours, breakdown = compute_cmdi_summary(clean_risks, 2, 0)
    summary = MaintainabilitySummary(
        cmdi=cmdi,
        score_available=breakdown.score_available,
        risk_category=tier,
        risk_severity=severity,
        interpretation=interp,
        scoring_disclaimer=breakdown.scoring_disclaimer,
        remediation_estimate_hours=hours,
        formula_description=breakdown.formula_expression,
        breakdown=breakdown,
    )

    data = summary.model_dump()
    assert data["cmdi"] == cmdi
    assert data["score_available"] is True
    assert data["breakdown"]["cmdi"] == cmdi
    assert len(data["breakdown"]["indicators"]) == 4
