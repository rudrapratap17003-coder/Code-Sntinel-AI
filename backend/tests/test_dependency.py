"""Tests for module dependency extraction and circular cycle detection."""

import pytest
from pathlib import Path
from app.analyzer.file_discovery import DiscoveredFile
from app.analyzer.dependency import analyze_module_dependencies, generate_dependency_findings


def test_acyclic_dependencies():
    file_a = DiscoveredFile("core/engine.py", Path("core/engine.py"), 200, "from utils.helpers import clean\n")
    file_b = DiscoveredFile("utils/helpers.py", Path("utils/helpers.py"), 200, "def clean(s):\n    return s\n")

    graph, details, cycles = analyze_module_dependencies([file_a, file_b])
    assert "utils/helpers.py" in graph["core/engine.py"]
    assert len(cycles) == 0


def test_circular_cycle_detection():
    file_a = DiscoveredFile("service_a.py", Path("service_a.py"), 200, "import service_b\n")
    file_b = DiscoveredFile("service_b.py", Path("service_b.py"), 200, "import service_a\n")

    graph, details, cycles = analyze_module_dependencies([file_a, file_b])
    assert len(cycles) == 1
    cycle_nodes = set(cycles[0])
    assert "service_a.py" in cycle_nodes
    assert "service_b.py" in cycle_nodes

    findings = generate_dependency_findings(cycles, start_index=1)
    assert len(findings) == 1
    assert findings[0]["rule_id"] == "architecture/circular-dependency"
    assert findings[0]["severity"] == "critical"


def test_three_node_circular_loop():
    file_a = DiscoveredFile("a.py", Path("a.py"), 100, "import b\n")
    file_b = DiscoveredFile("b.py", Path("b.py"), 100, "import c\n")
    file_c = DiscoveredFile("c.py", Path("c.py"), 100, "import a\n")

    graph, details, cycles = analyze_module_dependencies([file_a, file_b, file_c])
    assert len(cycles) == 1
    assert set(cycles[0]) == {"a.py", "b.py", "c.py"}
