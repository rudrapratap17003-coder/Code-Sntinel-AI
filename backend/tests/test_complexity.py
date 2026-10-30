"""Tests for Cyclomatic Complexity analysis."""

import pytest
from app.analyzer.complexity import analyze_complexity, generate_complexity_findings


def test_simple_function_low_complexity():
    code = """def simple_func(x, y):
    return x + y
"""
    funcs = analyze_complexity(code, "test.py")
    assert len(funcs) == 1
    assert funcs[0].name == "simple_func"
    assert funcs[0].complexity == 1


def test_branching_complexity():
    code = """def branching_func(x):
    if x > 10:
        if x > 20:
            return 2
        return 1
    elif x == 5:
        return 0
    else:
        for i in range(x):
            if i % 2 == 0:
                print(i)
    return -1
"""
    funcs = analyze_complexity(code, "branching.py")
    assert len(funcs) == 1
    # Base 1 + if(1) + if(1) + elif(1) + for(1) + if(1) = 6
    assert funcs[0].complexity == 6


def test_high_complexity_findings_generation():
    # Construct a function with 16 branch points to exceed threshold 15
    code = """def heavy_dispatcher(action):
    if action == 1: pass
    elif action == 2: pass
    elif action == 3: pass
    elif action == 4: pass
    elif action == 5: pass
    elif action == 6: pass
    elif action == 7: pass
    elif action == 8: pass
    elif action == 9: pass
    elif action == 10: pass
    elif action == 11: pass
    elif action == 12: pass
    elif action == 13: pass
    elif action == 14: pass
    elif action == 15: pass
    elif action == 16: pass
    return True
"""
    funcs = analyze_complexity(code, "heavy.py")
    assert len(funcs) == 1
    assert funcs[0].complexity >= 16

    findings, metrics = generate_complexity_findings(funcs, start_index=1)
    assert len(findings) == 1
    assert findings[0]["rule_id"] == "complexity/high-cyclomatic"
    assert findings[0]["severity"] in ("high", "critical")
    assert metrics["max_complexity"] >= 16
    assert metrics["functions_exceeding_threshold"] == 1
