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

Indicator Severity Policy:
- [0–25]: "info" (Low Risk)
- [26–50]: "medium" (Moderate Risk)
- [51–75]: "high" (High Risk)
- [76–100] or circular dependency cycles: "critical" (Critical Risk)

Explicit Disclaimers:
The Composite Maintenance Debt Index (CMDI) is a project-defined heuristic index,
not an industry certified or universal standard. Its tiers and weightings are
engineering heuristics designed for CodeSentinel AI and have not been scientifically validated.
"""

import math
from typing import Dict, Any, List, Tuple, Optional, NamedTuple
from app.models.schemas import ScoringBreakdown, IndicatorBreakdown


BASE_INDICATOR_WEIGHTS: Dict[str, float] = {
    "complexity_risk": 0.25,
    "duplication_risk": 0.25,
    "coupling_risk": 0.25,
    "error_handling_risk": 0.25,
}

INDICATOR_ID_TO_RISK_KEY: Dict[str, str] = {
    "complexity": "complexity_risk",
    "duplication": "duplication_risk",
    "coupling": "coupling_risk",
    "error_handling": "error_handling_risk",
}

RISK_KEY_TO_INDICATOR_ID: Dict[str, str] = {v: k for k, v in INDICATOR_ID_TO_RISK_KEY.items()}

CMDI_DISCLAIMER: str = (
    "The Code Maintainability Debt Index (CMDI) is a project-defined heuristic index, "
    "not an industry certified or universal standard. Its tiers and weightings are "
    "engineering heuristics designed for CodeSentinel AI and have not been scientifically validated."
)


def _safe_float(val: Any, default: Optional[float] = None) -> Optional[float]:
    """Safely converts input to a finite float. Returns default if None, non-finite, or unparseable."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def _safe_int(val: Any, default: Optional[int] = None) -> Optional[int]:
    """Safely converts input to a finite integer. Returns default if None, non-finite, or unparseable."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return int(f)
    except (ValueError, TypeError):
        return default


def resolve_indicator_severity(
    normalized_risk: Optional[float],
    is_circular: bool = False,
) -> str:
    """Resolves intentional severity label for an individual indicator.
    
    Standardized Indicator Severity Scale:
    - None (Unavailable): "info"
    - Critical: is_circular or normalized_risk > 75.0 (circular imports are immediate structural defects)
    - High: 50.0 < normalized_risk <= 75.0
    - Medium: 25.0 < normalized_risk <= 50.0
    - Info / Low: 0.0 <= normalized_risk <= 25.0
    """
    if normalized_risk is None:
        return "info"

    if is_circular or normalized_risk > 75.0:
        return "critical"
    elif normalized_risk > 50.0:
        return "high"
    elif normalized_risk > 25.0:
        return "medium"
    else:
        return "info"


def determine_risk_tier(cmdi: Optional[float]) -> Tuple[str, str]:
    """Resolves risk category and severity token for a given CMDI score.
    
    Category boundaries:
    - 0 to 25: Low Risk (severity: success)
    - 26 to 50: Moderate Risk (severity: info)
    - 51 to 75: High Risk (severity: medium)
    - 76 to 100: Critical Risk (severity: critical)
    
    Returns:
        (risk_category, risk_severity)
    """
    if cmdi is None:
        return "Not Available", "info"

    # Strictly clamp within [0.0, 100.0]
    score = max(0.0, min(100.0, cmdi))

    if score <= 25.0:
        return "Low Risk", "success"
    elif score <= 50.0:
        return "Moderate Risk", "info"
    elif score <= 75.0:
        return "High Risk", "medium"
    else:
        return "Critical Risk", "critical"


def construct_evidence_based_interpretation(
    cmdi: Optional[float],
    risk_category: str,
    normalized_risks: Dict[str, Optional[float]],
    indicators_data: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Constructs a non-contradictory interpretation strictly supported by actual analyzer results.
    
    Rules:
    - A detected circular dependency cannot be described as 'clean module boundaries'.
    - Significant duplication cannot be described as 'minimal duplication'.
    - High complexity cannot be described as 'low complexity'.
    - Positive statements are only emitted for verified, measured findings.
    - Missing metrics are explicitly flagged and never described as clean or risk-free.
    """
    if cmdi is None or risk_category == "Not Available":
        return (
            "Insufficient metric data available to determine maintainability tier. "
            "No supported Python source metrics could be analyzed."
        )

    # 1. Extract measured facts from indicator data or normalized risks
    by_id = {ind.get("id"): ind for ind in (indicators_data or [])}

    # Complexity facts
    c_risk = normalized_risks.get("complexity_risk")
    c_raw = by_id.get("complexity", {}).get("raw_values", {})
    max_comp = _safe_int(c_raw.get("max_complexity"))
    
    # Duplication facts
    d_risk = normalized_risks.get("duplication_risk")
    d_raw = by_id.get("duplication", {}).get("raw_values", {})
    dupl_pct = _safe_float(d_raw.get("duplication_percent"))

    # Coupling facts
    coup_risk = normalized_risks.get("coupling_risk")
    dep_raw = by_id.get("coupling", {}).get("raw_values", {})
    cycles = _safe_int(dep_raw.get("circular_cycles_count"), default=0) or (
        1 if (coup_risk is not None and coup_risk >= 35.0) else 0
    )
    max_ca = _safe_int(dep_raw.get("max_afferent_coupling"), default=0) or 0

    # Error handling facts
    e_risk = normalized_risks.get("error_handling_risk")
    err_raw = by_id.get("error_handling", {}).get("raw_values", {})
    violations = _safe_int(err_raw.get("violations_count"), default=0) or 0

    # 2. Identify concrete flaws and positive observations
    flaws: List[str] = []
    positives: List[str] = []
    unmeasured: List[str] = []

    # Architectural coupling evaluation
    if coup_risk is None:
        unmeasured.append("architectural coupling")
    elif cycles > 0:
        flaws.append(f"module boundaries are compromised by {cycles} circular dependency cycle(s)")
    elif max_ca >= 10:
        flaws.append(f"elevated caller coupling on god-module ({max_ca} dependent callers)")
    elif coup_risk <= 15.0:
        positives.append("clean module boundaries without circular cycles")

    # Code duplication evaluation
    if d_risk is None:
        unmeasured.append("code duplication")
    elif (dupl_pct is not None and dupl_pct >= 10.0) or (d_risk >= 40.0):
        pct_display = f"{dupl_pct:.1f}%" if dupl_pct is not None else "elevated"
        flaws.append(f"significant code duplication ({pct_display} duplicate lines)")
    elif d_risk <= 10.0:
        pct_display = f" ({dupl_pct:.1f}%)" if dupl_pct is not None else ""
        positives.append(f"minimal duplication{pct_display}")

    # Cyclomatic complexity evaluation
    if c_risk is None:
        unmeasured.append("cyclomatic complexity")
    elif (max_comp is not None and max_comp >= 15) or (c_risk >= 30.0):
        comp_display = f" (peak McCabe {max_comp})" if max_comp is not None else ""
        flaws.append(f"elevated branching complexity{comp_display}")
    elif c_risk == 0.0:
        comp_display = f" (max McCabe {max_comp})" if max_comp is not None else ""
        positives.append(f"low branching complexity{comp_display}")

    # Error handling evaluation
    if e_risk is None:
        unmeasured.append("error handling")
    elif violations > 0 or (e_risk >= 30.0):
        flaws.append(f"{violations} exception-handling anti-pattern(s)")
    elif e_risk <= 10.0:
        positives.append("consistent exception handling hygiene")

    # 3. Assemble narrative based on category and observations
    if risk_category == "Low Risk":
        if flaws:
            # Low overall score due to other zero-debt metrics, but specific structural defects exist!
            narrative = (
                f"Low overall maintainability debt (CMDI: {cmdi:.1f}), but {'; '.join(flaws)}. "
                f"Other measured indicators remain within acceptable thresholds."
            )
        else:
            measured_positive = ", ".join(positives) if positives else "acceptable metric thresholds across measured dimensions"
            narrative = f"Codebase exhibits low maintainability debt (CMDI: {cmdi:.1f}) with {measured_positive}."
    elif risk_category == "Moderate Risk":
        friction_points = "; ".join(flaws) if flaws else "localized complexity hotspots"
        narrative = (
            f"Moderate maintainability debt (CMDI: {cmdi:.1f}). Structural friction observed: {friction_points}. "
            f"Engineering observation and targeted refactoring recommended."
        )
    elif risk_category == "High Risk":
        friction_points = "; ".join(flaws) if flaws else "elevated branching complexity and dependency coupling"
        narrative = (
            f"High maintainability debt (CMDI: {cmdi:.1f}). Significant structural friction driven by {friction_points}. "
            f"Refactoring required to reduce maintenance drag and defect risk."
        )
    else:  # Critical Risk
        hazard_points = "; ".join(flaws) if flaws else "deep nesting, circular loops, and high coupling"
        narrative = (
            f"Critical structural debt (CMDI: {cmdi:.1f}). Severe maintainability hazards detected: {hazard_points}. "
            f"Immediate architectural intervention recommended."
        )

    if unmeasured:
        narrative += f" [Note: {', '.join(unmeasured)} could not be measured]."

    return narrative


