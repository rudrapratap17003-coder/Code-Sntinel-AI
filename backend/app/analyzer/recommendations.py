"""CodeSentinel AI - Deterministic Refactoring Recommendations Engine.

Provides concrete, 6-part refactoring guidance for static analysis findings:
1. What the problem is.
2. Why it matters.
3. Which code evidence supports the finding.
4. What the developer should consider changing.
5. What benefit the change may provide.
6. What should be checked after refactoring.
"""

from typing import Dict, Any, List, Optional
from app.models.schemas import FindingModel, RefactoringGuidance


def generate_refactoring_guidance(finding: FindingModel) -> RefactoringGuidance:
    """Generates a structured, evidence-backed 6-part refactoring guidance object."""
    cat = (finding.category or "").lower()
    rule = (finding.rule_id or "").lower()
    evidence_text = ""

    if finding.evidence:
        ev = finding.evidence
        parts = []
        if ev.metric_name and ev.measured_value is not None:
            parts.append(f"{ev.metric_name}: measured {ev.measured_value} (threshold {ev.threshold})")
        if ev.cycle_chain:
            parts.append(f"Cycle chain: {' -> '.join(ev.cycle_chain)}")
        if ev.clone_target_file:
            parts.append(f"Cloned in: {ev.clone_target_file} ({ev.clone_target_lines or 'matching lines'})")
        if ev.ast_violation:
            parts.append(f"AST: {ev.ast_violation}")
        evidence_text = "; ".join(parts) if parts else (finding.summary or "Measured finding")
    else:
        evidence_text = finding.summary or "Verified static analysis finding."

    # Cyclomatic Complexity
    if "complexity" in cat or "radon" in rule or "cyclomatic" in rule:
        return RefactoringGuidance(
            problem_statement=f"Function or method in '{finding.file}' ({finding.line_range}) has excessive decision branches.",
            why_it_matters="High cyclomatic complexity exponentially increases cognitive load, regression likelihood, and the number of unit test execution paths required for full branch coverage.",
            code_evidence=evidence_text,
            recommended_change=(
                "Apply the 'Extract Method' refactoring: decompose nested conditionals and loops into dedicated single-responsibility helper functions. "
                "Consider using lookup tables, dictionaries, or polymorphic dispatch instead of multi-branch if-elif structures."
            ),
            expected_benefit="Lowers cognitive burden, isolates side effects, and enables targeted, isolated unit tests for individual branches.",
            verification_checklist=[
                "Verify all existing test cases pass before and after extraction.",
                "Ensure each newly extracted helper function has a single, well-defined purpose and clean parameter list.",
                "Check that edge cases (e.g. None or empty inputs) remain properly handled across all branch paths.",
            ],
        )

    # Architectural Coupling / Circular Dependencies
    elif "coupling" in cat or "circular" in rule or "import" in rule:
        return RefactoringGuidance(
            problem_statement=f"Module '{finding.file}' forms part of a circular import cycle with adjacent internal modules.",
            why_it_matters="Circular dependencies tightly bind modules together, prevent modular reuse, cause import-order runtime crashes (ImportError/AttributeError), and make independent refactoring fragile.",
            code_evidence=evidence_text,
            recommended_change=(
                "Break the circular dependency cycle using Dependency Inversion: introduce an abstract interface, protocol, or dedicated data-transfer object (DTO) module that both dependent modules import. "
                "Alternatively, move common shared utilities or models to a lower-level leaf package."
            ),
            expected_benefit="Restores clean directed acyclic graph (DAG) structure, eliminates import-time side effects, and decouples module lifecycles.",
            verification_checklist=[
                "Confirm that Python can import both modules cleanly from an empty session without circular import errors.",
                "Ensure no inline / deferred local imports (`def fn(): import x`) are used as a temporary band-aid.",
                "Verify architectural dependency direction flows from high-level orchestrators to low-level leaf modules.",
            ],
        )

    # Code Duplication
    elif "duplication" in cat or "clone" in rule or "duplicate" in rule:
        return RefactoringGuidance(
            problem_statement=f"Code block in '{finding.file}' ({finding.line_range}) is structurally identical or highly repetitive.",
            why_it_matters="Duplicated code multiplies maintenance costs: bug fixes or logic updates applied to one copy are frequently missed in duplicates, leading to subtle divergence and regressions.",
            code_evidence=evidence_text,
            recommended_change=(
                "Extract the common logic into a shared reusable utility, class method, or parameter-driven helper function. "
                "Replace the duplicated blocks with calls to this unified implementation."
            ),
            expected_benefit="Single source of truth for business logic; future modifications or bug fixes need only be made in one location.",
            verification_checklist=[
                "Verify that both caller locations pass identical inputs and receive equivalent outputs from the shared function.",
                "Add parametrized unit tests covering the consolidated utility function.",
                "Ensure parameterization did not introduce unnecessary flag arguments or hidden coupling.",
            ],
        )

    # Error Handling Consistency
    elif "error" in cat or "except" in rule:
        return RefactoringGuidance(
            problem_statement=f"Exception block in '{finding.file}' ({finding.line_range}) uses broad catching or silently suppresses errors.",
            why_it_matters="Bare except clauses or swallowed exceptions (`except: pass`) obscure root causes, catch unintended exceptions (like KeyboardInterrupt, MemoryError, or SystemExit), and leave systems in inconsistent states.",
            code_evidence=evidence_text,
            recommended_change=(
                "Catch only specific, expected exception classes (e.g. `FileNotFoundError`, `ValueError`, `KeyError`). "
                "Log the exception with traceback context using `logger.exception(...)` and either re-raise or return a structured fallback result."
            ),
            expected_benefit="Predictable failure modes, diagnostic visibility in production logs, and protection against accidental suppression of fatal runtime errors.",
            verification_checklist=[
                "Ensure no bare `except:` or `except Exception:` swallows errors without logging or re-raising.",
                "Verify that simulated failure conditions produce clear, actionable error log messages.",
                "Check that cleanup code (e.g. closing files or connections) is placed inside `finally:` or context managers.",
            ],
        )

    # General / Syntax Integrity Fallback
    else:
        return RefactoringGuidance(
            problem_statement=f"Maintainability concern in '{finding.file}' ({finding.line_range}): {finding.summary or finding.title}",
            why_it_matters=finding.maintainability_impact or "Reduces code quality and increases maintenance friction over time.",
            code_evidence=evidence_text,
            recommended_change=finding.recommended_remediation or "Refactor the flagged construct according to standard Python idioms and clean architecture guidelines.",
            expected_benefit="Improves code readability, testability, and long-term project maintainability.",
            verification_checklist=[
                "Run test suite to verify no regressions were introduced.",
                "Verify code meets project linting and type-checking standards.",
            ],
        )
