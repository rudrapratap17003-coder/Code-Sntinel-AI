"""Unit and Integration Tests for Phase 12 Advanced Intelligence & Technical Debt Insights."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    AnalysisResult,
    RepositoryMetadata,
    MaintainabilitySummary,
    ScoringBreakdown,
    IndicatorBreakdown,
    IndicatorScore,
    FindingModel,
    EvidenceDetail,
    HotspotModel,
    ArchitectureGraphModel,
    ModuleNode,
    DependencyEdge,
    AnalysisListItem,
)
from app.analyzer.trends import compute_cmdi_trends
from app.analyzer.comparison import compare_analyses, ComparisonError
from app.analyzer.prioritization import prioritize_findings, calculate_finding_priority_score
from app.analyzer.recommendations import generate_refactoring_guidance
from app.analyzer.hotspot_ranking import rank_modules
from app.analyzer.pattern_insights import extract_pattern_insights
from app.analyzer.report import generate_developer_report
from app.storage.database import save_analysis, init_db


@pytest.fixture
def test_client():
    init_db()
    return TestClient(app)


def make_dummy_analysis(
    analysis_id: str,
    repo_url: str = "https://github.com/org/sample-repo",
    repo_name: str = "org/sample-repo",
    timestamp: str = "2026-10-31T10:00:00Z",
    cmdi: float = 42.0,
    score_available: bool = True,
    risk_category: str = "Moderate Risk",
    files_examined: int = 5,
    findings: list = None,
    hotspots: list = None,
    nodes: list = None,
    edges: list = None,
) -> AnalysisResult:
    """Helper to construct a valid AnalysisResult fixture."""
    findings_list = findings or []
    hotspots_list = hotspots or []
    nodes_list = nodes or [
        ModuleNode(
            id="mod1",
            label="mod1",
            full_path="pkg/mod1.py",
            category="Service",
            afferent_coupling=2,
            efferent_coupling=1,
            instability=0.33,
            loc=120,
            complexity=8,
        )
    ]
    edges_list = edges or []

    indicators = [
        IndicatorScore(
            id="complexity",
            name="Cyclomatic Complexity",
            raw_metric="Max 8",
            raw_values={"max_complexity": 8},
            normalized_risk=30.0,
            weight=0.25,
            effective_weight=0.25,
            contribution=7.5,
            contribution_percentage=25.0,
            classification="MEASURED",
            severity="medium",
            interpretation="Moderate complexity",
            meaning="Complexity",
            why_it_matters="Matters",
            how_calculated="Calc",
            evidence="Evidence",
            developer_action="Action",
            filter_category="Complexity",
        ),
        IndicatorScore(
            id="duplication",
            name="Code Duplication",
            raw_metric="0%",
            raw_values={"duplicate_lines": 0},
            normalized_risk=0.0,
            weight=0.25,
            effective_weight=0.25,
            contribution=0.0,
            contribution_percentage=0.0,
            classification="MEASURED",
            severity="info",
            interpretation="Zero duplication",
            meaning="Duplication",
            why_it_matters="Matters",
            how_calculated="Calc",
            evidence="Evidence",
            developer_action="Action",
            filter_category="Duplication",
        ),
        IndicatorScore(
            id="coupling",
            name="Architectural Coupling",
            raw_metric="Ca=2, Ce=1",
            raw_values={"circular_cycles": 0},
            normalized_risk=15.0,
            weight=0.25,
            effective_weight=0.25,
            contribution=3.75,
            contribution_percentage=12.5,
            classification="MEASURED",
            severity="info",
            interpretation="Clean boundaries",
            meaning="Coupling",
            why_it_matters="Matters",
            how_calculated="Calc",
            evidence="Evidence",
            developer_action="Action",
            filter_category="Coupling",
        ),
        IndicatorScore(
            id="error_handling",
            name="Error-Handling Risk",
            raw_metric="100% adherence",
            raw_values={"anti_patterns_count": 0},
            normalized_risk=0.0,
            weight=0.25,
            effective_weight=0.25,
            contribution=0.0,
            contribution_percentage=0.0,
            classification="MEASURED",
            severity="info",
            interpretation="Standard exceptions",
            meaning="Error handling",
            why_it_matters="Matters",
            how_calculated="Calc",
            evidence="Evidence",
            developer_action="Action",
            filter_category="Error Handling",
        ),
    ]

    breakdown_indicators = [
        IndicatorBreakdown(
            id=ind.id,
            name=ind.name,
            raw_metric=ind.raw_metric,
            raw_values=ind.raw_values,
            normalized_risk=ind.normalized_risk,
            weight=ind.weight,
            effective_weight=ind.effective_weight,
            contribution=ind.contribution,
            contribution_percentage=ind.contribution_percentage,
            classification=ind.classification,
            severity=ind.severity,
            interpretation=ind.interpretation,
            meaning=ind.meaning,
            why_it_matters=ind.why_it_matters,
            how_calculated=ind.how_calculated,
            evidence=ind.evidence,
            developer_action=ind.developer_action,
            filter_category=ind.filter_category,
        )
        for ind in indicators
    ]

    breakdown = ScoringBreakdown(
        cmdi=cmdi if score_available else None,
        score_available=score_available,
        risk_category=risk_category,
        risk_severity="medium" if score_available else "info",
        formula_expression="25% * C + 25% * D + 25% * Co + 25% * E",
        indicators=breakdown_indicators,
        interpretation="Summary interpretation",
        scoring_disclaimer="CMDI disclaimer",
    )

    summary = MaintainabilitySummary(
        cmdi=cmdi if score_available else None,
        score_available=score_available,
        risk_category=risk_category,
        risk_severity="medium" if score_available else "info",
        interpretation="Summary interpretation",
        scoring_disclaimer="CMDI disclaimer",
        remediation_estimate_hours=4,
        formula_description="Formula desc",
        breakdown=breakdown,
    )

    return AnalysisResult(
        id=analysis_id,
        timestamp=timestamp,
        display_timestamp="Snapshot",
        repository=RepositoryMetadata(
            name=repo_name,
            url=repo_url,
            branch="main",
            commit_hash="abc1234",
            files_examined=files_examined,
            lines_of_code=500,
            status="Analyzed",
        ),
        summary=summary,
        indicators=indicators,
        findings=findings_list,
        priority_findings=[],
        hotspots=hotspots_list,
        architecture=ArchitectureGraphModel(
            metrics={"nodes_count": len(nodes_list), "edges_count": len(edges_list)},
            nodes=nodes_list,
            edges=edges_list,
        ),
    )


# =============================================================================
# 1. Historical Trends Tests
# =============================================================================

def test_trends_multiple_analyses():
    analyses = [
        AnalysisListItem(
            id="run-1",
            timestamp="2026-10-01T10:00:00Z",
            display_timestamp="Oct 1",
            repository_name="sample-repo",
            repository_url="https://github.com/org/sample-repo",
            cmdi=50.0,
            score_available=True,
            risk_category="Moderate Risk",
            findings_count=10,
            files_examined=10,
        ),
        AnalysisListItem(
            id="run-2",
            timestamp="2026-10-15T10:00:00Z",
            display_timestamp="Oct 15",
            repository_name="sample-repo",
            repository_url="https://github.com/org/sample-repo",
            cmdi=35.0,
            score_available=True,
            risk_category="Moderate Risk",
            findings_count=6,
            files_examined=10,
        ),
        AnalysisListItem(
            id="run-3",
            timestamp="2026-10-30T10:00:00Z",
            display_timestamp="Oct 30",
            repository_name="sample-repo",
            repository_url="https://github.com/org/sample-repo",
            cmdi=30.0,
            score_available=True,
            risk_category="Moderate Risk",
            findings_count=4,
            files_examined=10,
        ),
    ]

    res = compute_cmdi_trends("sample-repo", "https://github.com/org/sample-repo", analyses)
    assert res.total_analyses == 3
    assert res.overall_trend == "improved"
    assert res.net_cmdi_delta == -20.0  # 30.0 - 50.0
    assert len(res.analyses) == 3
    assert res.analyses[0].trend_direction == "baseline"
    assert res.analyses[1].trend_direction == "improved"
    assert res.analyses[1].delta_from_previous == -15.0
    assert res.analyses[1].percentage_change == -30.0


def test_trends_single_analysis():
    analyses = [
        AnalysisListItem(
            id="run-1",
            timestamp="2026-10-01T10:00:00Z",
            display_timestamp="Oct 1",
            repository_name="sample-repo",
            repository_url="https://github.com/org/sample-repo",
            cmdi=25.0,
            score_available=True,
            risk_category="Low Risk",
            findings_count=2,
            files_examined=5,
        )
    ]
    res = compute_cmdi_trends("sample-repo", "https://github.com/org/sample-repo", analyses)
    assert res.total_analyses == 1
    assert res.overall_trend == "insufficient_data"
    assert res.net_cmdi_delta is None
    assert res.analyses[0].trend_direction == "baseline"


def test_trends_empty_history():
    res = compute_cmdi_trends("empty-repo", "https://github.com/org/empty-repo", [])
    assert res.total_analyses == 0
    assert res.overall_trend == "insufficient_data"
    assert res.analyses == []


def test_trends_null_cmdi_handling():
    analyses = [
        AnalysisListItem(
            id="run-1",
            timestamp="2026-10-01T10:00:00Z",
            display_timestamp="Oct 1",
            repository_name="sample-repo",
            repository_url="https://github.com/org/sample-repo",
            cmdi=None,
            score_available=False,
            risk_category="Not Available",
            findings_count=0,
            files_examined=0,
        ),
        AnalysisListItem(
            id="run-2",
            timestamp="2026-10-02T10:00:00Z",
            display_timestamp="Oct 2",
            repository_name="sample-repo",
            repository_url="https://github.com/org/sample-repo",
            cmdi=45.0,
            score_available=True,
            risk_category="Moderate Risk",
            findings_count=4,
            files_examined=5,
        ),
    ]
    res = compute_cmdi_trends("sample-repo", "https://github.com/org/sample-repo", analyses)
    assert res.total_analyses == 2
    assert res.analyses[0].cmdi is None
    assert res.analyses[0].score_available is False
    assert res.analyses[1].cmdi == 45.0
    assert res.analyses[1].trend_direction == "unavailable"  # cannot compute delta from None


# =============================================================================
# 2. Before-and-After Analysis Comparison Tests
# =============================================================================

def test_comparison_same_repository():
    f1 = FindingModel(
        id="FIND-1",
        title="High Cyclomatic Complexity",
        rule_id="radon_cc",
        category="Cyclomatic Complexity",
        severity="high",
        file="pkg/mod1.py",
        line_range="10-35",
        summary="Complex method",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="METRIC_THRESHOLD", metric_name="cyclomatic_complexity", measured_value=16, threshold=10),
        maintainability_impact="High friction",
        recommended_remediation="Refactor method",
        origin="STATIC_ANALYSIS",
    )
    f2 = FindingModel(
        id="FIND-2",
        title="Swallowed Exception",
        rule_id="bare_except",
        category="Error-Handling Consistency",
        severity="medium",
        file="pkg/mod1.py",
        line_range="40-45",
        summary="Bare except",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="AST_ANTI_PATTERN", ast_violation="bare except: pass"),
        maintainability_impact="Silent failure",
        recommended_remediation="Catch specific exception",
        origin="STATIC_ANALYSIS",
    )

    a1 = make_dummy_analysis("snap-1", timestamp="2026-10-01T10:00:00Z", cmdi=60.0, findings=[f1, f2], files_examined=5)
    # In a2, f1 is resolved (absent), f2 remains unresolved, and f3 is newly detected
    f3 = FindingModel(
        id="FIND-3",
        title="Code Clone",
        rule_id="duplicate_block",
        category="Code Duplication",
        severity="low",
        file="pkg/mod2.py",
        line_range="5-20",
        summary="Cloned block",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="DUPLICATION_CLONE", clone_target_file="pkg/mod1.py"),
        maintainability_impact="Maintenance duplication",
        recommended_remediation="Extract shared helper",
        origin="STATIC_ANALYSIS",
    )
    a2 = make_dummy_analysis("snap-2", timestamp="2026-10-15T10:00:00Z", cmdi=35.0, findings=[f2, f3], files_examined=5)

    comp = compare_analyses(a1, a2)
    assert comp.base_analysis_id == "snap-1"
    assert comp.target_analysis_id == "snap-2"
    assert comp.cmdi_difference == -25.0
    assert comp.cmdi_status == "improved"

    # Findings diff
    assert len(comp.findings.newly_detected) == 1
    assert comp.findings.newly_detected[0].rule_id == "duplicate_block"

    assert len(comp.findings.no_longer_detected) == 1
    assert comp.findings.no_longer_detected[0].rule_id == "radon_cc"

    assert len(comp.findings.unresolved) == 1
    assert comp.findings.unresolved[0].rule_id == "bare_except"

    # Summary
    assert len(comp.summary.what_improved) > 0
    assert len(comp.summary.what_worsened) > 0


def test_comparison_rejects_different_repositories():
    a1 = make_dummy_analysis("snap-1", repo_url="https://github.com/org/repo-a")
    a2 = make_dummy_analysis("snap-2", repo_url="https://github.com/org/repo-b")

    with pytest.raises(ComparisonError) as exc_info:
        compare_analyses(a1, a2)
    assert "Cannot compare analyses from different repositories" in str(exc_info.value)


def test_comparison_scope_change_warning():
    a1 = make_dummy_analysis("snap-1", files_examined=4)
    a2 = make_dummy_analysis("snap-2", files_examined=15)
    comp = compare_analyses(a1, a2)
    assert comp.summary.scope_change_warning is not None
    assert "Analysis scope changed" in comp.summary.scope_change_warning


# =============================================================================
# 3. Technical Debt Prioritization Tests
# =============================================================================

def test_prioritize_findings_deterministic_ordering():
    f_crit = FindingModel(
        id="FIND-CRIT",
        title="Circular Import Cycle",
        rule_id="circular_import",
        category="Architectural Coupling",
        severity="critical",
        file="pkg/a.py",
        line_range="1-5",
        summary="Circular cycle",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="IMPORT_CYCLE", cycle_chain=["pkg/a.py", "pkg/b.py"]),
        maintainability_impact="High",
        recommended_remediation="Break cycle",
        origin="STATIC_ANALYSIS",
    )
    f_low = FindingModel(
        id="FIND-LOW",
        title="Minor Duplication",
        rule_id="duplicate_block",
        category="Code Duplication",
        severity="low",
        file="pkg/c.py",
        line_range="10-15",
        summary="Minor clone",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="DUPLICATION_CLONE"),
        maintainability_impact="Low",
        recommended_remediation="Extract function",
        origin="STATIC_ANALYSIS",
    )

    prioritized = prioritize_findings([f_low, f_crit], hotspots=[{"file": "pkg/a.py"}])
    assert len(prioritized) == 2
    # Critical should be ranked first
    assert prioritized[0].finding_id == "FIND-CRIT"
    assert prioritized[0].priority_tier == "Critical Attention"
    assert prioritized[0].priority_score >= 80

    assert prioritized[1].finding_id == "FIND-LOW"
    assert prioritized[1].priority_tier == "Low Priority"


def test_prioritization_deduplication():
    f = FindingModel(
        id="FIND-1",
        title="Duplicated Finding",
        rule_id="radon_cc",
        category="Cyclomatic Complexity",
        severity="high",
        file="pkg/mod.py",
        line_range="10-20",
        summary="Complex",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="METRIC_THRESHOLD", measured_value=15),
        maintainability_impact="Impact",
        recommended_remediation="Remediation",
        origin="STATIC_ANALYSIS",
    )
    # Duplicate with same rule, file, and line range
    prioritized = prioritize_findings([f, f])
    assert len(prioritized) == 1


# =============================================================================
# 4. Smart Refactoring Recommendations Tests
# =============================================================================

def test_refactoring_guidance_structure():
    f = FindingModel(
        id="FIND-ERR",
        title="Swallowed Exception Block",
        rule_id="bare_except",
        category="Error-Handling Consistency",
        severity="high",
        file="pkg/service.py",
        line_range="50-55",
        summary="Bare except clause suppresses runtime error",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="AST_ANTI_PATTERN", ast_violation="except: pass"),
        maintainability_impact="Obscures fatal defects",
        recommended_remediation="Catch specific exception",
        origin="STATIC_ANALYSIS",
    )

    guidance = generate_refactoring_guidance(f)
    assert guidance.problem_statement is not None
    assert guidance.why_it_matters is not None
    assert guidance.code_evidence is not None
    assert guidance.recommended_change is not None
    assert guidance.expected_benefit is not None
    assert len(guidance.verification_checklist) >= 2


# =============================================================================
# 5. Module Hotspot Ranking Tests
# =============================================================================

def test_rank_modules():
    f1 = FindingModel(
        id="FIND-1",
        title="Complex Logic",
        rule_id="radon_cc",
        category="Cyclomatic Complexity",
        severity="critical",
        file="pkg/hotspot.py",
        line_range="10-30",
        summary="Critical complexity",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="METRIC_THRESHOLD"),
        maintainability_impact="Impact",
        recommended_remediation="Fix",
        origin="STATIC_ANALYSIS",
    )
    h1 = HotspotModel(
        id="h-1",
        file="pkg/hotspot.py",
        complexity=25,
        total_complexity=40,
        afferent_coupling=5,
        efferent_coupling=2,
        in_circular_cycle=True,
        duplicate_lines=30,
        error_violations_count=2,
        volatility_score=85.0,
        architectural_volatility_estimate=85.0,
        volatility_label="High Volatility",
        risk_factor=90,
        risk_priority="Critical Priority",
        estimated_fix_hours=8,
        why_it_matters="High risk",
        suggested_remediation="Refactor",
    )

    analysis = make_dummy_analysis("a-1", findings=[f1], hotspots=[h1])
    ranked = rank_modules(analysis)
    assert len(ranked) >= 1
    top = ranked[0]
    assert top.module_name == "pkg/hotspot.py"
    assert top.overall_hotspot_classification == "Critical Hotspot"
    assert top.in_circular_cycle is True
    assert top.highest_cyclomatic_complexity == 25
    assert len(top.associated_finding_ids) == 1


# =============================================================================
# 6. AI-Assisted Pattern Insights Tests
# =============================================================================

def test_pattern_insights_caveat_and_detection():
    f_err = FindingModel(
        id="FIND-ERR",
        title="Bare Except",
        rule_id="bare_except",
        category="Error-Handling Consistency",
        severity="medium",
        file="pkg/mod.py",
        line_range="10-15",
        summary="Bare except pass",
        detailed_explanation="Detail",
        evidence=EvidenceDetail(type="AST_ANTI_PATTERN"),
        maintainability_impact="Impact",
        recommended_remediation="Fix",
        origin="STATIC_ANALYSIS",
    )

    analysis = make_dummy_analysis("a-1", findings=[f_err])
    insights = extract_pattern_insights(analysis)
    assert len(insights) >= 4

    err_insight = next(i for i in insights if i.id == "PAT-ERR-001")
    assert err_insight.detected is True
    assert "cannot establish authorship" in err_insight.non_authorship_caveat

    # Pattern without evidence should be marked not detected
    dup_insight = next(i for i in insights if i.id == "PAT-DUP-002")
    assert dup_insight.detected is False


# =============================================================================
# 7. Developer Improvement Report Tests
# =============================================================================

def test_developer_report_generation():
    analysis = make_dummy_analysis("a-1", cmdi=45.0)
    save_analysis(analysis)

    report = generate_developer_report(analysis)
    assert report.repository_name == "org/sample-repo"
    assert report.cmdi == 45.0
    assert len(report.recommended_next_steps) > 0
    assert len(report.data_provenance_notes) > 0


# =============================================================================
# 8. API Endpoints Integration Tests
# =============================================================================

def test_api_trends_endpoint(test_client):
    # Save 2 analyses for same repo
    a1 = make_dummy_analysis("api-run-1", repo_url="https://github.com/org/trend-repo", timestamp="2026-10-01T10:00:00Z", cmdi=50.0)
    a2 = make_dummy_analysis("api-run-2", repo_url="https://github.com/org/trend-repo", timestamp="2026-10-05T10:00:00Z", cmdi=30.0)
    save_analysis(a1)
    save_analysis(a2)

    resp = test_client.get("/api/v1/analyses/trends", params={"repository_url": "https://github.com/org/trend-repo"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_analyses"] == 2
    assert data["overall_trend"] == "improved"
    assert data["net_cmdi_delta"] == -20.0


def test_api_compare_endpoint(test_client):
    a1 = make_dummy_analysis("cmp-1", repo_url="https://github.com/org/cmp-repo", timestamp="2026-10-01T10:00:00Z", cmdi=55.0)
    a2 = make_dummy_analysis("cmp-2", repo_url="https://github.com/org/cmp-repo", timestamp="2026-10-08T10:00:00Z", cmdi=40.0)
    save_analysis(a1)
    save_analysis(a2)

    resp = test_client.get("/api/v1/analyses/compare", params={"base_id": "cmp-1", "target_id": "cmp-2"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["cmdi_status"] == "improved"
    assert data["cmdi_difference"] == -15.0


def test_api_prioritized_and_report_endpoints(test_client):
    a = make_dummy_analysis("full-report-1", repo_url="https://github.com/org/report-repo", cmdi=35.0)
    save_analysis(a)

    resp_prio = test_client.get("/api/v1/analyses/full-report-1/prioritized")
    assert resp_prio.status_code == 200
    assert isinstance(resp_prio.json(), list)

    resp_hotspots = test_client.get("/api/v1/analyses/full-report-1/hotspots-ranking")
    assert resp_hotspots.status_code == 200
    assert isinstance(resp_hotspots.json(), list)

    resp_patterns = test_client.get("/api/v1/analyses/full-report-1/pattern-insights")
    assert resp_patterns.status_code == 200
    assert isinstance(resp_patterns.json(), list)

    resp_report = test_client.get("/api/v1/analyses/full-report-1/report")
    assert resp_report.status_code == 200
    data = resp_report.json()
    assert data["repository_name"] == "org/sample-repo"
    assert len(data["recommended_next_steps"]) > 0
