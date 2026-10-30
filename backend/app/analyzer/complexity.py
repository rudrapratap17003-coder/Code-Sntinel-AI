"""Cyclomatic Complexity Analyzer using Radon and AST Fallback.

How Complexity is Calculated:
McCabe Cyclomatic Complexity measures the number of linearly independent logical control paths
through a function or method. Each branch point increases complexity by 1:
- Conditional branching (`if`, `elif`, ternary `IfExp`)
- Loops (`for`, `async for`, `while`)
- Error catch blocks (`except`)
- Context guards (`with`, `async with`)
- Logical conjunctions (`and`, `or` within boolean expressions)
- List/dict/set comprehension filters (`if ...`)
Base complexity of any function is 1.

Severity Assignment:
- McCabe >= 25: Critical (severe cognitive overhead, near-impossible full unit test coverage)
- McCabe >= 15: High (exceeds standard maintainability threshold)
- McCabe > 10: Medium (approaching warning threshold)
"""

import ast
from typing import List, Dict, Any, Optional

try:
    import radon.complexity as radon_cc
    HAS_RADON = True
except ImportError:
    HAS_RADON = False

from app.config import (
    COMPLEXITY_CRITICAL_THRESHOLD,
    COMPLEXITY_HIGH_THRESHOLD,
    COMPLEXITY_WARNING_THRESHOLD,
)


class FunctionComplexityInfo:
    def __init__(
        self,
        name: str,
        class_name: Optional[str],
        file_path: str,
        start_line: int,
        end_line: int,
        complexity: int,
        code_snippet: str = "",
    ):
        self.name = name
        self.class_name = class_name
        self.file_path = file_path
        self.start_line = start_line
        self.end_line = end_line
        self.complexity = complexity
        self.code_snippet = code_snippet

    @property
    def display_name(self) -> str:
        if self.class_name:
            return f"{self.class_name}.{self.name}()"
        return f"{self.name}()"


class PureASTComplexityVisitor(ast.NodeVisitor):
    """Pure Python AST McCabe Complexity Calculator (used as fallback or cross-validator)."""

    def __init__(self, code_lines: List[str], file_path: str):
        self.code_lines = code_lines
        self.file_path = file_path
        self.functions: List[FunctionComplexityInfo] = []
        self.class_stack: List[str] = []

    def visit_ClassDef(self, node: ast.ClassDef):
        self.class_stack.append(node.name)
        self.generic_visit(node)
        self.class_stack.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._analyze_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._analyze_function(node)

    def _analyze_function(self, func_node):
        class_name = self.class_stack[-1] if self.class_stack else None

        # Base complexity is 1
        complexity = 1

        for child in ast.walk(func_node):
            if child is func_node:
                continue

            # Nested function definitions are evaluated in their own visits
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            # Count branch decision points
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(child, ast.IfExp):
                complexity += 1
            elif isinstance(child, ast.ExceptHandler):
                complexity += 1
            elif isinstance(child, (ast.With, ast.AsyncWith)):
                complexity += 1
            elif isinstance(child, ast.Assert):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                # Each binary and/or in a chain adds 1 decision point
                complexity += len(child.values) - 1
            elif isinstance(child, ast.comprehension):
                complexity += len(child.ifs)

        start_line = func_node.lineno
        end_line = getattr(func_node, "end_lineno", start_line + 10)

        snippet_lines = self.code_lines[start_line - 1 : min(end_line, start_line + 15)]
        snippet = "\n".join(snippet_lines)

        self.functions.append(
            FunctionComplexityInfo(
                name=func_node.name,
                class_name=class_name,
                file_path=self.file_path,
                start_line=start_line,
                end_line=end_line,
                complexity=complexity,
                code_snippet=snippet,
            )
        )

        # Still visit nested classes or functions inside
        self.generic_visit(func_node)


