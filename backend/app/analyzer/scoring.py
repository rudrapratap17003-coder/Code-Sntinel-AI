"""CodeSentinel AI - Technical Debt Scoring Engine & Maintainability Summary.

Composite Maintenance Debt Index (CMDI) Specification:
- Scale: 0 to 100 (higher = greater maintainability risk).
- Tiers:
  * 0–25: Low Risk
  * 26–50: Moderate Risk
  * 51–75: High Risk
  * 76–100: Critical Risk
- Indicator Weightings (equal 25% balance):
  1. Cyclomatic Complexity (25%): Normalized from max McCabe complexity (10 -> 0, 40 -> 100).
  2. Code Duplication (25%): Normalized from duplicate lines percentage (0% -> 0, 25% -> 100).
  3. Architectural Coupling (25%): Normalized from circular cycles (35 pts/cycle) + afferent coupling.
  4. Error-Handling Risk (25%): Normalized from adherence score (100 - adherence_score).

Explicit Disclaimers:
The Composite Maintenance Debt Index (CMDI) is an internal CodeSentinel AI product heuristic,
not a scientifically validated or universally accepted industry standard.
"""

from typing import Dict, Any, List, Tuple


def normalize_indicator_risks(
    max_complexity: int,
    duplication_percent: float,
    circular_cycles_count: int,
    max_afferent_coupling: int,
    error_adherence_score: int,
) -> Dict[str, float]:
    """Normalizes raw measurements into standardized 0–100 risk sub-scores."""
    # 1. Complexity Risk (0-100): McCabe <= 10 -> 0; McCabe >= 40 -> 100
    if max_complexity <= 10:
        complexity_risk = 0.0
    else:
        complexity_risk = min(100.0, round(((max_complexity - 10) / 30.0) * 100.0, 1))

    # 2. Duplication Risk (0-100): 0% -> 0; >= 25% -> 100
    duplication_risk = min(100.0, round((duplication_percent / 25.0) * 100.0, 1))

    # 3. Coupling Risk (0-100): 35 pts per circular cycle + afferent coupling contribution
    cycle_contrib = circular_cycles_count * 35.0
    coupling_factor_contrib = min(30.0, (max_afferent_coupling / 20.0) * 30.0)
    coupling_risk = min(100.0, round(cycle_contrib + coupling_factor_contrib, 1))

    # 4. Error-Handling Risk (0-100): 100 - adherence_score
    error_risk = round(float(max(0, 100 - error_adherence_score)), 1)

    return {
        "complexity_risk": complexity_risk,
        "duplication_risk": duplication_risk,
        "coupling_risk": coupling_risk,
        "error_handling_risk": error_risk,
    }


def compute_cmdi_summary(
    normalized_risks: Dict[str, float],
    findings_count: int,
    hotspots_count: int,
) -> Tuple[float, str, str, str, int]:
    """Computes weighted CMDI score, risk tier, severity token, interpretation, and fix estimate.
    
    Returns:
        (cmdi_score, risk_category, risk_severity, interpretation, remediation_estimate_hours)
    """
    weights = {
        "complexity_risk": 0.25,
        "duplication_risk": 0.25,
        "coupling_risk": 0.25,
        "error_handling_risk": 0.25,
    }

    weighted_sum = sum(normalized_risks[k] * weights[k] for k in weights)
    cmdi = round(weighted_sum, 1)

    if cmdi <= 25.0:
        risk_category = "Low Risk"
        risk_severity = "success"
        interpretation = "Codebase exhibits low branching complexity, minimal duplication, and clean module boundaries."
    elif cmdi <= 50.0:
        risk_category = "Moderate Risk"
        risk_severity = "info"
        interpretation = "Acceptable maintainability with localized complexity hotspots requiring engineering observation."
    elif cmdi <= 75.0:
        risk_category = "High Risk"
        risk_severity = "medium"
        interpretation = "Significant structural debt present. High cyclomatic complexity and coupling impede velocity."
    else:
        risk_category = "Critical Risk"
        risk_severity = "critical"
        interpretation = "Severe structural debt. High branching complexity, circular dependencies, and error anti-patterns threaten stability."

    # Heuristic remediation estimate: base 4 hours per finding + 8 hours per hotspot
    estimate_hours = max(4, (findings_count * 3) + (hotspots_count * 8))

    return cmdi, risk_category, risk_severity, interpretation, estimate_hours


