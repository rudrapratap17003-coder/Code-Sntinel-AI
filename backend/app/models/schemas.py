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


class IndicatorScore(BaseModel):
    id: str
    name: str
    raw_metric: str
    raw_values: Dict[str, Any]
    normalized_risk: float = Field(..., ge=0.0, le=100.0)
    weight: float = Field(0.25, ge=0.0, le=1.0)
    contribution: float = Field(..., ge=0.0, le=100.0)
    classification: str = Field("MEASURED", description="MEASURED or HEURISTIC")
    severity: str
    interpretation: str
    meaning: str
    why_it_matters: str
    how_calculated: str
    evidence: str
    developer_action: str
    filter_category: str


class MaintainabilitySummary(BaseModel):
    cmdi: float = Field(..., ge=0.0, le=100.0, description="Composite Maintenance Debt Index (0-100)")
    risk_category: str = Field(..., description="Low Risk, Moderate Risk, High Risk, Critical Risk")
    risk_severity: str = Field(..., description="success, info, medium, critical")
    interpretation: str
    scoring_disclaimer: str
    remediation_estimate_hours: int
    formula_description: str


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


class AnalysisResult(BaseModel):
    id: str = Field(..., description="Unique analysis execution identifier")
    timestamp: str
    display_timestamp: str
    repository: RepositoryMetadata
    summary: MaintainabilitySummary
    indicators: List[IndicatorScore]
    findings: List[FindingModel]
    priority_findings: List[FindingModel]
    hotspots: List[Dict[str, Any]]
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
    cmdi: float
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
    potential_tradeoffs: str = Field(..., description="Nuances, edge cases, and design trade-offs")
    architectural_considerations: str = Field(..., description="Wider architectural context and blast radius")
    context_limitations: Optional[str] = Field(None, description="Honest disclosure if context was insufficient to be fully certain")
    model_name: str
    generated_at: str
    origin: str = "AI_EXPLANATION (Gemini)"
