"""Syntax Error Detection and Diagnostic Reporting."""

import ast
from typing import Tuple, Optional, Dict, Any


def check_syntax(code: str, file_path: str) -> Tuple[Optional[ast.AST], Optional[Dict[str, Any]]]:
    """Attempts to parse Python source code into an AST.
    
    Returns:
        (ast_tree, syntax_error_dict_or_None)
    """
    if not code:
        return ast.parse(""), None

    try:
        tree = ast.parse(code, filename=file_path)
        return tree, None
    except SyntaxError as e:
        line_num = e.lineno or 1
        error_info = {
            "title": f"Python Syntax Error: {e.msg or 'Invalid syntax'}",
            "file": file_path,
            "line_range": f"line {line_num}",
            "line": line_num,
            "column": e.offset or 1,
            "message": e.msg or "Invalid Python syntax",
            "text": (e.text or "").strip(),
            "rule_id": "syntax/parse-error",
            "category": "Syntax Integrity",
            "severity": "critical",
            "summary": f"Python parser encountered syntax error: {e.msg} on line {e.lineno or 1}.",
            "detailed_explanation": (
                f"Source file contains invalid Python syntax at line {e.lineno or 1}, column {e.offset or 1}. "
                f"Static analyzers cannot construct a valid AST for this file. Error: {e.msg}."
            ),
            "evidence": {
                "type": "SYNTAX_ERROR",
                "metric_name": "Python Parser",
                "measured_value": f"SyntaxError: {e.msg}",
                "threshold": "Valid AST",
                "code_snippet": (e.text or "").strip() or "Syntax error occurred at end of file.",
                "ast_violation": f"line {e.lineno}, col {e.offset}",
            },
            "maintainability_impact": (
                "Unparseable files cause immediate runtime import crashes and fail automated testing suites. "
                "The file cannot be analyzed for complexity or dependencies."
            ),
            "recommended_remediation": (
                f"Fix the syntax error at line {e.lineno or 1}. Run `python -m py_compile {file_path}` locally to verify valid syntax."
            ),
            "origin": "STATIC_ANALYSIS (AST)",
        }
        return None, error_info
