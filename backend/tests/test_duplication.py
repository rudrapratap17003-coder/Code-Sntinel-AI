"""Tests for candidate code duplication detection."""

import pytest
from pathlib import Path
from app.analyzer.file_discovery import DiscoveredFile
from app.analyzer.duplication import detect_code_duplication, generate_duplication_findings


def test_detect_duplicate_blocks_across_files():
    block = """
    data = []
    for item in items:
        if not item:
            continue
        cleaned = item.strip().lower()
        if len(cleaned) > 5:
            data.append(cleaned)
        else:
            data.append("default")
    result = {"items": data, "count": len(data)}
    return result
"""
    file_a = DiscoveredFile("module_a.py", Path("module_a.py"), 500, f"def process_a(items):{block}")
    file_b = DiscoveredFile("module_b.py", Path("module_b.py"), 500, f"def process_b(items):{block}")

    matches, metrics = detect_code_duplication([file_a, file_b], min_lines=10)
    assert len(matches) >= 1
    assert metrics["duplicate_blocks_count"] >= 1
    assert metrics["duplication_percent"] > 0

    findings = generate_duplication_findings(matches, start_index=1)
    assert len(findings) >= 1
    assert findings[0]["rule_id"] == "duplication/block-match"
    assert "module_a.py" in findings[0]["file"]
    assert "module_b.py" in findings[0]["file"]


def test_unique_files_have_zero_duplication():
    file_a = DiscoveredFile("a.py", Path("a.py"), 100, "def a():\n    return 1\n")
    file_b = DiscoveredFile("b.py", Path("b.py"), 100, "def b():\n    return 'completely different text'\n")

    matches, metrics = detect_code_duplication([file_a, file_b], min_lines=5)
    assert len(matches) == 0
    assert metrics["duplicate_blocks_count"] == 0
    assert metrics["duplication_percent"] == 0.0
