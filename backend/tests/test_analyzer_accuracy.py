"""Tests for analyzer accuracy, hotspot reliability, and evidence integrity (Phase 4)."""

import pytest
from pathlib import Path
from app.analyzer.engine import StaticAnalysisEngine


def test_hotspot_no_artificial_churn(tmp_path):
    """Verifies that artificial churn_commits calculations are eliminated and replaced by volatility heuristics."""
    # Create a complex file
    repo_dir = tmp_path / "test_repo"
    repo_dir.mkdir()

    complex_file = repo_dir / "complex_module.py"
    complex_file.write_text(
        "def complex_function(a, b, c, d, e, f, g):\n"
        + "    res = 0\n"
        + "    if a > 0: res += 1\n"
        + "    if b > 0: res += 2\n"
        + "    if c > 0: res += 3\n"
        + "    if d > 0: res += 4\n"
        + "    if e > 0: res += 5\n"
        + "    if f > 0: res += 6\n"
        + "    if g > 0: res += 7\n"
        + "    if a > 1: res += 8\n"
        + "    if b > 1: res += 9\n"
        + "    if c > 1: res += 10\n"
        + "    if d > 1: res += 11\n"
        + "    if e > 1: res += 12\n"
        + "    if f > 1: res += 13\n"
        + "    if g > 1: res += 14\n"
        + "    if a > 2: res += 15\n"
        + "    return res\n"
    )

    caller_file = repo_dir / "caller_module.py"
    caller_file.write_text(
        "import complex_module\n"
        "def call():\n"
        "    return complex_module.complex_function(1, 2, 3, 4, 5, 6, 7)\n"
    )

    engine = StaticAnalysisEngine()
    result = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )

    assert len(result.hotspots) >= 1
    hotspot = result.hotspots[0]

    # Verify no fake Git commit count is presented
    assert hotspot.churn_commits is None
    assert hotspot.is_git_measured is False
    assert "Not measured Git commit history" in hotspot.data_source

    # Verify meaningful volatility score is returned
    assert hotspot.volatility_score > 0
    assert hotspot.architectural_volatility_estimate == hotspot.volatility_score
    assert hotspot.volatility_label in ("High Volatility", "Moderate Volatility", "Stable")

    # Verify supporting evidence is populated from actual measurements
    assert "supporting_evidence" in hotspot.model_dump()
    evidence = hotspot.supporting_evidence
    assert evidence["top_complexity"] >= 5
    assert "why_it_matters" in hotspot.model_dump()
    assert "complexity" in hotspot.why_it_matters.lower()


def test_file_length_alone_does_not_create_hotspot(tmp_path):
    """Verifies that large file line-count alone does NOT cause a file to be flagged as a hotspot."""
    repo_dir = tmp_path / "test_repo_loc"
    repo_dir.mkdir()

    # Create a 300-line simple declarative file with NO complexity, NO callers, NO errors
    lines = ["# Simple configuration mappings\n"]
    for i in range(300):
        lines.append(f"SETTING_{i} = {i}\n")
    simple_large_file = repo_dir / "large_constants.py"
    simple_large_file.write_text("".join(lines))

    # Also add a simple entrypoint
    entry_file = repo_dir / "app.py"
    entry_file.write_text("import large_constants\nx = large_constants.SETTING_1\n")

    engine = StaticAnalysisEngine()
    result = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )

    # large_constants.py has 300 lines but complexity 1, 0 circular dependencies, 0 error violations
    # It must NOT be flagged as a high-risk hotspot!
    hotspot_files = [h.file for h in result.hotspots]
    assert "large_constants.py" not in hotspot_files


def test_empty_python_file_does_not_crash(tmp_path):
    """Verifies that an empty Python file (e.g. empty __init__.py) does not crash the analyzer."""
    repo_dir = tmp_path / "test_repo_empty_file"
    repo_dir.mkdir()

    init_file = repo_dir / "__init__.py"
    init_file.write_text("")  # completely empty

    module_file = repo_dir / "core.py"
    module_file.write_text("def ping():\n    return 'pong'\n")

    engine = StaticAnalysisEngine()
    result = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )

    assert result.repository.files_examined == 2
    assert result.summary.risk_category == "Low Risk"


def test_evidence_integrity_on_findings(tmp_path):
    """Verifies that every generated finding contains complete, truthful evidence."""
    repo_dir = tmp_path / "test_repo_findings"
    repo_dir.mkdir()

    bad_code = repo_dir / "bad_module.py"
    bad_code.write_text(
        "def run():\n"
        "    try:\n"
        "        x = 1 / 0\n"
        "    except:\n"
        "        pass\n"
    )

    engine = StaticAnalysisEngine()
    result = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )

    assert len(result.findings) >= 1
    for f in result.findings:
        assert f.id.startswith("FIND-PY-")
        assert f.title
        assert f.severity in ("critical", "high", "medium", "low")
        assert f.file
        assert f.line_range
        assert f.summary
        assert f.detailed_explanation
        assert f.recommended_remediation
        assert f.evidence.type
        assert f.evidence.code_snippet is not None


def test_analysis_limitations_honesty(tmp_path):
    """Verifies that analysis limitations explicitly state that code churn is an architectural heuristic."""
    repo_dir = tmp_path / "test_repo_limits"
    repo_dir.mkdir()

    file_a = repo_dir / "a.py"
    file_a.write_text("x = 1\n")

    engine = StaticAnalysisEngine()
    result = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )

    limitations_text = " ".join(result.analysis_limitations)
    assert "Git commit" in limitations_text
    assert "heuristic" in limitations_text.lower()


def test_hotspot_deterministic_ranking(tmp_path):
    """Verifies that hotspot rankings are deterministic and reproduce identical orders across runs."""
    repo_dir = tmp_path / "test_repo_determinism"
    repo_dir.mkdir()

    # Create three equally complex files
    code_template = (
        "def compute(a, b, c, d, e):\n"
        "    res = 0\n"
        "    if a: res += 1\n"
        "    if b: res += 2\n"
        "    if c: res += 3\n"
        "    if d: res += 4\n"
        "    if e: res += 5\n"
        "    if a and b: res += 6\n"
        "    if c and d: res += 7\n"
        "    if d and e: res += 8\n"
        "    if a or b: res += 9\n"
        "    if c or d: res += 10\n"
        "    if a and c: res += 11\n"
        "    if b and d: res += 12\n"
        "    if c and e: res += 13\n"
        "    if a or e: res += 14\n"
        "    if b or c: res += 15\n"
        "    return res\n"
    )

    (repo_dir / "z_module.py").write_text(code_template)
    (repo_dir / "a_module.py").write_text(code_template)
    (repo_dir / "m_module.py").write_text(code_template)

    engine = StaticAnalysisEngine()
    result1 = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )
    result2 = engine.analyze_repository(
        repo_root=repo_dir,
        repo_name="test/repo",
        repo_url="local://test/repo",
        branch="main",
    )

    order1 = [h.file for h in result1.hotspots]
    order2 = [h.file for h in result2.hotspots]

    assert order1 == order2
    # Verify deterministic tie-breaker: alphabetical order ('a_module.py', 'm_module.py', 'z_module.py')
    assert order1 == ["a_module.py", "m_module.py", "z_module.py"]
