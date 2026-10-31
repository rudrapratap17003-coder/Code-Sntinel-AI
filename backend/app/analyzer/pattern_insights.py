"""CodeSentinel AI - AI-Assisted Development Pattern Insights Engine.

Analyzes maintainability patterns frequently observed in AI-assisted coding workflows.

IMPORTANT MANDATE:
- These are structural maintainability indicators, NEVER proof of AI authorship.
- Never claim: "This code was written by AI."
- Always state: "This pattern may be associated with AI-assisted development workflows, but it cannot establish authorship."
- Every detected insight is backed by verified static analyzer findings and metrics.
- Patterns without supporting evidence are reported as 'Not Detected'.
"""

from typing import List
from app.models.schemas import AnalysisResult, PatternInsightItem

AUTHORSHIP_DISCLAIMER = (
    "This pattern may be associated with AI-assisted development workflows, "
    "but it cannot establish authorship. Maintainability indicators reflect code structure, "
    "not developer identity."
)


def extract_pattern_insights(analysis: AnalysisResult) -> List[PatternInsightItem]:
    """Evaluates actual static analysis findings against known maintainability patterns."""
    insights: List[PatternInsightItem] = []

    findings = analysis.findings or []
    hotspots = analysis.hotspots or []

    # 1. Pattern 1: Swallowed Exceptions & Inconsistent Error Handling
    error_findings = [f for f in findings if "error" in (f.category or "").lower() or "except" in (f.rule_id or "").lower()]
    bare_excepts = [f for f in error_findings if "bare" in (f.title or "").lower() or "pass" in (f.summary or "").lower()]
    
    if error_findings:
        files = sorted(list(set(f.file for f in error_findings if f.file)))
        evidence = (
            f"Detected {len(error_findings)} error-handling irregularity(ies) across {len(files)} file(s), "
            f"including {len(bare_excepts)} bare/silent exception suppression pattern(s)."
        )
        insights.append(
            PatternInsightItem(
                id="PAT-ERR-001",
                pattern_name="Defensive Exception Over-Catching & Silent Suppression",
                detected=True,
                detected_evidence=evidence,
                affected_files=files[:5],
                possible_interpretation=(
                    "Large language models and rapid iterative development frequently generate defensive try/except blocks "
                    "with broad exception clauses to prevent runtime termination, inadvertently suppressing critical bugs and masking unexpected faults."
                ),
                actionable_recommendation=(
                    "Replace broad `except Exception:` and bare `except:` clauses with targeted exception types. "
                    "Log all unexpected exceptions with full traceback context before re-raising or returning structured error states."
                ),
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )
    else:
        insights.append(
            PatternInsightItem(
                id="PAT-ERR-001",
                pattern_name="Defensive Exception Over-Catching & Silent Suppression",
                detected=False,
                detected_evidence="No bare or suppressed exception blocks detected in analyzed Python modules.",
                affected_files=[],
                possible_interpretation="Error handling conforms to specific exception propagation standards.",
                actionable_recommendation="Maintain strict exception typing across newly introduced modules.",
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )

    # 2. Pattern 2: Repeated Boilerplate Structures & Code Duplication
    dup_findings = [f for f in findings if "duplication" in (f.category or "").lower() or "clone" in (f.rule_id or "").lower()]
    dup_indicator = next((ind for ind in analysis.indicators if ind.id == "duplication"), None)
    dup_lines = 0
    if dup_indicator and dup_indicator.raw_values:
        dup_lines = dup_indicator.raw_values.get("duplicate_lines", 0)

    if dup_findings or dup_lines > 0:
        files = sorted(list(set(f.file for f in dup_findings if f.file)))
        evidence = f"Detected {len(dup_findings)} code clone finding(s) with {dup_lines} duplicated physical line(s) across {len(files)} module(s)."
        insights.append(
            PatternInsightItem(
                id="PAT-DUP-002",
                pattern_name="Repetitive Boilerplate & Unconsolidated Code Clones",
                detected=True,
                detected_evidence=evidence,
                affected_files=files[:5],
                possible_interpretation=(
                    "AI code assistants often generate self-contained, repetitive implementations across multiple files "
                    "rather than discovering and reusing existing project utilities, leading to duplicated boilerplate and divergent logic."
                ),
                actionable_recommendation=(
                    "Extract common logic into shared utility modules or parameter-driven abstractions. "
                    "Enforce the 'Don't Repeat Yourself' (DRY) principle to ensure bug fixes apply universally."
                ),
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )
    else:
        insights.append(
            PatternInsightItem(
                id="PAT-DUP-002",
                pattern_name="Repetitive Boilerplate & Unconsolidated Code Clones",
                detected=False,
                detected_evidence="No duplicate code blocks exceeding detection threshold were identified.",
                affected_files=[],
                possible_interpretation="Codebase demonstrates healthy modular reuse with minimal repetitive block cloning.",
                actionable_recommendation="Continue leveraging shared libraries and modular utilities for newly written logic.",
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )

    # 3. Pattern 3: Monolithic High-Complexity Functions
    comp_findings = [f for f in findings if "complexity" in (f.category or "").lower() or "cyclomatic" in (f.rule_id or "").lower()]
    high_comp = [f for f in comp_findings if f.severity in ("critical", "high")]

    if high_comp:
        files = sorted(list(set(f.file for f in high_comp if f.file)))
        evidence = f"Identified {len(high_comp)} function(s) with high cyclomatic complexity (McCabe score >= 15) across {len(files)} file(s)."
        insights.append(
            PatternInsightItem(
                id="PAT-CC-003",
                pattern_name="Monolithic Procedural Routines with Deep Branching",
                detected=True,
                detected_evidence=evidence,
                affected_files=files[:5],
                possible_interpretation=(
                    "Single-turn code generation prompts frequently produce long, sequential procedural functions "
                    "that handle multiple responsibilities and validation flows in one continuous block, resulting in high cognitive complexity."
                ),
                actionable_recommendation=(
                    "Decompose monolithic procedures into concise, focused helper functions with clear single responsibilities. "
                    "Use dictionary dispatch or polymorphism where appropriate to reduce nested branch chains."
                ),
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )
    else:
        insights.append(
            PatternInsightItem(
                id="PAT-CC-003",
                pattern_name="Monolithic Procedural Routines with Deep Branching",
                detected=False,
                detected_evidence="No functions exceeding critical cyclomatic complexity thresholds were detected.",
                affected_files=[],
                possible_interpretation="Function complexity remains within manageable testable thresholds.",
                actionable_recommendation="Ensure newly introduced routines do not exceed 10-15 decision branches.",
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )

    # 4. Pattern 4: Circular & Tangled Architectural Dependencies
    coupling_findings = [f for f in findings if "coupling" in (f.category or "").lower() or "circular" in (f.rule_id or "").lower()]
    circular_hotspots = [h for h in hotspots if h.in_circular_cycle]

    if coupling_findings or circular_hotspots:
        files = sorted(list(set(f.file for f in coupling_findings if f.file)))
        evidence = (
            f"Detected {len(coupling_findings)} coupling violation(s) and {len(circular_hotspots)} module(s) "
            "trapped in circular dependency loops."
        )
        insights.append(
            PatternInsightItem(
                id="PAT-ARCH-004",
                pattern_name="Tangled Module Coupling & Circular Import Cycles",
                detected=True,
                detected_evidence=evidence,
                affected_files=files[:5],
                possible_interpretation=(
                    "When features are added in isolation without holistic architectural boundaries, modules begin importing "
                    "each other bi-directionally, creating circular cycles and tightly coupled monoliths."
                ),
                actionable_recommendation=(
                    "Apply Dependency Inversion: extract shared interfaces, models, or DTOs into a neutral foundation layer "
                    "so dependencies flow in a strict directed acyclic graph (DAG)."
                ),
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )
    else:
        insights.append(
            PatternInsightItem(
                id="PAT-ARCH-004",
                pattern_name="Tangled Module Coupling & Circular Import Cycles",
                detected=False,
                detected_evidence="Module dependencies form a clean directed acyclic graph (DAG) with zero circular loops.",
                affected_files=[],
                possible_interpretation="Module boundaries are cleanly defined and segregated.",
                actionable_recommendation="Maintain strict layered architecture to prevent accidental circular cycles.",
                non_authorship_caveat=AUTHORSHIP_DISCLAIMER,
            )
        )

    return insights