def normalize_indicator_risks(
    max_complexity: Optional[int],
    duplication_percent: Optional[float],
    circular_cycles_count: Optional[int],
    max_afferent_coupling: Optional[int],
    error_adherence_score: Optional[int],
) -> Dict[str, Optional[float]]:
    """Normalizes raw measurements into standardized 0–100 risk sub-scores.
    
    Returns None for any indicator whose input cannot be measured or is non-finite.
    All non-None outputs are strictly clamped to [0.0, 100.0].
    """
    # 1. Complexity Risk (0-100): McCabe <= 10 -> 0; McCabe >= 40 -> 100
    safe_comp = _safe_int(max_complexity)
    if safe_comp is None:
        complexity_risk = None
    elif safe_comp <= 10:
        complexity_risk = 0.0
    else:
        complexity_risk = max(0.0, min(100.0, round(((safe_comp - 10) / 30.0) * 100.0, 1)))

    # 2. Duplication Risk (0-100): 0% -> 0; >= 25% -> 100
    safe_dupl = _safe_float(duplication_percent)
    if safe_dupl is None:
        duplication_risk = None
    elif safe_dupl <= 0.0:
        duplication_risk = 0.0
    else:
        duplication_risk = max(0.0, min(100.0, round((safe_dupl / 25.0) * 100.0, 1)))

    # 3. Coupling Risk (0-100): 35 pts per circular cycle + afferent coupling contribution (max 30 pts)
    safe_cycles = _safe_int(circular_cycles_count)
    safe_ca = _safe_int(max_afferent_coupling)
    if safe_cycles is None and safe_ca is None:
        coupling_risk = None
    else:
        cycles_val = max(0, safe_cycles or 0)
        ca_val = max(0, safe_ca or 0)
        cycle_contrib = cycles_val * 35.0
        ca_contrib = min(30.0, (ca_val / 20.0) * 30.0)
        coupling_risk = max(0.0, min(100.0, round(cycle_contrib + ca_contrib, 1)))

    # 4. Error-Handling Risk (0-100): 100 - adherence_score
    safe_err = _safe_int(error_adherence_score)
    if safe_err is None:
        error_risk = None
    else:
        clamped_adherence = max(0, min(100, safe_err))
        error_risk = max(0.0, min(100.0, round(float(100 - clamped_adherence), 1)))

    return {
        "complexity_risk": complexity_risk,
        "duplication_risk": duplication_risk,
        "coupling_risk": coupling_risk,
        "error_handling_risk": error_risk,
    }


