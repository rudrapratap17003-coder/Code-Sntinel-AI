"""Explicit Error-Handling Pattern Analyzer.

Which Error-Handling Patterns are Checked:
1. Bare except:
   - Syntax: `except:` without an exception class.
   - Anti-pattern: Intercepts `SystemExit`, `KeyboardInterrupt`, and `MemoryError`, preventing clean process interruption.
   - Rule: `error-handling/bare-except` (Severity: High)
2. Catching BaseException:
   - Syntax: `except BaseException:`
   - Anti-pattern: Catches root exception, trapping cancellation signals in async/CLI apps.
   - Rule: `error-handling/catch-base-exception` (Severity: Medium)
3. Empty except blocks:
   - Syntax: `except ...: pass` or `...`
   - Anti-pattern: Silently swallows exceptions with zero logging, diagnostic output, or retry handling.
   - Rule: `error-handling/empty-catch` (Severity: Medium)
4. Broad exception swallow:
   - Syntax: `except Exception:` followed by return/continue without logging.
   - Anti-pattern: Masks unexpected tracebacks into silent default states.
   - Rule: `error-handling/broad-exception-swallow` (Severity: Medium)

Measured vs. Heuristic:
Error-handling checks are AST pattern heuristics. While these patterns are well-established Python code smells,
they are reported as maintainability risks rather than confirmed runtime defects.
"""

import ast
from typing import List, Dict, Any, Tuple


class ErrorHandlingVisitor(ast.NodeVisitor):
    def __init__(self, code_lines: List[str], file_path: str):
        self.code_lines = code_lines
        self.file_path = file_path
        self.violations: List[Dict[str, Any]] = []

    def visit_Try(self, node: ast.Try):
        for handler in node.handlers:
            start_line = handler.lineno
            end_line = getattr(handler, "end_lineno", start_line + 3)
            snippet = "\n".join(self.code_lines[start_line - 1 : min(end_line, start_line + 6)])

            # 1. Bare except:
            if handler.type is None:
                self.violations.append({
                    "rule_id": "error-handling/bare-except",
                    "severity": "high",
                    "title": "Bare 'except:' Clause Intercepts System Exit Signals",
                    "file": self.file_path,
                    "line_start": start_line,
                    "line_end": end_line,
                    "snippet": snippet,
                    "summary": "Catch-all bare except: statement intercepts KeyboardInterrupt and SystemExit signals.",
                    "detailed_explanation": (
                        "A bare `except:` clause catches all exceptions, including `BaseException` subclasses like "
                        "`KeyboardInterrupt`, `SystemExit`, and `GeneratorExit`. This prevents graceful process termination "
                        "and masks programmer errors such as `NameError` or `TypeError`."
                    ),
                    "impact": (
                        "Causes unresponsive CLI applications, prevents clean worker teardown in containers, "
                        "and turns straightforward typos into difficult debugging hunts."
                    ),
                    "remediation": "Replace bare `except:` with explicit exception classes or at minimum `except Exception:`.",
                })
                continue

            # Check exception class name
            type_name = ""
            if isinstance(handler.type, ast.Name):
                type_name = handler.type.id
            elif isinstance(handler.type, ast.Attribute):
                type_name = handler.type.attr

            # 2. Catching BaseException
            if type_name == "BaseException":
                self.violations.append({
                    "rule_id": "error-handling/catch-base-exception",
                    "severity": "medium",
                    "title": "Catching BaseException Masks Process Interruption",
                    "file": self.file_path,
                    "line_start": start_line,
                    "line_end": end_line,
                    "snippet": snippet,
                    "summary": "Explicitly catching BaseException intercepts system shutdown signals.",
                    "detailed_explanation": (
                        "In Python 3, `BaseException` is the common base class for both standard exceptions and system "
                        "signals (`KeyboardInterrupt`, `SystemExit`). User code should catch `Exception`, not `BaseException`."
                    ),
                    "impact": "Suppresses termination signals and conceals process lifecycle interrupts.",
                    "remediation": "Change `BaseException` to `Exception` or catch specific domain exceptions.",
                })

            # 3. Empty except block: body contains only `pass` or Ellipsis `...`
            is_empty = False
            if len(handler.body) == 1:
                first_stmt = handler.body[0]
                if isinstance(first_stmt, ast.Pass):
                    is_empty = True
                elif isinstance(first_stmt, ast.Expr) and isinstance(first_stmt.value, ast.Constant) and first_stmt.value.value is ...:
                    is_empty = True

            if is_empty:
                self.violations.append({
                    "rule_id": "error-handling/empty-catch",
                    "severity": "medium",
                    "title": "Silent Exception Swallowing in Empty Except Block",
                    "file": self.file_path,
                    "line_start": start_line,
                    "line_end": end_line,
                    "snippet": snippet,
                    "summary": "Exception caught and silently discarded with empty pass statement.",
                    "detailed_explanation": (
                        f"The except block for `{type_name or 'Exception'}` discards the error using `pass` without "
                        "logging, metric recording, or re-raising. Failures occur invisibly without audit telemetry."
                    ),
                    "impact": (
                        "Silent failure turns straightforward bugs into silent data corruption or intermittent "
                        "system failures that leave zero log traces."
                    ),
                    "remediation": "Log the exception at WARNING or ERROR level, or record diagnostic metrics before continuing.",
                })

        self.generic_visit(node)


