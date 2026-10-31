"""CodeSentinel AI - Before-and-After Analysis Comparison Engine.

Performs deterministic diffing and comparative analysis between two snapshots of the same repository:
- Validates repository identity (rejects cross-repository comparisons).
- Establishes chronological sequence automatically (earlier baseline vs later target).
- Computes overall CMDI delta and indicator shifts.
- Classifies findings: newly detected, resolved (no longer detected), unresolved, and severity shifts.
- Identifies module risk shifts and new/resolved architectural hotspots.
- Produces an executive summary: improvements, regressions, invariants, and prioritized next actions.
- Warns if analysis scope or file count differed significantly.
"""

from typing import Dict, Any, List, Optional, Tuple, Set
from app.models.schemas import (
    AnalysisResult,
    ComparisonResponse,
    IndicatorComparison,
    FindingDiffItem,
    FindingsComparison,
    ModuleDiffItem,
    ModuleComparison,
    ComparisonSummary,
    FindingModel,
)
from app.analyzer.scoring import CMDI_DISCLAIMER


class ComparisonError(Exception):
    """Raised when analysis comparison cannot be performed reliably."""
    pass


def compare_analyses(analysis_a: AnalysisResult, analysis_b: AnalysisResult) -> ComparisonResponse:
    """Compares two historical analyses belonging to the same repository.
    
    Automatically orders analysis_a and analysis_b chronologically.
    """
    # 1. Normalize and verify repository identity
    repo_a = (analysis_a.repository.url or "").strip().rstrip("/")
    repo_b = (analysis_b.repository.url or "").strip().rstrip("/")

    if repo_a.lower() != repo_b.lower():
        raise ComparisonError(
            f"Cannot compare analyses from different repositories: '{analysis_a.repository.name}' ({repo_a}) vs '{analysis_b.repository.name}' ({repo_b})."
        )

    # 2. Chronological Ordering (earlier is baseline, later is target)
    if analysis_a.timestamp <= analysis_b.timestamp:
        earlier = analysis_a
        later = analysis_b
    else:
        earlier = analysis_b
        later = analysis_a

    # 3. Overall CMDI Comparison
    earlier_cmdi = earlier.summary.cmdi if (earlier.summary and earlier.summary.score_available) else None
    later_cmdi = later.summary.cmdi if (later.summary and later.summary.score_available) else None
    earlier_cat = earlier.summary.risk_category if earlier.summary else "Not Available"
    later_cat = later.summary.risk_category if later.summary else "Not Available"

    cmdi_diff: Optional[float] = None
    cmdi_status = "unavailable"

    if earlier_cmdi is not None and later_cmdi is not None:
        cmdi_diff = round(later_cmdi - earlier_cmdi, 2)
        if cmdi_diff < -0.2:
            cmdi_status = "improved"
        elif cmdi_diff > 0.2:
            cmdi_status = "regressed"
        else:
            cmdi_status = "unchanged"

    # 4. Indicator Comparison
    earlier_ind_map = {ind.id: ind for ind in (earlier.indicators or [])}
    later_ind_map = {ind.id: ind for ind in (later.indicators or [])}
    all_ind_ids = ["complexity", "duplication", "coupling", "error_handling"]

    ind_comparisons: List[IndicatorComparison] = []
    for ind_id in all_ind_ids:
        e_ind = earlier_ind_map.get(ind_id)
        l_ind = later_ind_map.get(ind_id)

        e_risk = e_ind.normalized_risk if e_ind else None
        l_risk = l_ind.normalized_risk if l_ind else None
        name = (l_ind.name if l_ind else None) or (e_ind.name if e_ind else ind_id.replace("_", " ").title())
        e_raw = e_ind.raw_metric if e_ind else None
        l_raw = l_ind.raw_metric if l_ind else None

        delta: Optional[float] = None
        status = "unavailable"

        if e_risk is not None and l_risk is not None:
            delta = round(l_risk - e_risk, 2)
            if delta < -0.2:
                status = "improved"
            elif delta > 0.2:
                status = "regressed"
            else:
                status = "unchanged"

        ind_comparisons.append(
            IndicatorComparison(
                id=ind_id,
                name=name,
                earlier_risk=e_risk,
                later_risk=l_risk,
                earlier_raw=e_raw,
                later_raw=l_raw,
                delta=delta,
                status=status,
            )
        )

    # 5. Findings Comparison
    def finding_key(f: FindingModel) -> str:
        rule = (f.rule_id or "").strip().lower()
        file_path = (f.file or "").strip().lower()
        lines = (f.line_range or "").strip().lower()
        return f"{rule}::{file_path}::{lines}"

    earlier_findings_map = {finding_key(f): f for f in (earlier.findings or [])}
    later_findings_map = {finding_key(f): f for f in (later.findings or [])}

    newly_detected: List[FindingDiffItem] = []
    no_longer_detected: List[FindingDiffItem] = []
    unresolved: List[FindingDiffItem] = []
    severity_changed: List[FindingDiffItem] = []

    # Check later findings against earlier
    for key, f_late in later_findings_map.items():
        if key not in earlier_findings_map:
            newly_detected.append(
                FindingDiffItem(
                    id=f_late.id,
                    title=f_late.title,
                    rule_id=f_late.rule_id,
                    file=f_late.file,
                    line_range=f_late.line_range,
                    earlier_severity=None,
                    later_severity=f_late.severity,
                    category=f_late.category,
                    evidence_summary=f_late.summary,
                )
            )
        else:
            f_early = earlier_findings_map[key]
            e_sev = (f_early.severity or "").lower()
            l_sev = (f_late.severity or "").lower()
            if e_sev != l_sev:
                severity_changed.append(
                    FindingDiffItem(
                        id=f_late.id,
                        title=f_late.title,
                        rule_id=f_late.rule_id,
                        file=f_late.file,
                        line_range=f_late.line_range,
                        earlier_severity=f_early.severity,
                        later_severity=f_late.severity,
                        category=f_late.category,
                        evidence_summary=f_late.summary,
                    )
                )
            else:
                unresolved.append(
                    FindingDiffItem(
                        id=f_late.id,
                        title=f_late.title,
                        rule_id=f_late.rule_id,
                        file=f_late.file,
                        line_range=f_late.line_range,
                        earlier_severity=f_early.severity,
                        later_severity=f_late.severity,
                        category=f_late.category,
                        evidence_summary=f_late.summary,
                    )
                )

    # Check earlier findings that disappeared
    for key, f_early in earlier_findings_map.items():
        if key not in later_findings_map:
            no_longer_detected.append(
                FindingDiffItem(
                    id=f_early.id,
                    title=f_early.title,
                    rule_id=f_early.rule_id,
                    file=f_early.file,
                    line_range=f_early.line_range,
                    earlier_severity=f_early.severity,
                    later_severity=None,
                    category=f_early.category,
                    evidence_summary=f_early.summary,
                )
            )

    findings_disclaimer = (
        "Note: Findings marked 'no longer detected' reflect issues absent in the later report. "
        "If repository file scope or analysis configuration changed between runs, absence does not "
        "guarantee an intentional code refactoring."
    )

    # 6. Module & Hotspot Comparison
    earlier_hotspots = {h.file: h for h in (earlier.hotspots or []) if h.file}
    later_hotspots = {h.file: h for h in (later.hotspots or []) if h.file}

    new_hotspots = [f for f in later_hotspots.keys() if f not in earlier_hotspots]
    resolved_hotspots = [f for f in earlier_hotspots.keys() if f not in later_hotspots]

    # Module risk shifts
    earlier_modules = {n.full_path or n.label: n for n in (earlier.architecture.nodes or [])}
    later_modules = {n.full_path or n.label: n for n in (later.architecture.nodes or [])}
    all_modules = set(earlier_modules.keys()) | set(later_modules.keys())

    increased_risk_mods: List[ModuleDiffItem] = []
    reduced_risk_mods: List[ModuleDiffItem] = []

    for mod in sorted(all_modules):
        e_n = earlier_modules.get(mod)
        l_n = later_modules.get(mod)
        e_comp = e_n.complexity if e_n else 0
        l_comp = l_n.complexity if l_n else 0
        e_coup = (e_n.afferent_coupling + e_n.efferent_coupling) if e_n else 0
        l_coup = (l_n.afferent_coupling + l_n.efferent_coupling) if l_n else 0

        # Count module findings
        e_finds = sum(1 for f in (earlier.findings or []) if f.file == mod)
        l_finds = sum(1 for f in (later.findings or []) if f.file == mod)

        if l_comp > e_comp or l_coup > e_coup or l_finds > e_finds:
            increased_risk_mods.append(
                ModuleDiffItem(
                    module_name=mod,
                    earlier_findings=e_finds,
                    later_findings=l_finds,
                    earlier_complexity=e_comp,
                    later_complexity=l_comp,
                    earlier_coupling=e_coup,
                    later_coupling=l_coup,
                    status="increased_risk",
                )
            )
        elif l_comp < e_comp or l_coup < e_coup or l_finds < e_finds:
            reduced_risk_mods.append(
                ModuleDiffItem(
                    module_name=mod,
                    earlier_findings=e_finds,
                    later_findings=l_finds,
                    earlier_complexity=e_comp,
                    later_complexity=l_comp,
                    earlier_coupling=e_coup,
                    later_coupling=l_coup,
                    status="reduced_risk",
                )
            )

    # 7. Summary Narrative Construction
    what_improved = []
    what_worsened = []
    what_unchanged = []
    next_actions = []

    if cmdi_diff is not None:
        if cmdi_diff < -0.2:
            what_improved.append(f"Overall CMDI score improved by {abs(cmdi_diff):.1f} points ({earlier_cmdi:.1f} -> {later_cmdi:.1f}).")
        elif cmdi_diff > 0.2:
            what_worsened.append(f"Overall CMDI score regressed by {cmdi_diff:.1f} points ({earlier_cmdi:.1f} -> {later_cmdi:.1f}).")
        else:
            what_unchanged.append(f"Overall CMDI score remained stable at {later_cmdi:.1f}.")

    for ind in ind_comparisons:
        if ind.status == "improved":
            what_improved.append(f"{ind.name} risk dropped by {abs(ind.delta):.1f} points.")
        elif ind.status == "regressed":
            what_worsened.append(f"{ind.name} risk rose by {ind.delta:.1f} points.")
        elif ind.status == "unchanged":
            what_unchanged.append(f"{ind.name} risk remained unchanged.")

    if len(no_longer_detected) > 0:
        what_improved.append(f"{len(no_longer_detected)} previous finding(s) no longer detected.")
    if len(resolved_hotspots) > 0:
        what_improved.append(f"{len(resolved_hotspots)} hotspot module(s) resolved ({', '.join(resolved_hotspots[:3])}).")

    if len(newly_detected) > 0:
        what_worsened.append(f"{len(newly_detected)} new maintainability finding(s) introduced.")
    if len(new_hotspots) > 0:
        what_worsened.append(f"{len(new_hotspots)} new hotspot module(s) emerged ({', '.join(new_hotspots[:3])}).")

    if len(unresolved) > 0:
        what_unchanged.append(f"{len(unresolved)} finding(s) remain unresolved across both analyses.")

    if newly_detected:
        crit_new = [f for f in newly_detected if (f.later_severity or "").lower() == "critical"]
        if crit_new:
            next_actions.append(f"Immediately address {len(crit_new)} newly introduced critical finding(s).")
    if new_hotspots:
        next_actions.append(f"Inspect new architectural hotspot '{new_hotspots[0]}' for uncontained coupling or complexity.")
    if unresolved:
        next_actions.append(f"Triage {len(unresolved)} persistent unresolved findings using the prioritization matrix.")

    if not next_actions:
        next_actions.append("Maintain existing modular patterns and establish regression test coverage.")

    # Scope change warning
    scope_warning = None
    files_e = earlier.repository.files_examined if earlier.repository else 0
    files_l = later.repository.files_examined if later.repository else 0
    if abs(files_l - files_e) > 0:
        scope_warning = (
            f"Analysis scope changed: earlier snapshot evaluated {files_e} files while later evaluated {files_l} files. "
            "Differences in findings or hotspots may reflect altered codebase coverage rather than direct refactoring."
        )

    return ComparisonResponse(
        base_analysis_id=earlier.id,
        target_analysis_id=later.id,
        repository_name=later.repository.name,
        repository_url=later.repository.url,
        earlier_timestamp=earlier.timestamp,
        later_timestamp=later.timestamp,
        earlier_commit=earlier.repository.commit_hash,
        later_commit=later.repository.commit_hash,
        earlier_cmdi=earlier_cmdi,
        later_cmdi=later_cmdi,
        earlier_category=earlier_cat,
        later_category=later_cat,
        cmdi_difference=cmdi_diff,
        cmdi_status=cmdi_status,
        indicators=ind_comparisons,
        findings=FindingsComparison(
            newly_detected=newly_detected,
            no_longer_detected=no_longer_detected,
            unresolved=unresolved,
            severity_changed=severity_changed,
            disclaimer=findings_disclaimer,
        ),
        modules=ModuleComparison(
            increased_risk_modules=increased_risk_mods,
            reduced_risk_modules=reduced_risk_mods,
            newly_detected_hotspots=new_hotspots,
            resolved_hotspots=resolved_hotspots,
        ),
        summary=ComparisonSummary(
            what_improved=what_improved,
            what_worsened=what_worsened,
            what_remained_unchanged=what_unchanged,
            recommended_next_actions=next_actions,
            scope_change_warning=scope_warning,
        ),
        heuristic_disclaimer=CMDI_DISCLAIMER,
    )
