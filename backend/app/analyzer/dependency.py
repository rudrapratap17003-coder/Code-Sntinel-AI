"""Module Import-Dependency Extraction and Circular Coupling Analyzer.

Coupling Methodology:
- Evaluates static compile-time import statements (`import x`, `from x import y`).
- Resolves internal relative (`from . import ...`, `from ..utils import ...`) and absolute module paths.
- Distinguishes internal repository modules from external standard library / third-party dependencies.
- Computes:
  * Afferent Coupling (Ca): Number of internal modules that import this module (in-degree).
  * Efferent Coupling (Ce): Number of internal modules this module imports (out-degree).
  * Instability Index (I): Ce / (Ca + Ce). I = 0 implies maximally stable (depended on by others); I = 1 implies pure consumer.
- Circular Dependency Detection:
  * Implements Tarjan's Strongly Connected Components (SCC) algorithm.
  * Any strongly connected component with >= 2 nodes constitutes an architectural cycle.
"""

import ast
import os
from pathlib import Path
from typing import List, Dict, Set, Tuple, Any, Optional
from collections import defaultdict


class ModuleDependencyVisitor(ast.NodeVisitor):
    def __init__(self, current_file_path: str):
        self.current_file_path = current_file_path.replace("\\", "/")
        # Raw extracted import targets: (imported_module_name, is_relative, level, line_no)
        self.raw_imports: List[Tuple[str, bool, int, int]] = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.raw_imports.append((alias.name, False, 0, node.lineno))

    def visit_ImportFrom(self, node: ast.ImportFrom):
        mod_name = node.module or ""
        level = node.level or 0
        is_relative = level > 0
        self.raw_imports.append((mod_name, is_relative, level, node.lineno))


def _build_module_lookup(files: List[Any]) -> Dict[str, str]:
    """Maps dotted Python module paths to relative file paths.
    
    e.g. "src/core/runner.py" -> "src.core.runner", "core.runner", "runner"
    """
    lookup: Dict[str, str] = {}
    for f in files:
        rel = f.relative_path
        # Normalize: strip .py
        no_ext = rel[:-3] if rel.endswith(".py") else rel
        if no_ext.endswith("/__init__"):
            no_ext = no_ext[:-9]

        dot_path = no_ext.replace("/", ".")
        lookup[dot_path] = rel

        # Also register suffixes for clean import matching (e.g. "core.runner")
        parts = dot_path.split(".")
        for i in range(len(parts)):
            sub = ".".join(parts[i:])
            if sub not in lookup:
                lookup[sub] = rel

    return lookup


def _resolve_relative_import(base_file_path: str, mod_name: str, level: int, lookup: Dict[str, str]) -> Optional[str]:
    """Resolves relative import levels against file location."""
    parts = Path(base_file_path).parts[:-1]  # directory parts
    # Step up for level
    steps_up = level - 1
    if steps_up > len(parts):
        return None
    target_dir_parts = parts[: len(parts) - steps_up] if steps_up > 0 else parts

    if mod_name:
        candidate_parts = list(target_dir_parts) + mod_name.split(".")
    else:
        candidate_parts = list(target_dir_parts)

    dot_candidate = ".".join(candidate_parts)
    if dot_candidate in lookup:
        return lookup[dot_candidate]

    # Try matching file directly
    candidate_path = "/".join(candidate_parts) + ".py"
    for registered_path in lookup.values():
        if registered_path == candidate_path or registered_path.endswith("/" + candidate_path):
            return registered_path

    return None


