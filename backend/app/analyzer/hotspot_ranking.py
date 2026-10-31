"""CodeSentinel AI - Module Hotspot Ranking Engine.

Ranks codebase modules by technical debt and architectural friction using actual
static analysis metrics:
- Reuses architecture graph nodes, dependency cycles, hotspots, and static findings.
- Calculates findings count and severity distribution per module.
- Synthesizes cyclomatic complexity, coupling, duplication, and error violations.
- Classifies modules into:
  * Critical Hotspot
  * High Risk Hotspot
  * Moderate Risk
  * Stable Module
- Explains why each module is classified as a hotspot without relying on file size alone.
"""

from typing import List, Dict, Any, Optional
from collections import defaultdict
from app.models.schemas import (
    AnalysisResult,
    FindingModel,
    HotspotModel,
    ModuleNode,
    ModuleHotspotRankItem,
)


def classify_module_risk(
    findings_count: int,
    critical_findings: int,
    high_findings: int,
    highest_complexity: int,
    afferent_coupling: int,
    in_circular_cycle: bool,
    error_violations: int,
    duplicate_lines: int,
) -> str:
    """Classifies a module into an architectural risk tier based on multi-factor metrics."""
    # Critical Hotspot conditions
    if (
        in_circular_cycle
        or critical_findings >= 2
        or (critical_findings >= 1 and (highest_complexity >= 20 or afferent_coupling >= 4))
        or highest_complexity >= 30
    ):
        return "Critical Hotspot"

    # High Risk Hotspot conditions
    if (
        critical_findings >= 1
        or high_findings >= 2
        or highest_complexity >= 15
        or (afferent_coupling >= 4 and findings_count >= 2)
        or (error_violations >= 3 and highest_complexity >= 10)
        or duplicate_lines >= 40
    ):
        return "High Risk Hotspot"

    # Moderate Risk conditions
    if (
        high_findings >= 1
        or findings_count >= 2
        or highest_complexity >= 8
        or afferent_coupling >= 2
        or error_violations >= 1
        or duplicate_lines >= 15
    ):
        return "Moderate Risk"

    return "Stable Module"


def generate_hotspot_rationale(
    classification: str,
    highest_complexity: int,
    afferent_coupling: int,
    efferent_coupling: int,
    in_circular_cycle: bool,
    findings_count: int,
    critical_count: int,
    duplicate_lines: int,
    error_violations: int,
) -> str:
    """Explains why a module was classified into its respective hotspot tier."""
    reasons = []

    if in_circular_cycle:
        reasons.append("participates in a circular dependency cycle")
    if critical_count > 0:
        reasons.append(f"contains {critical_count} critical severity finding(s)")
    if highest_complexity >= 15:
        reasons.append(f"peak cyclomatic complexity of {highest_complexity} exceeds maintainable thresholds")
    if afferent_coupling >= 4:
        reasons.append(f"has high incoming caller coupling (Ca={afferent_coupling}), magnifying refactoring blast radius")
    if duplicate_lines >= 25:
        reasons.append(f"contains {duplicate_lines} duplicated lines")
    if error_violations >= 2:
        reasons.append(f"exhibits {error_violations} error-handling anti-patterns")
    if findings_count >= 3 and not reasons:
        reasons.append(f"accumulated {findings_count} distinct maintainability findings")

    if not reasons:
        return "Module exhibits clean structural boundaries, manageable function complexity, and no open critical findings."

    return f"Designated as {classification} because it {', and '.join(reasons)}."