class CmdiSummaryResult(NamedTuple):
    cmdi: Optional[float]
    risk_category: str
    risk_severity: str
    interpretation: str
    remediation_estimate_hours: int
    breakdown: ScoringBreakdown


def compute_cmdi_summary(
    normalized_risks: Dict[str, Optional[float]],
    findings_count: int = 0,
    hotspots_count: int = 0,
    indicators_data: Optional[List[Dict[str, Any]]] = None,
) -> CmdiSummaryResult:
    """Computes weighted CMDI score, risk tier, severity token, interpretation, fix estimate, and explainable breakdown.
    
    Dynamically reweights when indicators are missing (None) so that missing values do not
    falsely artificially deflate maintainability debt.
    
    Returns:
        CmdiSummaryResult(cmdi, risk_category, risk_severity, interpretation, remediation_estimate_hours, breakdown)
    """
    # 1. Identify available metrics
    available_keys = [k for k, v in normalized_risks.items() if v is not None]
    total_available_weight = sum(BASE_INDICATOR_WEIGHTS[k] for k in available_keys)

    effective_weights: Dict[str, float] = {}
    is_dynamically_weighted = False

    if total_available_weight > 0:
        if len(available_keys) < len(BASE_INDICATOR_WEIGHTS):
            is_dynamically_weighted = True
            for k in BASE_INDICATOR_WEIGHTS:
                if k in available_keys:
                    effective_weights[k] = BASE_INDICATOR_WEIGHTS[k] / total_available_weight
                else:
                    effective_weights[k] = 0.0
        else:
            effective_weights = {k: 0.25 for k in BASE_INDICATOR_WEIGHTS}

        weighted_sum = sum(normalized_risks[k] * effective_weights[k] for k in available_keys)
        cmdi: Optional[float] = max(0.0, min(100.0, round(weighted_sum, 1)))
        score_available = True
        risk_category, risk_severity = determine_risk_tier(cmdi)
    else:
        # All indicators are unavailable: do NOT present internal 0.0 as genuine clean-code score
        effective_weights = {k: 0.0 for k in BASE_INDICATOR_WEIGHTS}
        cmdi = None
        score_available = False
        risk_category = "Not Available"
        risk_severity = "info"

    # 2. Formula Expression Generation
    if total_available_weight == 0:
        formula_expr = "No measurable indicators available to compute CMDI"
    elif not is_dynamically_weighted:
        formula_expr = "CMDI = (0.25 × R_comp) + (0.25 × R_dupl) + (0.25 × R_coup) + (0.25 × R_error)"
    else:
        parts = []
        name_map = {
            "complexity_risk": "R_comp",
            "duplication_risk": "R_dupl",
            "coupling_risk": "R_coup",
            "error_handling_risk": "R_error",
        }
        for k in available_keys:
            w_str = f"{effective_weights[k]:.3f}".rstrip("0").rstrip(".")
            parts.append(f"({w_str} × {name_map.get(k, k)})")
        missing_count = len(BASE_INDICATOR_WEIGHTS) - len(available_keys)
        formula_expr = (
            f"CMDI = {' + '.join(parts)} "
            f"[Dynamic reweighting applied: {missing_count} unavailable indicator(s) reallocated across available dimensions. "
            f"Note: Score evaluates available indicators only and is not directly equivalent to standard 4-indicator profiles without qualification.]"
        )

    # 3. Build or Synchronize Breakdown Indicators
    breakdown_indicators: List[IndicatorBreakdown] = []

    if indicators_data is not None:
        for ind in indicators_data:
            risk_key = INDICATOR_ID_TO_RISK_KEY.get(ind.get("id"), "")
            risk_val = normalized_risks.get(risk_key)
            eff_w = effective_weights.get(risk_key, 0.0)
            contrib = round(risk_val * eff_w, 1) if (risk_val is not None and cmdi is not None) else 0.0
            contrib_pct = round((contrib / cmdi) * 100.0, 1) if (cmdi is not None and cmdi > 0 and risk_val is not None) else 0.0

            # Synchronize in-place with dictionary
            ind["effective_weight"] = round(eff_w, 3)
            ind["contribution"] = contrib
            ind["contribution_percentage"] = contrib_pct
            if risk_val is None:
                ind["classification"] = "UNAVAILABLE"
                ind["raw_metric"] = "Not available"

            breakdown_indicators.append(
                IndicatorBreakdown(
                    id=ind["id"],
                    name=ind["name"],
                    raw_metric=ind.get("raw_metric", "Not available"),
                    raw_values=ind.get("raw_values", {}),
                    normalized_risk=risk_val,
                    weight=0.25,
                    effective_weight=round(eff_w, 3),
                    contribution=contrib,
                    contribution_percentage=contrib_pct,
                    classification=ind.get("classification", "MEASURED"),
                    severity=ind.get("severity", "info"),
                    interpretation=ind.get("interpretation", ""),
                    meaning=ind.get("meaning", ""),
                    why_it_matters=ind.get("why_it_matters", ""),
                    how_calculated=ind.get("how_calculated", ""),
                    evidence=ind.get("evidence", ""),
                    developer_action=ind.get("developer_action", ""),
                    filter_category=ind.get("filter_category", ""),
                )
            )
    else:
        # Synthesize default breakdown indicators for standalone calls
        metadata_map = {
            "complexity_risk": {
                "id": "complexity",
                "name": "Cyclomatic Complexity",
                "meaning": "Measures linearly independent logical paths through Python functions. High values indicate deeply nested branching.",
                "why_it_matters": "Deeply nested functions require exponential unit test branches and have a strong correlation with defect density.",
                "how_calculated": "AST McCabe branch count. Normalized: <= 10 = 0 risk; >= 40 = 100 risk.",
                "filter_category": "Cyclomatic Complexity",
                "developer_action": "Decompose deeply nested functions into smaller single-responsibility subroutines.",
                "classification": "MEASURED",
            },
            "duplication_risk": {
                "id": "duplication",
                "name": "Code Duplication",
                "meaning": "Percentage of source code lines existing in identical or near-identical syntax clone sequences.",
                "why_it_matters": "Duplicated logic multiplies maintenance friction and leads to copy-paste bug propagation.",
                "how_calculated": "Sliding token window (>= 10 lines). Normalized: 0% = 0 risk; >= 25% = 100 risk.",
                "filter_category": "Code Duplication",
                "developer_action": "Extract duplicate logic into reusable modules or common helper functions.",
                "classification": "MEASURED",
            },
            "coupling_risk": {
                "id": "coupling",
                "name": "Architectural Coupling",
                "meaning": "Evaluates static import interdependencies, in-degree callers (Ca), out-degree dependencies (Ce), and circular loops.",
                "why_it_matters": "Circular dependencies hinder independent testing and packaging. High in-degree creates god-objects.",
                "how_calculated": "Adjacency digraph constructed from AST import statements; Tarjan's SCC detects cycles.",
                "filter_category": "Architectural Coupling",
                "developer_action": "Decouple circular imports by extracting shared interfaces into independent leaf modules.",
                "classification": "MEASURED",
            },
            "error_handling_risk": {
                "id": "error_handling",
                "name": "Error-Handling Consistency",
                "meaning": "Heuristic inspection of exception handling hygiene, flagging bare except clauses and silent swallowing.",
                "why_it_matters": "Silent swallowing obscures root-cause diagnostics and traps system shutdown signals.",
                "how_calculated": "AST pattern heuristics evaluate try/except structures. Adherence inverted to 0–100 risk score.",
                "filter_category": "Error-Handling Consistency",
                "developer_action": "Replace bare except clauses with explicit exception types and attach structured logging.",
                "classification": "HEURISTIC",
            },
        }

        for risk_key, meta in metadata_map.items():
            risk_val = normalized_risks.get(risk_key)
            eff_w = effective_weights.get(risk_key, 0.0)
            contrib = round(risk_val * eff_w, 1) if (risk_val is not None and cmdi is not None) else 0.0
            contrib_pct = round((contrib / cmdi) * 100.0, 1) if (cmdi is not None and cmdi > 0 and risk_val is not None) else 0.0

            if risk_val is None:
                status = "UNAVAILABLE"
                raw_metric = "Not available"
                interpretation_item = "Indicator data was not measurable or is unsupported."
                evidence_item = "No analyzable source data."
                sev = "info"
            else:
                status = meta["classification"]
                raw_metric = f"{risk_val:.1f} / 100 normalized risk"
                interpretation_item = f"Assigned normalized risk score of {risk_val:.1f}."
                evidence_item = f"Synthesized from input risk score {risk_val:.1f}."
                sev = resolve_indicator_severity(risk_val)

            breakdown_indicators.append(
                IndicatorBreakdown(
                    id=meta["id"],
                    name=meta["name"],
                    raw_metric=raw_metric,
                    raw_values={},
                    normalized_risk=risk_val,
                    weight=0.25,
                    effective_weight=round(eff_w, 3),
                    contribution=contrib,
                    contribution_percentage=contrib_pct,
                    classification=status,
                    severity=sev,
                    interpretation=interpretation_item,
                    meaning=meta["meaning"],
                    why_it_matters=meta["why_it_matters"],
                    how_calculated=meta["how_calculated"],
                    evidence=evidence_item,
                    developer_action=meta["developer_action"],
                    filter_category=meta["filter_category"],
                )
            )

    # 4. Construct Non-Contradictory Evidence-Based Interpretation
    interpretation = construct_evidence_based_interpretation(
        cmdi=cmdi,
        risk_category=risk_category,
        normalized_risks=normalized_risks,
        indicators_data=indicators_data,
    )

    # 5. Primary Risk Driver
    measured_with_debt = [ind for ind in breakdown_indicators if ind.contribution > 0]
    if measured_with_debt:
        top_driver = max(measured_with_debt, key=lambda x: x.contribution)
        primary_risk_driver = f"{top_driver.name} (+{top_driver.contribution} pts, {top_driver.contribution_percentage}%)"
    elif cmdi is None or not score_available:
        primary_risk_driver = "None (No metrics available)"
    else:
        primary_risk_driver = "None (No significant debt detected)"

    # 6. Build Final ScoringBreakdown Object
    breakdown_obj = ScoringBreakdown(
        cmdi=cmdi,
        score_available=score_available,
        risk_category=risk_category,
        risk_severity=risk_severity,
        formula_expression=formula_expr,
        is_dynamically_weighted=is_dynamically_weighted,
        indicators=breakdown_indicators,
        primary_risk_driver=primary_risk_driver,
        interpretation=interpretation,
        scoring_disclaimer=CMDI_DISCLAIMER,
    )

    # 7. Remediation Estimate Hours: base 4 hours per finding + 8 hours per hotspot
    if cmdi is None or not score_available or (findings_count == 0 and hotspots_count == 0):
        estimate_hours = 0 if (cmdi is None or cmdi <= 25.0) else 4
    else:
        estimate_hours = max(4, (findings_count * 3) + (hotspots_count * 8))

    return CmdiSummaryResult(
        cmdi=cmdi,
        risk_category=risk_category,
        risk_severity=risk_severity,
        interpretation=interpretation,
        remediation_estimate_hours=estimate_hours,
        breakdown=breakdown_obj,
    )


