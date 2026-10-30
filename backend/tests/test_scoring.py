"""Tests for normalization and Composite Maintenance Debt Index (CMDI)."""

import pytest
from app.analyzer.scoring import normalize_indicator_risks, compute_cmdi_summary


def test_normalization_bounds():
    risks = normalize_indicator_risks(
        max_complexity=38,
        duplication_percent=14.8,
        circular_cycles_count=2,
        max_afferent_coupling=12,
        error_adherence_score=71,
    )

    for k, v in risks.items():
        assert 0.0 <= v <= 100.0


def test_low_risk_summary():
    clean_risks = {
        "complexity_risk": 0.0,
        "duplication_risk": 0.0,
        "coupling_risk": 0.0,
        "error_handling_risk": 0.0,
    }
    cmdi, tier, severity, interp, hours = compute_cmdi_summary(clean_risks, 0, 0)
    assert cmdi == 0.0
    assert tier == "Low Risk"
    assert severity == "success"


def test_high_risk_summary():
    high_risks = {
        "complexity_risk": 84.0,
        "duplication_risk": 60.0,
        "coupling_risk": 74.0,
        "error_handling_risk": 40.0,
    }
    cmdi, tier, severity, interp, hours = compute_cmdi_summary(high_risks, 18, 3)
    assert cmdi == 64.5
    assert tier == "High Risk"
    assert severity == "medium"
    assert hours > 0
