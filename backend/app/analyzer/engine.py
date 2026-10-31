"""Master Static Analysis Orchestration Engine for CodeSentinel AI."""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

from app.analyzer.file_discovery import discover_python_files, DiscoveredFile
from app.analyzer.syntax_checker import check_syntax
from app.analyzer.complexity import analyze_complexity, generate_complexity_findings, FunctionComplexityInfo
from app.analyzer.duplication import detect_code_duplication, generate_duplication_findings
from app.analyzer.dependency import analyze_module_dependencies, generate_dependency_findings
from app.analyzer.error_handling import analyze_error_handling, generate_error_handling_findings
from app.analyzer.scoring import (
    normalize_indicator_risks,
    compute_cmdi_summary,
    build_indicator_scores,
)
from app.models.schemas import (
    AnalysisResult,
    RepositoryMetadata,
    MaintainabilitySummary,
    ArchitectureGraphModel,
    ModuleNode,
    DependencyEdge,
    FindingModel,
    IndicatorScore,
    HotspotModel,
)


class StaticAnalysisEngine:
    """Orchestrates Python static analysis passes over an ingested repository."""

    def analyze_repository(
        self,
        repo_root: Path,
        repo_name: str,
        repo_url: str,
        branch: str = "main",
        commit_hash: str = None,
    ) -> AnalysisResult:
        """Executes full multi-pass static analysis on the target repository."""
        analysis_id = f"analysis-run-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        timestamp_iso = now.isoformat()
        display_timestamp = now.strftime("%b %d, %Y • %H:%M UTC")

        # 1. Discover Python files
        discovered_files, discovery_warnings = discover_python_files(repo_root)

        total_loc = sum(f.lines_of_code for f in discovered_files)
        files_examined = len(discovered_files)

        all_findings: List[Dict[str, Any]] = []
        finding_counter = 1

        # 2. Syntax Check & AST Construction
        valid_files: List[DiscoveredFile] = []
        syntax_errors = []

        for f in discovered_files:
            if f.content is None:
                continue
            tree, syntax_err = check_syntax(f.content, f.relative_path)
            if syntax_err:
                syntax_errors.append(syntax_err)
                syntax_err["id"] = f"FIND-PY-{finding_counter:03d}"
                finding_counter += 1
                all_findings.append(syntax_err)
            else:
                valid_files.append(f)

        # 3. Cyclomatic Complexity Analysis
        all_functions: List[FunctionComplexityInfo] = []
        for f in valid_files:
            func_infos = analyze_complexity(f.content, f.relative_path)
            all_functions.extend(func_infos)

        complexity_findings, complexity_metrics = generate_complexity_findings(
            all_functions, start_index=finding_counter
        )
        finding_counter += len(complexity_findings)
        all_findings.extend(complexity_findings)

        # 4. Code Duplication Detection
        dup_matches, dup_metrics = detect_code_duplication(valid_files)
        dup_findings = generate_duplication_findings(dup_matches, start_index=finding_counter)
        finding_counter += len(dup_findings)
        all_findings.extend(dup_findings)

        # 5. Module Dependency & Circular Coupling Analysis
        dep_graph, edge_details, circular_cycles = analyze_module_dependencies(valid_files)
        dep_findings = generate_dependency_findings(circular_cycles, start_index=finding_counter)
        finding_counter += len(dep_findings)
        all_findings.extend(dep_findings)

        # 6. Error-Handling Pattern Checks
        error_violations, error_metrics = analyze_error_handling(valid_files)
        error_findings = generate_error_handling_findings(error_violations, start_index=finding_counter)
        finding_counter += len(error_findings)
        all_findings.extend(error_findings)

        # 7. Construct Architecture Graph Data
        # Compute in-degree / out-degree for each module
        in_degrees: Dict[str, int] = {f.relative_path: 0 for f in valid_files}
        out_degrees: Dict[str, int] = {f.relative_path: 0 for f in valid_files}

        for src, targets in dep_graph.items():
            out_degrees[src] = len(targets)
            for tgt in targets:
                if tgt in in_degrees:
                    in_degrees[tgt] += 1

        nodes: List[ModuleNode] = []
        edges: List[DependencyEdge] = []
        edge_id = 1

        cycle_pairs = set()
        for scc in circular_cycles:
            for i in range(len(scc)):
                a = scc[i]
                b = scc[(i + 1) % len(scc)]
                cycle_pairs.add((a, b))

        for f in valid_files:
            rel = f.relative_path
            ca = in_degrees.get(rel, 0)
            ce = out_degrees.get(rel, 0)
            instability = round(ce / (ca + ce), 2) if (ca + ce) > 0 else 0.0

            # Find max complexity in this module
            mod_funcs = [fn for fn in all_functions if fn.file_path == rel]
            mod_complexity = max((fn.complexity for fn in mod_funcs), default=1)

            # Categorize module
            cat = "Service / Logic"
            if "util" in rel or "helper" in rel or "common" in rel:
                cat = "Utility Leaf"
            elif "model" in rel or "schema" in rel or "type" in rel:
                cat = "Data Model"
            elif "test" in rel:
                cat = "Test Suite"
            elif "api" in rel or "route" in rel or "controller" in rel:
                cat = "API / Boundary"

            nodes.append(
                ModuleNode(
                    id=f"mod-{rel.replace('/', '-').replace('.', '-')}",
                    label=Path(rel).name,
                    full_path=rel,
                    category=cat,
                    afferent_coupling=ca,
                    efferent_coupling=ce,
                    instability=instability,
                    loc=f.lines_of_code,
                    complexity=mod_complexity,
                )
            )

        for (src, tgt) in edge_details.keys():
            is_circ = (src, tgt) in cycle_pairs or (tgt, src) in cycle_pairs
            edges.append(
                DependencyEdge(
                    id=f"edge-{edge_id}",
                    source=f"mod-{src.replace('/', '-').replace('.', '-')}",
                    target=f"mod-{tgt.replace('/', '-').replace('.', '-')}",
                    is_circular=is_circ,
                    import_type="circular" if is_circ else "direct",
                )
            )
            edge_id += 1

        max_ca = max(in_degrees.values(), default=0)
        dep_metrics = {
            "total_modules": len(nodes),
            "total_dependencies": len(edges),
            "circular_cycles_count": len(circular_cycles),
            "max_afferent_coupling": max_ca,
            "system_modularity_score": round(max(0.0, 100.0 - (len(circular_cycles) * 20.0 + max_ca * 2.5)), 1),
        }

        # 8. Identify Architectural Maintainability Hotspots
        # Evaluated deterministically using multi-metric intersection: complexity, coupling, duplication, error patterns
        hotspots: List[Dict[str, Any]] = []
        hotspot_id = 1
        scored_files = []

        for f in valid_files:
            rel = f.relative_path
            ca = in_degrees.get(rel, 0)
            ce = out_degrees.get(rel, 0)
            funcs = [fn for fn in all_functions if fn.file_path == rel]
            top_comp = max((fn.complexity for fn in funcs), default=1)
            total_comp = sum(fn.complexity for fn in funcs)

            # Circular cycle involvement
            in_circular_cycle = any(rel in scc for scc in circular_cycles)

            # Duplicate blocks in this file
            file_dup_matches = [m for m in dup_matches if m.file_a == rel or m.file_b == rel]
            file_dup_lines = sum(m.line_count for m in file_dup_matches)

            # Error handling violations in this file
            file_error_violations = [v for v in error_violations if v.get("file") == rel]
            file_error_count = len(file_error_violations)

            # 1. Complexity component (0 - 40 pts)
            comp_score = 0
            if top_comp >= 25:
                comp_score = 40
            elif top_comp >= 15:
                comp_score = 25 + int((top_comp - 15) * 1.5)
            elif top_comp >= 10:
                comp_score = 10 + (top_comp - 10)

            # 2. Coupling & Blast Radius component (0 - 30 pts)
            coupling_score = min(20, ca * 5)
            if in_circular_cycle:
                coupling_score += 10

            # 3. Duplication component (0 - 15 pts)
            dup_score = min(15, (file_dup_lines // 10) * 5)

            # 4. Error Handling component (0 - 15 pts)
            error_score = min(15, file_error_count * 5)

            # Composite Architectural Volatility / Risk Score (0 - 100)
            # NOTE: File length alone does NOT generate risk points.
            volatility_score = float(min(100, comp_score + coupling_score + dup_score + error_score))

            scored_files.append({
                "file": f,
                "rel_path": rel,
                "top_comp": top_comp,
                "total_comp": total_comp,
                "ca": ca,
                "ce": ce,
                "in_circular_cycle": in_circular_cycle,
                "file_dup_lines": file_dup_lines,
                "file_dup_count": len(file_dup_matches),
                "file_error_count": file_error_count,
                "volatility_score": volatility_score,
                "funcs": funcs,
            })

        # Deterministic sorting: sort by volatility_score desc, top_comp desc, ca desc, then file path asc
        scored_files.sort(
            key=lambda x: (
                -x["volatility_score"],
                -x["top_comp"],
                -x["ca"],
                x["rel_path"].lower(),
            )
        )

        for item in scored_files[:5]:
            # Qualify as hotspot only if it meets concrete structural risk criteria
            is_qualified = (
                item["volatility_score"] >= 20
                or item["top_comp"] >= 15
                or item["in_circular_cycle"]
                or item["ca"] >= 4
            )
            if not is_qualified:
                continue

            # Build concrete supporting evidence points
            evidence_points = []
            if item["top_comp"] >= 10:
                top_fn = max(item["funcs"], key=lambda fn: fn.complexity) if item["funcs"] else None
                top_fn_name = top_fn.display_name if top_fn else "routine"
                evidence_points.append(f"Peak McCabe complexity of {item['top_comp']} in {top_fn_name}")
            if item["ca"] > 0:
                evidence_points.append(f"Afferent coupling of {item['ca']} dependent internal module(s)")
            if item["in_circular_cycle"]:
                evidence_points.append("Module is entangled in an architectural circular dependency loop")
            if item["file_dup_lines"] > 0:
                evidence_points.append(f"{item['file_dup_lines']} lines of duplicated code across {item['file_dup_count']} block(s)")
            if item["file_error_count"] > 0:
                evidence_points.append(f"{item['file_error_count']} error-handling anti-pattern(s) flagged")

            why_it_matters = (
                "; ".join(evidence_points)
                if evidence_points
                else "Module exhibits elevated architectural friction based on combined metrics."
            )

            # Assign risk priority based on measured risk
            if item["volatility_score"] >= 60 or item["top_comp"] >= 25:
                risk_priority = "Critical Priority"
                fix_hours = 12
            elif item["volatility_score"] >= 35 or item["top_comp"] >= 15:
                risk_priority = "High Priority"
                fix_hours = 8
            else:
                risk_priority = "Moderate Risk"
                fix_hours = 4

            vol_label = (
                "High Volatility"
                if item["volatility_score"] >= 50
                else ("Moderate Volatility" if item["volatility_score"] >= 25 else "Stable")
            )

            hotspot_obj = {
                "id": f"hotspot-{hotspot_id}",
                "file": item["rel_path"],
                "complexity": item["top_comp"],
                "total_complexity": item["total_comp"],
                "afferent_coupling": item["ca"],
                "efferent_coupling": item["ce"],
                "in_circular_cycle": item["in_circular_cycle"],
                "duplicate_lines": item["file_dup_lines"],
                "error_violations_count": item["file_error_count"],
                "volatility_score": item["volatility_score"],
                "architectural_volatility_estimate": item["volatility_score"],
                "volatility_label": vol_label,
                "churn_commits": None,  # Transparently None: Git commit history is not measured statically
                "is_git_measured": False,
                "data_source": "Static Architectural Heuristic (Not measured Git commit history)",
                "risk_factor": int(item["volatility_score"]),
                "risk_priority": risk_priority,
                "estimated_fix_hours": fix_hours,
                "why_it_matters": why_it_matters,
                "supporting_evidence": {
                    "top_complexity": item["top_comp"],
                    "total_complexity": item["total_comp"],
                    "dependent_callers": item["ca"],
                    "imported_dependencies": item["ce"],
                    "is_circular": item["in_circular_cycle"],
                    "duplicate_lines": item["file_dup_lines"],
                    "error_violations": item["file_error_count"],
                },
                "suggested_remediation": (
                    "Decompose complex routines into smaller, single-purpose helper functions. "
                    "Extract shared interfaces to reduce afferent blast radius and decouple module cycles."
                ),
            }
            hotspots.append(hotspot_obj)
            hotspot_id += 1

        # 9. Compute Scoring & CMDI
        normalized_risks = normalize_indicator_risks(
            max_complexity=complexity_metrics["max_complexity"],
            duplication_percent=dup_metrics["duplication_percent"],
            circular_cycles_count=dep_metrics["circular_cycles_count"],
            max_afferent_coupling=dep_metrics["max_afferent_coupling"],
            error_adherence_score=error_metrics["adherence_score"],
        )

        cmdi, risk_cat, risk_sev, interpretation, estimate_hours = compute_cmdi_summary(
            normalized_risks=normalized_risks,
            findings_count=len(all_findings),
            hotspots_count=len(hotspots),
        )

        indicators_data = build_indicator_scores(
            normalized_risks=normalized_risks,
            complexity_metrics=complexity_metrics,
            duplication_metrics=dup_metrics,
            dependency_metrics=dep_metrics,
            error_metrics=error_metrics,
        )

        # 10. Prioritize Findings (Top 4 for Overview)
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        sorted_findings = sorted(
            all_findings,
            key=lambda x: severity_order.get(x["severity"], 0),
            reverse=True,
        )
        priority_findings_data = sorted_findings[:4]

        # 11. Analysis Limitations
        limitations = [
            "Analysis is restricted strictly to Python (.py) source files.",
            "Dynamic imports (such as `importlib.import_module()`) are not traced statically.",
            "Runtime execution paths, environment variables, and external network services are not executed.",
            "Code churn and volatility are estimated via static architectural coupling and complexity heuristics, not measured Git commit logs.",
            "Duplicate code detection applies a 10-line sliding-window heuristic and may flag intentional structural boilerplate.",
            "Error-handling checks identify syntactic anti-patterns (e.g. bare except) but cannot evaluate semantic appropriateness of caught exceptions.",
        ]

        # 12. Build Final Structured Result
        return AnalysisResult(
            id=analysis_id,
            timestamp=timestamp_iso,
            display_timestamp=display_timestamp,
            repository=RepositoryMetadata(
                name=repo_name,
                url=repo_url,
                branch=branch,
                commit_hash=commit_hash,
                files_examined=files_examined,
                lines_of_code=total_loc,
                status="Analyzed",
                is_demo=False,
                mode_label="REAL PYTHON STATIC ANALYSIS",
            ),
            summary=MaintainabilitySummary(
                cmdi=cmdi,
                risk_category=risk_cat,
                risk_severity=risk_sev,
                interpretation=interpretation,
                scoring_disclaimer=(
                    "The Composite Maintenance Debt Index (CMDI) is a CodeSentinel AI metric, not an established "
                    "universal industry standard. Its tiers and weightings are initial product heuristics and have not been "
                    "scientifically validated."
                ),
                remediation_estimate_hours=estimate_hours,
                formula_description=(
                    "CMDI is computed as the normalized weighted average of four indicators: Cyclomatic Complexity (25%), "
                    "Code Duplication (25%), Architectural Coupling (25%), and Error-Handling Consistency (25%). "
                    "Each raw measurement is normalized to a 0–100 risk score where higher values denote greater maintainability concern."
                ),
            ),
            indicators=[IndicatorScore(**ind) for ind in indicators_data],
            findings=[FindingModel(**f) for f in sorted_findings],
            priority_findings=[FindingModel(**f) for f in priority_findings_data],
            hotspots=hotspots,
            architecture=ArchitectureGraphModel(
                metrics=dep_metrics,
                nodes=nodes,
                edges=edges,
            ),
            analysis_limitations=limitations,
        )