def analyze_complexity(code: str, file_path: str) -> List[FunctionComplexityInfo]:
    """Analyzes cyclomatic complexity for all functions in the given code string."""
    code_lines = code.splitlines()

    # Try Radon first if installed
    if HAS_RADON:
        try:
            results: List[FunctionComplexityInfo] = []
            blocks = radon_cc.cc_visit(code)
            for block in blocks:
                # Class block vs Function block
                if hasattr(block, "is_method"):
                    start = block.lineno
                    end = block.endline if hasattr(block, "endline") else start + 10
                    snippet = "\n".join(code_lines[start - 1 : min(end, start + 15)])
                    results.append(
                        FunctionComplexityInfo(
                            name=block.name,
                            class_name=block.classname,
                            file_path=file_path,
                            start_line=start,
                            end_line=end,
                            complexity=block.complexity,
                            code_snippet=snippet,
                        )
                    )
            return results
        except Exception:
            pass  # Fall through to pure AST visitor

    # Pure AST fallback
    try:
        tree = ast.parse(code, filename=file_path)
        visitor = PureASTComplexityVisitor(code_lines, file_path)
        visitor.visit(tree)
        return visitor.functions
    except Exception:
        return []


def generate_complexity_findings(
    functions: List[FunctionComplexityInfo],
    start_index: int = 1,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Generates structured CodeSentinel findings for functions exceeding threshold.
    
    Returns:
        (findings_list, summary_metrics)
    """
    findings: List[Dict[str, Any]] = []

    if not functions:
        metrics = {
            "max_complexity": 0,
            "avg_complexity": 0.0,
            "total_functions": 0,
            "functions_exceeding_threshold": 0,
        }
        return findings, metrics

    complexities = [f.complexity for f in functions]
    max_complexity = max(complexities)
    avg_complexity = round(sum(complexities) / len(complexities), 1)
    exceeding = [f for f in functions if f.complexity >= COMPLEXITY_HIGH_THRESHOLD]

    idx = start_index
    for f in exceeding:
        if f.complexity >= COMPLEXITY_CRITICAL_THRESHOLD:
            severity = "critical"
        elif f.complexity >= COMPLEXITY_HIGH_THRESHOLD:
            severity = "high"
        else:
            severity = "medium"

        line_range = f"lines {f.start_line}–{f.end_line}"
        finding = {
            "id": f"FIND-PY-{idx:03d}",
            "title": f"High Cyclomatic Complexity in {f.display_name}",
            "rule_id": "complexity/high-cyclomatic",
            "category": "Cyclomatic Complexity",
            "severity": severity,
            "status": "Open",
            "file": f.file_path,
            "line_range": line_range,
            "summary": (
                f"Function {f.display_name} has a McCabe complexity of {f.complexity}, "
                f"exceeding the maintainability threshold of {COMPLEXITY_HIGH_THRESHOLD}."
            ),
            "detailed_explanation": (
                f"The function contains {f.complexity} linearly independent logical paths generated by nested "
                f"branching, conditional evaluation, and loop constructs. High cyclomatic score significantly multiplies "
                f"the permutations necessary for exhaustive unit testing."
            ),
            "evidence": {
                "type": "METRIC_THRESHOLD",
                "metric_name": "McCabe Cyclomatic Score",
                "measured_value": f.complexity,
                "threshold": COMPLEXITY_HIGH_THRESHOLD,
                "code_snippet": f.code_snippet,
            },
            "maintainability_impact": (
                f"At complexity {f.complexity}, modifying this function carries high regression probability. "
                f"Developers must maintain substantial cognitive state to anticipate side effects."
            ),
            "recommended_remediation": (
                "Decompose the function into smaller, single-purpose helper functions. "
                "Replace deeply nested if/elif ladders with lookup dictionaries, guard clauses, or polymorphism."
            ),
            "origin": "STATIC_ANALYSIS (AST/Radon)",
            "remediation_estimate_hours": 4 if f.complexity < 25 else 8,
        }
        findings.append(finding)
        idx += 1

    metrics = {
        "max_complexity": max_complexity,
        "avg_complexity": avg_complexity,
        "total_functions": len(functions),
        "functions_exceeding_threshold": len(exceeding),
    }

    return findings, metrics
