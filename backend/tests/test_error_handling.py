"""Tests for error-handling pattern checks."""

import pytest
from pathlib import Path
from app.analyzer.file_discovery import DiscoveredFile
from app.analyzer.error_handling import analyze_error_handling, generate_error_handling_findings


def test_bare_except_detection():
    code = """def worker():
    try:
        do_work()
    except:
        cleanup()
"""
    file_obj = DiscoveredFile("worker.py", Path("worker.py"), 100, code)
    violations, metrics = analyze_error_handling([file_obj])

    bare = [v for v in violations if v["rule_id"] == "error-handling/bare-except"]
    assert len(bare) == 1
    assert bare[0]["severity"] == "high"

    findings = generate_error_handling_findings(violations)
    assert len(findings) == 1
    assert findings[0]["rule_id"] == "error-handling/bare-except"


def test_empty_catch_detection():
    code = """def reader():
    try:
        read()
    except ValueError:
        pass
"""
    file_obj = DiscoveredFile("reader.py", Path("reader.py"), 100, code)
    violations, metrics = analyze_error_handling([file_obj])

    empty = [v for v in violations if v["rule_id"] == "error-handling/empty-catch"]
    assert len(empty) == 1
    assert empty[0]["severity"] == "medium"


def test_base_exception_detection():
    code = """def listener():
    try:
        listen()
    except BaseException:
        stop()
"""
    file_obj = DiscoveredFile("listener.py", Path("listener.py"), 100, code)
    violations, metrics = analyze_error_handling([file_obj])

    base_v = [v for v in violations if v["rule_id"] == "error-handling/catch-base-exception"]
    assert len(base_v) == 1


def test_clean_error_handling_scores_100():
    code = """import logging
def clean():
    try:
        compute()
    except ValueError as e:
        logging.error("Failed: %s", e)
        raise
"""
    file_obj = DiscoveredFile("clean.py", Path("clean.py"), 100, code)
    violations, metrics = analyze_error_handling([file_obj])
    assert len(violations) == 0
    assert metrics["adherence_score"] == 100