def build_indicator_scores(
    normalized_risks: Dict[str, float],
    complexity_metrics: Dict[str, Any],
    duplication_metrics: Dict[str, Any],
    dependency_metrics: Dict[str, Any],
    error_metrics: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Constructs structured metadata cards for each of the 4 core indicators."""
    c_risk = normalized_risks["complexity_risk"]
    d_risk = normalized_risks["duplication_risk"]
    coup_risk = normalized_risks["coupling_risk"]
    e_risk = normalized_risks["error_handling_risk"]

    indicators = [
        {
            "id": "complexity",
            "name": "Cyclomatic Complexity",
            "raw_metric": f"{complexity_metrics.get('max_complexity', 0)} max / {complexity_metrics.get('avg_complexity', 0.0)} avg",
            "raw_values": complexity_metrics,
            "normalized_risk": c_risk,
            "weight": 0.25,
            "contribution": round(c_risk * 0.25, 1),
            "classification": "MEASURED",
            "severity": "critical" if c_risk >= 75 else "medium" if c_risk >= 50 else "info",
            "interpretation": (
                f"{complexity_metrics.get('functions_exceeding_threshold', 0)} function(s) exceed the threshold of 15 (max McCabe: {complexity_metrics.get('max_complexity', 0)})."
            ),
            "meaning": "Measures linearly independent logical paths through Python functions. High values indicate deeply nested branching.",
            "why_it_matters": "Functions with high cyclomatic complexity require exponential unit test branches and have a strong correlation with defect density.",
            "how_calculated": "Measured via Python AST branch counting (McCabe formula). Normalized: McCabe <= 10 = 0, >= 40 = 100 risk.",
            "evidence": f"Analyzed {complexity_metrics.get('total_functions', 0)} functions across repository files.",
            "developer_action": "Decompose deeply nested functions into smaller single-responsibility subroutines.",
            "filter_category": "Cyclomatic Complexity",
        },
        {
            "id": "duplication",
            "name": "Code Duplication",
            "raw_metric": f"{duplication_metrics.get('duplication_percent', 0.0)}%",
            "raw_values": duplication_metrics,
            "normalized_risk": d_risk,
            "weight": 0.25,
            "contribution": round(d_risk * 0.25, 1),
            "classification": "MEASURED",
            "severity": "critical" if d_risk >= 75 else "medium" if d_risk >= 40 else "info",
            "interpretation": (
                f"{duplication_metrics.get('duplicate_blocks_count', 0)} candidate duplicate blocks found ({duplication_metrics.get('total_duplicate_lines', 0)} duplicate lines)."
            ),
            "meaning": "Percentage of source code lines existing in identical or near-identical syntax clone sequences.",
            "why_it_matters": "Duplicated logic multiplies maintenance friction and leads to copy-paste bug propagation when one clone is patched but sister copies are overlooked.",
            "how_calculated": "Token sliding window (>= 10 lines) hashed across files. Normalized: 0% = 0, >= 25% = 100 risk.",
            "evidence": f"{duplication_metrics.get('total_duplicate_lines', 0)} lines out of {duplication_metrics.get('total_code_lines', 0)} total physical lines.",
            "developer_action": "Extract duplicate logic into reusable modules or common helper functions.",
            "filter_category": "Code Duplication",
        },
        {
            "id": "coupling",
            "name": "Architectural Coupling",
            "raw_metric": f"{dependency_metrics.get('circular_cycles_count', 0)} cycles / {dependency_metrics.get('max_afferent_coupling', 0)} max Ca",
            "raw_values": dependency_metrics,
            "normalized_risk": coup_risk,
            "weight": 0.25,
            "contribution": round(coup_risk * 0.25, 1),
            "classification": "MEASURED",
            "severity": "critical" if dependency_metrics.get("circular_cycles_count", 0) > 0 else "info",
            "interpretation": (
                f"{dependency_metrics.get('circular_cycles_count', 0)} circular dependency cycle(s) identified. Max callers on single module: {dependency_metrics.get('max_afferent_coupling', 0)}."
            ),
            "meaning": "Evaluates static import interdependencies, in-degree callers (Ca), out-degree dependencies (Ce), and circular loops.",
            "why_it_matters": "Circular dependencies hinder independent testing and packaging. High in-degree creates god-objects whose modification carries large blast radii.",
            "how_calculated": "Adjacency digraph constructed from AST import statements; Tarjan's SCC detects cycles.",
            "evidence": f"Total {dependency_metrics.get('total_dependencies', 0)} static import relationships across modules.",
            "developer_action": "Decouple circular imports by extracting shared interfaces into independent leaf modules.",
            "filter_category": "Architectural Coupling",
        },
        {
            "id": "error_handling",
            "name": "Error-Handling Consistency",
            "raw_metric": f"{error_metrics.get('adherence_score', 100)} / 100 adherence",
            "raw_values": error_metrics,
            "normalized_risk": e_risk,
            "weight": 0.25,
            "contribution": round(e_risk * 0.25, 1),
            "classification": "HEURISTIC",
            "severity": "critical" if e_risk >= 60 else "medium" if e_risk >= 30 else "info",
            "interpretation": (
                f"{error_metrics.get('violations_count', 0)} exception pattern violations found ({error_metrics.get('bare_except_count', 0)} bare except clauses)."
            ),
            "meaning": "Heuristic inspection of exception handling hygiene, flagging bare except clauses and silent swallowing.",
            "why_it_matters": "Silent swallowing obscures root-cause diagnostics and traps system shutdown signals.",
            "how_calculated": "AST pattern heuristics evaluate try/except structures. Adherence inverted to 0–100 risk score.",
            "evidence": f"{error_metrics.get('violations_count', 0)} flagged exception handling anti-patterns.",
            "developer_action": "Replace bare except clauses with explicit exception types and attach structured logging.",
            "filter_category": "Error-Handling Consistency",
        },
    ]

    return indicators