def build_indicator_scores(
    normalized_risks: Dict[str, Optional[float]],
    complexity_metrics: Optional[Dict[str, Any]] = None,
    duplication_metrics: Optional[Dict[str, Any]] = None,
    dependency_metrics: Optional[Dict[str, Any]] = None,
    error_metrics: Optional[Dict[str, Any]] = None,
    effective_weights: Optional[Dict[str, float]] = None,
    cmdi_score: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Constructs structured metadata cards for each of the 4 core indicators."""
    c_metrics = complexity_metrics or {}
    d_metrics = duplication_metrics or {}
    dep_metrics = dependency_metrics or {}
    e_metrics = error_metrics or {}
    eff_w = effective_weights or {"complexity": 0.25, "duplication": 0.25, "coupling": 0.25, "error_handling": 0.25}

    c_risk = normalized_risks.get("complexity_risk")
    d_risk = normalized_risks.get("duplication_risk")
    coup_risk = normalized_risks.get("coupling_risk")
    e_risk = normalized_risks.get("error_handling_risk")

    def _calc_contrib(risk: Optional[float], ind_id: str) -> Tuple[float, float]:
        if risk is None or cmdi_score is None:
            return 0.0, 0.0
        w = eff_w.get(ind_id, 0.25)
        contrib = round(risk * w, 1)
        pct = round((contrib / cmdi_score) * 100.0, 1) if (cmdi_score and cmdi_score > 0) else 0.0
        return contrib, pct

    # 1. Complexity Indicator
    c_contrib, c_pct = _calc_contrib(c_risk, "complexity")
    c_sev = resolve_indicator_severity(c_risk)
    if c_risk is None:
        c_raw = "Not available"
        c_class = "UNAVAILABLE"
        c_interp = "Complexity could not be measured because no analyzable Python functions were found."
        c_evidence = "0 functions analyzed."
    else:
        c_raw = f"{c_metrics.get('max_complexity', 0)} max / {c_metrics.get('avg_complexity', 0.0)} avg"
        c_class = "MEASURED"
        c_interp = f"{c_metrics.get('functions_exceeding_threshold', 0)} function(s) exceed McCabe threshold of 15 (max McCabe: {c_metrics.get('max_complexity', 0)})."
        c_evidence = f"Analyzed {c_metrics.get('total_functions', 0)} functions across repository files."

    # 2. Duplication Indicator
    d_contrib, d_pct = _calc_contrib(d_risk, "duplication")
    d_sev = resolve_indicator_severity(d_risk)
    if d_risk is None:
        d_raw = "Not available"
        d_class = "UNAVAILABLE"
        d_interp = "Code duplication could not be evaluated."
        d_evidence = "No analyzable code lines found."
    else:
        d_raw = f"{d_metrics.get('duplication_percent', 0.0)}%"
        d_class = "MEASURED"
        d_interp = f"{d_metrics.get('duplicate_blocks_count', 0)} candidate duplicate blocks found ({d_metrics.get('total_duplicate_lines', 0)} duplicate lines)."
        d_evidence = f"{d_metrics.get('total_duplicate_lines', 0)} lines out of {d_metrics.get('total_code_lines', 0)} total physical lines."

    # 3. Coupling Indicator
    coup_contrib, coup_pct = _calc_contrib(coup_risk, "coupling")
    cycles = dep_metrics.get("circular_cycles_count", 0)
    max_ca = dep_metrics.get("max_afferent_coupling", 0)
    coup_sev = resolve_indicator_severity(coup_risk, is_circular=(cycles > 0))
    if coup_risk is None:
        coup_raw = "Not available"
        coup_class = "UNAVAILABLE"
        coup_interp = "Architectural coupling could not be evaluated."
        coup_evidence = "No module import relationships identified."
    else:
        coup_raw = f"{cycles} cycles / {max_ca} max Ca"
        coup_class = "MEASURED"
        coup_interp = f"{cycles} circular dependency cycle(s) identified. Max callers on single module: {max_ca}."
        coup_evidence = f"Total {dep_metrics.get('total_dependencies', 0)} static import relationships across modules."

    # 4. Error Handling Indicator
    e_contrib, e_pct = _calc_contrib(e_risk, "error_handling")
    e_sev = resolve_indicator_severity(e_risk)
    if e_risk is None:
        e_raw = "Not available"
        e_class = "UNAVAILABLE"
        e_interp = "Error-handling hygiene could not be evaluated."
        e_evidence = "No try/except blocks analyzed."
    else:
        adherence = e_metrics.get("adherence_score", 100)
        e_raw = f"{adherence} / 100 adherence"
        e_class = "HEURISTIC"
        e_interp = f"{e_metrics.get('violations_count', 0)} exception pattern violations found ({e_metrics.get('bare_except_count', 0)} bare except clauses)."
        e_evidence = f"{e_metrics.get('violations_count', 0)} flagged exception handling anti-patterns."

    indicators = [
        {
            "id": "complexity",
            "name": "Cyclomatic Complexity",
            "raw_metric": c_raw,
            "raw_values": c_metrics,
            "normalized_risk": c_risk,
            "weight": 0.25,
            "effective_weight": round(eff_w.get("complexity", 0.25), 3),
            "contribution": c_contrib,
            "contribution_percentage": c_pct,
            "classification": c_class,
            "severity": c_sev,
            "interpretation": c_interp,
            "meaning": "Measures linearly independent logical paths through Python functions. High values indicate deeply nested branching.",
            "why_it_matters": "Functions with high cyclomatic complexity require exponential unit test branches and have a strong correlation with defect density.",
            "how_calculated": "Measured via Python AST branch counting (McCabe formula). Normalized: McCabe <= 10 = 0 risk, >= 40 = 100 risk.",
            "evidence": c_evidence,
            "developer_action": "Decompose deeply nested functions into smaller single-responsibility subroutines.",
            "filter_category": "Cyclomatic Complexity",
        },
        {
            "id": "duplication",
            "name": "Code Duplication",
            "raw_metric": d_raw,
            "raw_values": d_metrics,
            "normalized_risk": d_risk,
            "weight": 0.25,
            "effective_weight": round(eff_w.get("duplication", 0.25), 3),
            "contribution": d_contrib,
            "contribution_percentage": d_pct,
            "classification": d_class,
            "severity": d_sev,
            "interpretation": d_interp,
            "meaning": "Percentage of source code lines existing in identical or near-identical syntax clone sequences.",
            "why_it_matters": "Duplicated logic multiplies maintenance friction and leads to copy-paste bug propagation when one clone is patched but sister copies are overlooked.",
            "how_calculated": "Token sliding window (>= 10 lines) hashed across files. Normalized: 0% = 0 risk, >= 25% = 100 risk.",
            "evidence": d_evidence,
            "developer_action": "Extract duplicate logic into reusable modules or common helper functions.",
            "filter_category": "Code Duplication",
        },
        {
            "id": "coupling",
            "name": "Architectural Coupling",
            "raw_metric": coup_raw,
            "raw_values": dep_metrics,
            "normalized_risk": coup_risk,
            "weight": 0.25,
            "effective_weight": round(eff_w.get("coupling", 0.25), 3),
            "contribution": coup_contrib,
            "contribution_percentage": coup_pct,
            "classification": coup_class,
            "severity": coup_sev,
            "interpretation": coup_interp,
            "meaning": "Evaluates static import interdependencies, in-degree callers (Ca), out-degree dependencies (Ce), and circular loops.",
            "why_it_matters": "Circular dependencies hinder independent testing and packaging. High in-degree creates god-objects whose modification carries large blast radii.",
            "how_calculated": "Adjacency digraph constructed from AST import statements; Tarjan's SCC detects cycles. Normalized: 35 pts per circular cycle + afferent coupling factor.",
            "evidence": coup_evidence,
            "developer_action": "Decouple circular imports by extracting shared interfaces into independent leaf modules.",
            "filter_category": "Architectural Coupling",
        },
        {
            "id": "error_handling",
            "name": "Error-Handling Consistency",
            "raw_metric": e_raw,
            "raw_values": e_metrics,
            "normalized_risk": e_risk,
            "weight": 0.25,
            "effective_weight": round(eff_w.get("error_handling", 0.25), 3),
            "contribution": e_contrib,
            "contribution_percentage": e_pct,
            "classification": e_class,
            "severity": e_sev,
            "interpretation": e_interp,
            "meaning": "Heuristic inspection of exception handling hygiene, flagging bare except clauses and silent swallowing.",
            "why_it_matters": "Silent swallowing obscures root-cause diagnostics and traps system shutdown signals.",
            "how_calculated": "AST pattern heuristics evaluate try/except structures. Adherence inverted to 0–100 risk score.",
            "evidence": e_evidence,
            "developer_action": "Replace bare except clauses with explicit exception types and attach structured logging.",
            "filter_category": "Error-Handling Consistency",
        },
    ]

    return indicators