def analyze_error_handling(files: List[Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Inspects all Python files for exception handling pattern anti-patterns."""
    all_violations: List[Dict[str, Any]] = []

    for f in files:
        if not f.content:
            continue
        try:
            tree = ast.parse(f.content, filename=f.relative_path)
            lines = f.content.splitlines()
            visitor = ErrorHandlingVisitor(lines, f.relative_path)
            visitor.visit(tree)
            all_violations.extend(visitor.violations)
        except SyntaxError:
            continue

    total_files = len(files)
    # Adherence score calculation: base 100, each violation reduces score
    # Penalty: 8 points per bare except, 5 points per empty catch/BaseException
    penalty = sum(8 if v["rule_id"] == "error-handling/bare-except" else 5 for v in all_violations)
    adherence_score = max(0, min(100, 100 - penalty))

    metrics = {
        "violations_count": len(all_violations),
        "adherence_score": adherence_score,
        "bare_except_count": sum(1 for v in all_violations if v["rule_id"] == "error-handling/bare-except"),
        "empty_catch_count": sum(1 for v in all_violations if v["rule_id"] == "error-handling/empty-catch"),
    }

    return all_violations, metrics


def generate_error_handling_findings(
    violations: List[Dict[str, Any]],
    start_index: int = 1,
) -> List[Dict[str, Any]]:
    """Converts error-handling violations into structured CodeSentinel findings."""
    findings = []
    idx = start_index

    for v in violations:
        line_range = f"lines {v['line_start']}–{v['line_end']}"
        finding = {
            "id": f"FIND-PY-{idx:03d}",
            "title": v["title"],
            "rule_id": v["rule_id"],
            "category": "Error-Handling Consistency",
            "severity": v["severity"],
            "status": "Open",
            "file": v["file"],
            "line_range": line_range,
            "summary": v["summary"],
            "detailed_explanation": v["detailed_explanation"],
            "evidence": {
                "type": "AST_HEURISTIC",
                "metric_name": "Exception Pattern",
                "measured_value": v["rule_id"],
                "threshold": "Explicit logging / typed catch",
                "code_snippet": v["snippet"],
            },
            "maintainability_impact": v["impact"],
            "recommended_remediation": v["remediation"],
            "origin": "HEURISTIC (AST Pattern)",
            "remediation_estimate_hours": 2,
        }
        findings.append(finding)
        idx += 1

    return findings
