"""CodeSentinel AI - Developer Improvement Report Generator.

Synthesizes a cohesive, professional report for engineering teams:
- Combines measured AST data, heuristic CMDI scores, module hotspot rankings,
  prioritized findings, and AI-assisted pattern insights.
- Integrates historical trend trajectory when multiple runs exist for the repository.
- Distinguishes measured static analysis facts from heuristic interpretations.
- Outlines an actionable engineering roadmap with next steps.
"""

from typing import Optional, Dict, Any, List
from app.models.schemas import (
    AnalysisResult,
    DeveloperReportResponse,
)
from app.analyzer.prioritization import prioritize_findings
from app.analyzer.hotspot_ranking import rank_modules
from app.analyzer.pattern_insights import extract_pattern_insights
from app.analyzer.trends import compute_cmdi_trends
from app.storage.database import get_analyses_by_repository


def generate_developer_report(analysis: AnalysisResult) -> DeveloperReportResponse:
    """Compiles a complete developer improvement report for an analysis snapshot."""
    # 1. Prioritize findings
    prioritized = prioritize_findings(
        findings=analysis.findings,
        hotspots=analysis.hotspots,
        architecture_nodes=analysis.architecture.nodes if analysis.architecture else None,
    )

    # 2. Rank module hotspots
    ranked_hotspots = rank_modules(analysis)

    # 3. Extract pattern insights
    insights = extract_pattern_insights(analysis)

    # 4. Check historical trends for this repo
    trend_summary: Optional[Dict[str, Any]] = None
    if analysis.repository and analysis.repository.url:
        try:
            history_items = get_analyses_by_repository(analysis.repository.url)
            if len(history_items) >= 2:
                trends = compute_cmdi_trends(
                    repository_name=analysis.repository.name,
                    repository_url=analysis.repository.url,
                    analyses=history_items,
                )
                trend_summary = {
                    "total_historical_runs": trends.total_analyses,
                    "overall_trend": trends.overall_trend,
                    "net_cmdi_delta": trends.net_cmdi_delta,
                    "earliest_date": trends.earliest_date,
                    "latest_date": trends.latest_date,
                }
        except Exception:
            trend_summary = None

    # 5. Formulate actionable recommended next steps
    next_steps: List[str] = []

    critical_priority = [p for p in prioritized if p.priority_tier == "Critical Attention"]
    high_priority = [p for p in prioritized if p.priority_tier == "High Priority"]

    if critical_priority:
        top_crit = critical_priority[0]
        next_steps.append(
            f"Remediate top critical finding '{top_crit.title}' in {top_crit.file} ({top_crit.line_range})."
        )

    crit_hotspots = [h for h in ranked_hotspots if h.overall_hotspot_classification == "Critical Hotspot"]
    if crit_hotspots:
        top_hotspot = crit_hotspots[0]
        next_steps.append(
            f"Decouple architectural hotspot '{top_hotspot.module_name}' to reduce blast radius (Ca={top_hotspot.afferent_coupling})."
        )

    if high_priority and len(next_steps) < 3:
        top_high = high_priority[0]
        next_steps.append(
            f"Refactor high-priority issue '{top_high.title}' in {top_high.file}."
        )

    dup_insight = next((ins for ins in insights if ins.id == "PAT-DUP-002" and ins.detected), None)
    if dup_insight and len(next_steps) < 4:
        next_steps.append("Consolidate duplicated code blocks into a shared utility module.")

    err_insight = next((ins for ins in insights if ins.id == "PAT-ERR-001" and ins.detected), None)
    if err_insight and len(next_steps) < 4:
        next_steps.append("Replace swallowed or broad exceptions with specific exception classes and logging.")

    if not next_steps:
        next_steps.append("Codebase maintainability is healthy; continue regular automated regression scanning.")

    # 6. Provenance notes
    provenance = [
        "Python AST static analysis performed deterministically.",
        "CMDI is a project-defined heuristic index, not an industry certified standard.",
        "Pattern insights describe structural code patterns and do not determine author identity.",
    ]

    crit_findings_count = sum(1 for f in (analysis.findings or []) if (f.severity or "").lower() == "critical")
    high_findings_count = sum(1 for f in (analysis.findings or []) if (f.severity or "").lower() == "high")

    is_score_available = (
        analysis.summary.score_available
        if hasattr(analysis.summary, "score_available")
        else (analysis.summary.cmdi is not None and analysis.summary.risk_category != "Not Available")
    )

    return DeveloperReportResponse(
        repository_name=analysis.repository.name,
        repository_url=analysis.repository.url,
        analysis_date=analysis.timestamp,
        display_date=analysis.display_timestamp,
        commit_hash=analysis.repository.commit_hash,
        branch=analysis.repository.branch or "main",
        cmdi=analysis.summary.cmdi if is_score_available else None,
        score_available=is_score_available,
        risk_category=analysis.summary.risk_category,
        risk_severity=analysis.summary.risk_severity,
        indicator_summary=analysis.summary.breakdown.indicators if (analysis.summary and analysis.summary.breakdown) else [],
        total_findings=len(analysis.findings or []),
        critical_findings_count=crit_findings_count,
        high_findings_count=high_findings_count,
        prioritized_findings=prioritized[:10],
        main_hotspots=ranked_hotspots[:6],
        pattern_insights=insights,
        historical_trend_summary=trend_summary,
        recommended_next_steps=next_steps,
        data_provenance_notes=provenance,
    )
