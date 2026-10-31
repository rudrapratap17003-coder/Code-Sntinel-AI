"""Pydantic v2 schemas for CodeSentinel AI API contracts."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, HttpUrl


class RepositoryMetadata(BaseModel):
    name: str = Field(..., description="Repository full name (owner/repo)")
    url: str = Field(..., description="Normalized repository URL")
    branch: Optional[str] = Field("main", description="Analyzed branch or commit ref")
    commit_hash: Optional[str] = Field(None, description="Commit hash if available")
    files_examined: int = Field(0, description="Count of Python source files analyzed")
    lines_of_code: int = Field(0, description="Total physical lines of Python code")
    status: str = Field("Analyzed", description="Ingestion & analysis status")
    is_demo: bool = Field(False, description="Whether this is a synthetic demonstration run")
    mode_label: str = Field("REAL PYTHON STATIC ANALYSIS", description="Provenance badge label")


class EvidenceDetail(BaseModel):
    type: str = Field(..., description="Evidence classification: METRIC_THRESHOLD, IMPORT_CYCLE, etc.")
    metric_name: Optional[str] = None
    measured_value: Optional[Any] = None
    threshold: Optional[Any] = None
    code_snippet: Optional[str] = None
    cycle_chain: Optional[List[str]] = None
    clone_target_file: Optional[str] = None
    clone_target_lines: Optional[str] = None
    ast_violation: Optional[str] = None


class FindingModel(BaseModel):
    id: str = Field(..., description="Stable finding identifier (e.g. FIND-PY-001)")
    title: str = Field(..., description="Concise finding headline")
    rule_id: str = Field(..., description="Deterministic rule category/name")
    category: str = Field(..., description="One of: Cyclomatic Complexity, Code Duplication, Architectural Coupling, Error-Handling Consistency, Syntax Integrity")
    severity: str = Field(..., description="Severity level: critical, high, medium, low")
    status: str = Field("Open", description="Lifecycle status: Open, In Review, Resolved, Suppressed")
    file: str = Field(..., description="Relative file path within repository")
    line_range: str = Field(..., description="Affected line coordinates (e.g. lines 12–45)")
    summary: str = Field(..., description="One-sentence description of the problem")
    detailed_explanation: str = Field(..., description="Detailed technical root-cause explanation")
    evidence: EvidenceDetail = Field(..., description="Tangible structured evidence")
    maintainability_impact: str = Field(..., description="Consequences on maintenance, testability, bug risk")
    recommended_remediation: str = Field(..., description="Step-by-step guidance to remediate the finding")
    origin: str = Field(..., description="Provenance: STATIC_ANALYSIS (AST/Radon), HEURISTIC, etc.")
    remediation_estimate_hours: Optional[int] = Field(2, description="Estimated engineering hours to fix")


class IndicatorBreakdown(BaseModel):
    id: str
    name: str
    raw_metric: str
    raw_values: Dict[str, Any] = Field(default_factory=dict)
    normalized_risk: Optional[float] = Field(None, ge=0.0, le=100.0)
    weight: float = Field(0.25, ge=0.0, le=1.0)
    effective_weight: float = Field(0.25, ge=0.0, le=1.0)
    contribution: float = Field(0.0, ge=0.0, le=100.0)
    contribution_percentage: float = Field(0.0, ge=0.0, le=100.0)
    classification: str = Field("MEASURED", description="MEASURED, HEURISTIC, or UNAVAILABLE")
    severity: str = "info"
    interpretation: str
    meaning: str
    why_it_matters: str
    how_calculated: str
    evidence: str
    developer_action: str
    filter_category: str


class ScoringBreakdown(BaseModel):
    cmdi: Optional[float] = Field(None, ge=0.0, le=100.0)
    score_available: bool = Field(True, description="Whether sufficient metric data was available to calculate CMDI")
    risk_category: str = Field(..., description="Low Risk, Moderate Risk, High Risk, Critical Risk, or Not Available")
    risk_severity: str = Field(..., description="success, info, medium, critical, or muted")
    formula_expression: str
    is_dynamically_weighted: bool = False
    indicators: List[IndicatorBreakdown] = Field(default_factory=list)
    primary_risk_driver: Optional[str] = None
    interpretation: str
    scoring_disclaimer: str


class IndicatorScore(BaseModel):
    id: str
    name: str
    raw_metric: str
    raw_values: Dict[str, Any] = Field(default_factory=dict)
    normalized_risk: Optional[float] = Field(None, ge=0.0, le=100.0)
    weight: float = Field(0.25, ge=0.0, le=1.0)
    effective_weight: float = Field(0.25, ge=0.0, le=1.0)
    contribution: float = Field(..., ge=0.0, le=100.0)
    contribution_percentage: float = Field(0.0, ge=0.0, le=100.0)
    classification: str = Field("MEASURED", description="MEASURED, HEURISTIC, or UNAVAILABLE")
    severity: str
    interpretation: str
    meaning: str
    why_it_matters: str
    how_calculated: str
    evidence: str
    developer_action: str
    filter_category: str


class MaintainabilitySummary(BaseModel):
    cmdi: Optional[float] = Field(None, ge=0.0, le=100.0, description="Composite Maintenance Debt Index (0-100), or None if unavailable")
    score_available: bool = Field(True, description="Whether sufficient metric data was available to calculate CMDI")
    risk_category: str = Field(..., description="Low Risk, Moderate Risk, High Risk, Critical Risk, or Not Available")
    risk_severity: str = Field(..., description="success, info, medium, critical")
    interpretation: str
    scoring_disclaimer: str
    remediation_estimate_hours: int
    formula_description: str
    breakdown: Optional[ScoringBreakdown] = None


class ModuleNode(BaseModel):
    id: str
    label: str
    full_path: str
    category: str
    afferent_coupling: int
    efferent_coupling: int
    instability: float
    loc: int
    complexity: int


class DependencyEdge(BaseModel):
    id: str
    source: str
    target: str
    is_circular: bool = False
    import_type: str = "direct"


class ArchitectureGraphModel(BaseModel):
    metrics: Dict[str, Any]
    nodes: List[ModuleNode]
    edges: List[DependencyEdge]


class HotspotModel(BaseModel):
    id: str = Field(..., description="Stable hotspot identifier (e.g. hotspot-1)")
    file: str = Field(..., description="Relative file path within repository")
    complexity: int = Field(..., description="Highest function cyclomatic complexity in file")
    total_complexity: int = Field(0, description="Sum of cyclomatic complexity across all functions in file")
    afferent_coupling: int = Field(0, description="Count of internal modules that depend on this file")
    efferent_coupling: int = Field(0, description="Count of internal modules this file imports")
    in_circular_cycle: bool = Field(False, description="Whether file is part of a circular dependency cycle")
    duplicate_lines: int = Field(0, description="Total duplicated lines in file")
    error_violations_count: int = Field(0, description="Count of error-handling anti-patterns in file")
    volatility_score: float = Field(..., description="Calculated architectural volatility heuristic score (0-100)")
    architectural_volatility_estimate: float = Field(..., description="Alias for volatility_score")
    volatility_label: str = Field("Moderate Volatility", description="Volatility category: High Volatility, Moderate Volatility, Stable")
    churn_commits: Optional[int] = Field(None, description="DEPRECATED: Real Git churn is not measured statically. Use volatility_score.")
    is_git_measured: bool = Field(False, description="Explicit indicator that Git commit history is not measured")
    data_source: str = Field("Static Architectural Heuristic (Not measured Git commit history)", description="Data provenance note")
    risk_factor: int = Field(..., description="Overall risk factor score (0-100)")
    risk_priority: str = Field(..., description="Risk priority tier: Critical Priority, High Priority, Moderate Risk")
    estimated_fix_hours: int = Field(..., description="Estimated engineering hours to remediate")
    why_it_matters: str = Field(..., description="Multi-factor explanation based on actual static measurements")
    supporting_evidence: Dict[str, Any] = Field(default_factory=dict, description="Structured measurement breakdown")
    suggested_remediation: str = Field(..., description="Actionable refactoring recommendations")


class AnalysisResult(BaseModel):
    id: str = Field(..., description="Unique analysis execution identifier")
    timestamp: str
    display_timestamp: str
    repository: RepositoryMetadata
    summary: MaintainabilitySummary
    indicators: List[IndicatorScore]
    findings: List[FindingModel]
    priority_findings: List[FindingModel]
    hotspots: List[HotspotModel] = Field(default_factory=list, description="Architectural maintainability hotspots")
    architecture: ArchitectureGraphModel
    analysis_limitations: List[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    repository_url: Optional[str] = Field(None, description="Public GitHub repository URL (e.g. https://github.com/owner/repo)")
    local_path: Optional[str] = Field(None, description="Local directory path (for local testing/offline analysis)")


class AnalysisListItem(BaseModel):
    id: str
    timestamp: str
    display_timestamp: str
    repository_name: str
    repository_url: str
    cmdi: Optional[float] = None
    score_available: bool = True
    risk_category: str
    findings_count: int
    files_examined: int


class ExplainFindingRequest(BaseModel):
    finding_id: str = Field(..., description="Stable finding identifier")
    rule_id: str = Field(..., description="Rule category/name")
    category: str = Field(..., description="Maintainability category")
    severity: str = Field(..., description="Severity level")
    file: str = Field(..., description="Affected file path")
    line_range: str = Field(..., description="Affected line coordinates")
    title: str = Field(..., description="Finding title")
    summary: str = Field(..., description="Finding summary")
    detailed_explanation: Optional[str] = Field(None, description="Static analysis detailed explanation")
    code_snippet: Optional[str] = Field(None, description="Verified code snippet evidence")
    maintainability_impact: Optional[str] = Field(None, description="Static impact evaluation")
    recommended_remediation: Optional[str] = Field(None, description="Static remediation guidance")
    evidence: Optional[Dict[str, Any]] = Field(None, description="Structured evidence payload")


class FindingExplanationResponse(BaseModel):
    finding_id: str
    rule_id: str
    file: str
    line_range: str
    plain_language_explanation: str = Field(..., description="Clear explanation for developers")
    why_it_matters: str = Field(..., description="Why this issue impacts software maintainability")
    proposed_remediation: str = Field(..., description="Actionable step-by-step refactoring approach")
    refactoring_example: Optional[str] = Field(None, description="Suggested refactored code example where context permits")
    is_example_illustrative: bool = Field(True, description="Explicit flag indicating that the code snippet is an illustrative example, not applied code")
    priority_guidance: str = Field("Near-Term Refactoring", description="Triage priority guidance based on analyzer severity and blast radius")
    potential_tradeoffs: str = Field(..., description="Nuances, edge cases, and design trade-offs")
    architectural_considerations: str = Field(..., description="Wider architectural context and blast radius")
    context_limitations: Optional[str] = Field(None, description="Honest disclosure if context was insufficient to be fully certain")
    model_name: str
    generated_at: str
    origin: str = "AI_EXPLANATION (Gemini)"


# =============================================================================
# Phase 12: Advanced Technical Debt Intelligence Schemas
# =============================================================================

class TrendPoint(BaseModel):
    id: str
    timestamp: str
    display_timestamp: str
    cmdi: Optional[float] = None
    score_available: bool = True
    risk_category: str
    findings_count: int
    files_examined: int
    delta_from_previous: Optional[float] = None
    percentage_change: Optional[float] = None
    trend_direction: str = "baseline"  # improved, worsened, unchanged, unavailable, baseline


class RepositoryTrendsResponse(BaseModel):
    repository_name: str
    repository_url: str
    total_analyses: int
    earliest_date: Optional[str] = None
    latest_date: Optional[str] = None
    analyses: List[TrendPoint] = Field(default_factory=list)
    overall_trend: str = "insufficient_data"  # improved, worsened, unchanged, unavailable, insufficient_data
    net_cmdi_delta: Optional[float] = None
    heuristic_disclaimer: str


class IndicatorComparison(BaseModel):
    id: str
    name: str
    earlier_risk: Optional[float] = None
    later_risk: Optional[float] = None
    earlier_raw: Optional[str] = None
    later_raw: Optional[str] = None
    delta: Optional[float] = None
    status: str = "unchanged"  # improved, regressed, unchanged, unavailable


class FindingDiffItem(BaseModel):
    id: str
    title: str
    rule_id: str
    file: str
    line_range: str
    earlier_severity: Optional[str] = None
    later_severity: Optional[str] = None
    category: str
    evidence_summary: Optional[str] = None


class FindingsComparison(BaseModel):
    newly_detected: List[FindingDiffItem] = Field(default_factory=list)
    no_longer_detected: List[FindingDiffItem] = Field(default_factory=list)
    unresolved: List[FindingDiffItem] = Field(default_factory=list)
    severity_changed: List[FindingDiffItem] = Field(default_factory=list)
    disclaimer: str


class ModuleDiffItem(BaseModel):
    module_name: str
    earlier_findings: int = 0
    later_findings: int = 0
    earlier_complexity: int = 0
    later_complexity: int = 0
    earlier_coupling: int = 0
    later_coupling: int = 0
    status: str = "unchanged"  # increased_risk, reduced_risk, unchanged


class ModuleComparison(BaseModel):
    increased_risk_modules: List[ModuleDiffItem] = Field(default_factory=list)
    reduced_risk_modules: List[ModuleDiffItem] = Field(default_factory=list)
    newly_detected_hotspots: List[str] = Field(default_factory=list)
    resolved_hotspots: List[str] = Field(default_factory=list)


class ComparisonSummary(BaseModel):
    what_improved: List[str] = Field(default_factory=list)
    what_worsened: List[str] = Field(default_factory=list)
    what_remained_unchanged: List[str] = Field(default_factory=list)
    recommended_next_actions: List[str] = Field(default_factory=list)
    scope_change_warning: Optional[str] = None


class ComparisonResponse(BaseModel):
    base_analysis_id: str
    target_analysis_id: str
    repository_name: str
    repository_url: str
    earlier_timestamp: str
    later_timestamp: str
    earlier_commit: Optional[str] = None
    later_commit: Optional[str] = None
    earlier_cmdi: Optional[float] = None
    later_cmdi: Optional[float] = None
    earlier_category: str
    later_category: str
    cmdi_difference: Optional[float] = None
    cmdi_status: str  # improved, regressed, unchanged, unavailable
    indicators: List[IndicatorComparison] = Field(default_factory=list)
    findings: FindingsComparison
    modules: ModuleComparison
    summary: ComparisonSummary
    heuristic_disclaimer: str


class RefactoringGuidance(BaseModel):
    problem_statement: str
    why_it_matters: str
    code_evidence: str
    recommended_change: str
    expected_benefit: str
    verification_checklist: List[str] = Field(default_factory=list)


class PrioritizedFinding(BaseModel):
    finding_id: str
    title: str
    file: str
    line_range: str
    severity: str
    priority_tier: str  # Critical Attention, High Priority, Medium Priority, Low Priority
    priority_score: int  # 0 to 100
    category: str
    evidence: str
    why_it_matters: str
    recommended_next_action: str
    refactoring_guidance: Optional[RefactoringGuidance] = None
    heuristic_rationale: str


class ModuleHotspotRankItem(BaseModel):
    module_name: str
    findings_count: int
    severity_distribution: Dict[str, int] = Field(default_factory=dict)
    highest_cyclomatic_complexity: int = 0
    total_cyclomatic_complexity: int = 0
    loc: int = 0
    afferent_coupling: int = 0
    efferent_coupling: int = 0
    instability: float = 0.0
    in_circular_cycle: bool = False
    duplicate_lines: int = 0
    error_violations_count: int = 0
    overall_hotspot_classification: str = "Stable Module"
    why_it_matters: str
    associated_finding_ids: List[str] = Field(default_factory=list)


class PatternInsightItem(BaseModel):
    id: str
    pattern_name: str
    detected: bool
    detected_evidence: str
    affected_files: List[str] = Field(default_factory=list)
    possible_interpretation: str
    actionable_recommendation: str
    non_authorship_caveat: str


class DeveloperReportResponse(BaseModel):
    repository_name: str
    repository_url: str
    analysis_date: str
    display_date: str
    commit_hash: Optional[str] = None
    branch: Optional[str] = "main"
    cmdi: Optional[float] = None
    score_available: bool = True
    risk_category: str
    risk_severity: str
    indicator_summary: List[IndicatorBreakdown] = Field(default_factory=list)
    total_findings: int
    critical_findings_count: int
    high_findings_count: int
    prioritized_findings: List[PrioritizedFinding] = Field(default_factory=list)
    main_hotspots: List[ModuleHotspotRankItem] = Field(default_factory=list)
    pattern_insights: List[PatternInsightItem] = Field(default_factory=list)
    historical_trend_summary: Optional[Dict[str, Any]] = None
    recommended_next_steps: List[str] = Field(default_factory=list)
    data_provenance_notes: List[str] = Field(default_factory=list)

