"""CodeSentinel AI - Technical Debt Prioritization Engine.

Transparent multi-factor heuristic for prioritizing static analysis findings:
- Considers analyzer severity, tangible evidence, affected module coupling, and risk blast radius.
- Assigns findings to four clear tiers:
  * Critical Attention (80–100)
  * High Priority (55–79)
  * Medium Priority (30–54)
  * Low Priority (0–29)
- Enforces deterministic ranking and strict deduplication.
- Explicitly states that prioritization is a CodeSentinel AI heuristic, not an industry standard.
"""

from typing import List, Dict, Any, Set, Optional
from app.models.schemas import FindingModel, PrioritizedFinding, AnalysisResult
from app.analyzer.recommendations import generate_refactoring_guidance


PRIORITIZATION_DISCLAIMER = (
    "Technical debt prioritization tiers and scores are project-defined heuristics "
    "developed for CodeSentinel AI, not an official industry or certified standard. "
    "Rankings are derived from static analyzer severity, tangible evidence magnitude, "
    "and architectural module blast radius."
)


def calculate_finding_priority_score(
    finding: FindingModel,
    module_hotspots: Optional[Set[str]] = None,
    high_coupling_modules: Optional[Set[str]] = None,
) -> int:
    """Calculates a deterministic 0-100 priority score based on multi-factor heuristic evidence."""
    hotspots = module_hotspots or set()
    coupled = high_coupling_modules or set()

    # 1. Base Severity Contribution (Max 45)
    sev = (finding.severity or "").lower()
    if sev == "critical":
        base_sev = 45
    elif sev == "high":
        base_sev = 32
    elif sev == "medium":
        base_sev = 18
    else:  # low / info
        base_sev = 8

    # 2. Structural Defect & Evidence Contribution (Max 35)
    cat = (finding.category or "").lower()
    rule = (finding.rule_id or "").lower()
    evidence_score = 0

    # Circular dependencies are immediate high-blast architectural risks
    if "coupling" in cat or "circular" in rule:
        evidence_score += 30
    elif "complexity" in cat or "cyclomatic" in rule:
        # Check measured cyclomatic value if available
        meas = finding.evidence.measured_value if finding.evidence else None
        if meas is not None:
            try:
                val = float(meas)
                if val >= 25:
                    evidence_score += 25
                elif val >= 15:
                    evidence_score += 18
                else:
                    evidence_score += 10
            except (ValueError, TypeError):
                evidence_score += 15
        else:
            evidence_score += 15
    elif "duplication" in cat or "clone" in rule:
        evidence_score += 18
    elif "error" in cat or "except" in rule:
        evidence_score += 20
    else:
        evidence_score += 10

    # 3. Architectural Blast Radius & Module Context (Max 20)
    blast_score = 0
    file_path = finding.file or ""
    if file_path in hotspots:
        blast_score += 12
    if file_path in coupled:
        blast_score += 8

    # Sum & clamp strictly within [0, 100]
    total = base_sev + evidence_score + blast_score
    return max(0, min(100, int(total)))


def resolve_priority_tier(score: int) -> str:
    """Maps priority score into an actionable priority tier."""
    if score >= 80:
        return "Critical Attention"
    elif score >= 55:
        return "High Priority"
    elif score >= 30:
        return "Medium Priority"
    else:
        return "Low Priority"


def prioritize_findings(
    findings: List[FindingModel],
    hotspots: Optional[List[Any]] = None,
    architecture_nodes: Optional[List[Any]] = None,
) -> List[PrioritizedFinding]:
    """Prioritizes and deduplicates findings deterministically.
    
    Guarantees:
    - Never invents evidence.
    - Eliminates duplicates based on (rule_id, file, line_range).
    - Sorts descending by priority_score, then severity rank, then rule_id, then file.
    """
    if not findings:
        return []

    # Build module context sets
    hotspot_files = set()
    if hotspots:
        for h in hotspots:
            h_file = getattr(h, "file", None) if hasattr(h, "file") else h.get("file")
            if h_file:
                hotspot_files.add(h_file)

    coupled_files = set()
    if architecture_nodes:
        for node in architecture_nodes:
            afferent = (
                getattr(node, "afferent_coupling", None)
                if hasattr(node, "afferent_coupling")
                else (node.get("afferent_coupling") or node.get("afferentCoupling", 0))
            )
            full_path = (
                getattr(node, "full_path", None)
                if hasattr(node, "full_path")
                else (node.get("full_path") or node.get("fullPath") or node.get("label", ""))
            )
            if afferent and afferent >= 3 and full_path:
                coupled_files.add(full_path)

    # Severity ordering rank for deterministic tie-breaking
    sev_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    seen_keys: Set[str] = set()
    scored_items = []

    for f in findings:
        # Deduplication key: rule_id + file + line_range
        dedup_key = f"{f.rule_id}::{f.file}::{f.line_range}".strip().lower()
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        score = calculate_finding_priority_score(f, hotspot_files, coupled_files)
        tier = resolve_priority_tier(score)
        guidance = generate_refactoring_guidance(f)

        # Build evidence text
        ev_text = ""
        if f.evidence:
            ev = f.evidence
            parts = []
            if ev.metric_name and ev.measured_value is not None:
                parts.append(f"{ev.metric_name}={ev.measured_value}")
            if ev.cycle_chain:
                parts.append(f"cycle: {' -> '.join(ev.cycle_chain)}")
            if ev.clone_target_file:
                parts.append(f"clone: {ev.clone_target_file} ({ev.clone_target_lines or ''})")
            ev_text = "; ".join(parts) if parts else (f.summary or "Verified static measurement")
        else:
            ev_text = f.summary or "Verified static measurement"

        next_action = f.recommended_remediation or guidance.recommended_change

        rationale = (
            f"Assigned {score}/100 priority based on {f.severity.upper()} severity"
            + (f" in architectural hotspot '{f.file}'" if f.file in hotspot_files else "")
            + (f" with significant coupling" if f.file in coupled_files else "")
            + "."
        )

        prioritized = PrioritizedFinding(
            finding_id=f.id,
            title=f.title,
            file=f.file,
            line_range=f.line_range,
            severity=f.severity,
            priority_tier=tier,
            priority_score=score,
            category=f.category,
            evidence=ev_text,
            why_it_matters=f.maintainability_impact or guidance.why_it_matters,
            recommended_next_action=next_action,
            refactoring_guidance=guidance,
            heuristic_rationale=rationale,
        )

        scored_items.append((
            score,
            sev_rank.get((f.severity or "").lower(), 0),
            f.rule_id or "",
            f.file or "",
            prioritized,
        ))

    # Deterministic sort: score DESC, severity_rank DESC, rule_id ASC, file ASC
    scored_items.sort(key=lambda x: (-x[0], -x[1], x[2], x[3]))
    return [item[4] for item in scored_items]
