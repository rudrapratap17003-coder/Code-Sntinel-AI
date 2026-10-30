"""Tests for syntax error reporting."""

import pytest
from app.analyzer.syntax_checker import check_syntax


def test_valid_code_parses():
    code = "def valid():\n    return 42\n"
    tree, err = check_syntax(code, "valid.py")
    assert tree is not None
    assert err is None


def test_syntax_error_reported():
    code = "def broken(:\n    print(1)\n"
    tree, err = check_syntax(code, "broken.py")
    assert tree is None
    assert err is not None
    assert err["rule_id"] == "syntax/parse-error"
    assert err["severity"] == "critical"
    assert err["file"] == "broken.py"
    assert err["line"] == 1