def rank_modules(analysis: AnalysisResult) -> List[ModuleHotspotRankItem]:
    """Generates a ranked list of all analyzed modules sorted by risk factor and findings count."""
    # 1. Index findings by file
    findings_by_file: Dict[str, List[FindingModel]] = defaultdict(list)
    for f in analysis.findings:
        if f.file:
            findings_by_file[f.file].append(f)

    # 2. Index hotspots by file
    hotspots_by_file: Dict[str, HotspotModel] = {}
    for h in analysis.hotspots:
        if h.file:
            hotspots_by_file[h.file] = h

    # 3. Gather all module names from architecture nodes and findings
    module_names = set()
    node_map: Dict[str, ModuleNode] = {}
    if analysis.architecture and analysis.architecture.nodes:
        for node in analysis.architecture.nodes:
            key = node.full_path or node.label or node.id
            node_map[key] = node
            module_names.add(key)

    for file_path in findings_by_file.keys():
        module_names.add(file_path)

    for file_path in hotspots_by_file.keys():
        module_names.add(file_path)

    # 4. Synthesize module metrics
    results: List[ModuleHotspotRankItem] = []

    for name in module_names:
        file_findings = findings_by_file.get(name, [])
        sev_dist: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for f in file_findings:
            s = (f.severity or "low").lower()
            if s in sev_dist:
                sev_dist[s] += 1
            else:
                sev_dist["low"] += 1

        node = node_map.get(name)
        hotspot = hotspots_by_file.get(name)

        loc = node.loc if node else 0
        afferent = node.afferent_coupling if node else (hotspot.afferent_coupling if hotspot else 0)
        efferent = node.efferent_coupling if node else (hotspot.efferent_coupling if hotspot else 0)
        instability = node.instability if node else 0.0
        in_circular = hotspot.in_circular_cycle if hotspot else False
        highest_complexity = hotspot.complexity if hotspot else (node.complexity if node else 1)
        total_complexity = hotspot.total_complexity if hotspot else highest_complexity
        duplicate_lines = hotspot.duplicate_lines if hotspot else 0
        error_violations = hotspot.error_violations_count if hotspot else 0

        classification = classify_module_risk(
            findings_count=len(file_findings),
            critical_findings=sev_dist["critical"],
            high_findings=sev_dist["high"],
            highest_complexity=highest_complexity,
            afferent_coupling=afferent,
            in_circular_cycle=in_circular,
            error_violations=error_violations,
            duplicate_lines=duplicate_lines,
        )

        rationale = generate_hotspot_rationale(
            classification=classification,
            highest_complexity=highest_complexity,
            afferent_coupling=afferent,
            efferent_coupling=efferent,
            in_circular_cycle=in_circular,
            findings_count=len(file_findings),
            critical_count=sev_dist["critical"],
            duplicate_lines=duplicate_lines,
            error_violations=error_violations,
        )

        associated_ids = [f.id for f in file_findings]

        results.append(
            ModuleHotspotRankItem(
                module_name=name,
                findings_count=len(file_findings),
                severity_distribution=sev_dist,
                highest_cyclomatic_complexity=highest_complexity,
                total_cyclomatic_complexity=total_complexity,
                loc=loc,
                afferent_coupling=afferent,
                efferent_coupling=efferent,
                instability=round(instability, 2),
                in_circular_cycle=in_circular,
                duplicate_lines=duplicate_lines,
                error_violations_count=error_violations,
                overall_hotspot_classification=classification,
                why_it_matters=rationale,
                associated_finding_ids=associated_ids,
            )
        )

    # Deterministic ranking:
    # 1. Risk Tier weight: Critical=4, High=3, Moderate=2, Stable=1
    # 2. Critical findings count DESC
    # 3. Total findings count DESC
    # 4. Highest complexity DESC
    # 5. Module name ASC
    tier_weight = {
        "Critical Hotspot": 4,
        "High Risk Hotspot": 3,
        "Moderate Risk": 2,
        "Stable Module": 1,
    }

    results.sort(
        key=lambda m: (
            -tier_weight.get(m.overall_hotspot_classification, 1),
            -m.severity_distribution.get("critical", 0),
            -m.findings_count,
            -m.highest_cyclomatic_complexity,
            m.module_name,
        )
    )

    return results