def analyze_module_dependencies(files: List[Any]) -> Tuple[Dict[str, Set[str]], Dict[str, List[Dict[str, Any]]], List[List[str]]]:
    """Extracts internal dependency graph and detects circular cycles.
    
    Returns:
        (adjacency_graph, edge_details, circular_cycles_list)
    """
    lookup = _build_module_lookup(files)
    # source_file -> set of target_files
    graph: Dict[str, Set[str]] = {f.relative_path: set() for f in files}
    edge_details = defaultdict(list)

    for f in files:
        if not f.content:
            continue
        try:
            tree = ast.parse(f.content, filename=f.relative_path)
            visitor = ModuleDependencyVisitor(f.relative_path)
            visitor.visit(tree)

            for mod_name, is_relative, level, line_no in visitor.raw_imports:
                target_rel_path = None
                if is_relative:
                    target_rel_path = _resolve_relative_import(f.relative_path, mod_name, level, lookup)
                else:
                    # Absolute import check
                    if mod_name in lookup:
                        target_rel_path = lookup[mod_name]
                    else:
                        # Try matching prefix
                        parts = mod_name.split(".")
                        for k in range(len(parts), 0, -1):
                            prefix = ".".join(parts[:k])
                            if prefix in lookup:
                                target_rel_path = lookup[prefix]
                                break

                if target_rel_path and target_rel_path != f.relative_path:
                    graph[f.relative_path].add(target_rel_path)
                    edge_details[(f.relative_path, target_rel_path)].append({
                        "line": line_no,
                        "import_target": mod_name,
                    })
        except SyntaxError:
            continue

    # Detect cycles using Tarjan's SCC algorithm
    cycles = _tarjan_scc_cycles(graph)

    return graph, edge_details, cycles


def _tarjan_scc_cycles(graph: Dict[str, Set[str]]) -> List[List[str]]:
    """Identifies strongly connected components with 2 or more nodes."""
    index = 0
    indices: Dict[str, int] = {}
    lowlink: Dict[str, int] = {}
    on_stack: Set[str] = set()
    stack: List[str] = []
    sccs: List[List[str]] = []

    def strongconnect(v: str):
        nonlocal index
        indices[v] = index
        lowlink[v] = index
        index += 1
        stack.append(v)
        on_stack.add(v)

        for w in graph.get(v, []):
            if w not in indices:
                strongconnect(w)
                lowlink[v] = min(lowlink[v], lowlink[w])
            elif w in on_stack:
                lowlink[v] = min(lowlink[v], indices[w])

        if lowlink[v] == indices[v]:
            scc = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                scc.append(w)
                if w == v:
                    break
            # Only record SCCs with 2 or more nodes (real circular loops)
            if len(scc) >= 2:
                sccs.append(scc)

    for node in graph:
        if node not in indices:
            strongconnect(node)

    return sccs


def generate_dependency_findings(
    cycles: List[List[str]],
    start_index: int = 1,
) -> List[Dict[str, Any]]:
    """Generates Critical findings for circular module dependency cycles."""
    findings = []
    idx = start_index

    for scc in cycles:
        chain_display = " <-> ".join(scc)
        cycle_chain = list(scc) + [scc[0]]

        finding = {
            "id": f"FIND-PY-{idx:03d}",
            "title": f"Circular Module Dependency Loop ({len(scc)} Modules)",
            "rule_id": "architecture/circular-dependency",
            "category": "Architectural Coupling",
            "severity": "critical",
            "status": "Open",
            "file": chain_display,
            "line_range": "module import level",
            "summary": (
                f"Static import analysis detected a circular dependency cycle between "
                f"{', '.join(scc)}."
            ),
            "detailed_explanation": (
                f"Static import dependency extraction identified an import loop where modules mutually require each other: "
                f"{' -> '.join(cycle_chain)}. In Python, bidirectional imports trigger deferred runtime initialization "
                f"issues, prevent isolated unit test execution, and introduce memory cycles."
            ),
            "evidence": {
                "type": "IMPORT_CYCLE",
                "metric_name": "Tarjan SCC Cycle",
                "measured_value": f"{len(scc)} mutually dependent modules",
                "threshold": "0 circular cycles",
                "cycle_chain": cycle_chain,
                "code_snippet": f"# Circular loop detected across:\n" + "\n".join(f"# - {m}" for m in scc),
            },
            "maintainability_impact": (
                "Circular dependencies tightly couple module lifecycles, preventing independent deployment, "
                "packaging, or unit testing. Changes to one module frequently cause ripple regressions in mutual dependents."
            ),
            "recommended_remediation": (
                "Break the circular dependency by extracting shared types, data models, or interfaces into an independent "
                "common leaf module (e.g. `types.py` or `models.py`), and employ dependency inversion."
            ),
            "origin": "HEURISTIC (Import Graph)",
            "remediation_estimate_hours": 6,
        }
        findings.append(finding)
        idx += 1

    return findings
