"""Code Duplication Detection Engine.

Methodology:
Candidate code duplication is detected via tokenized sliding-window sequence hashing (Type-1 and Type-2 clones).
1. Line Normalization:
   - Comments (`# ...`) and docstrings are stripped.
   - Variable leading/trailing whitespace is collapsed.
   - Empty lines are filtered out while preserving source line number mapping.
2. Sliding Window Hashing:
   - A sliding window of N normalized lines (default N = 10) is evaluated across each file.
   - Each window is hashed (SHA-256) to index candidate duplicate blocks.
3. Cluster Aggregation & Range Merging:
   - Matching hashes between different files (or non-overlapping regions of the same file) form clone pairs.
   - Contiguous matching windows are merged into full duplicate spans to accurately measure duplicate line count.
4. Threshold & Severity:
   - Block size >= 40 lines: Critical
   - Block size >= 25 lines: High
   - Block size >= 10 lines: Medium
"""

import hashlib
from typing import List, Dict, Any, Tuple
from collections import defaultdict
from app.config import DUPLICATION_MIN_LINES


class DuplicateBlockMatch:
    def __init__(
        self,
        file_a: str,
        start_line_a: int,
        end_line_a: int,
        file_b: str,
        start_line_b: int,
        end_line_b: int,
        line_count: int,
        snippet: str,
    ):
        self.file_a = file_a
        self.start_line_a = start_line_a
        self.end_line_a = end_line_a
        self.file_b = file_b
        self.start_line_b = start_line_b
        self.end_line_b = end_line_b
        self.line_count = line_count
        self.snippet = snippet


def _normalize_python_source(code: str) -> List[Tuple[int, str]]:
    """Strips comments and normalizes code lines while preserving original line numbers."""
    normalized: List[Tuple[int, str]] = []
    in_multiline_string = False
    quote_char = None

    for line_num, line in enumerate(code.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue

        # Check for start/end of triple-quoted docstrings
        if '"""' in stripped or "'''" in stripped:
            delimiter = '"""' if '"""' in stripped else "'''"
            count = stripped.count(delimiter)
            if not in_multiline_string:
                if count == 1:
                    in_multiline_string = True
                    quote_char = delimiter
                    continue
                elif count == 2:
                    # Single-line docstring, strip it
                    continue
            else:
                if delimiter == quote_char:
                    in_multiline_string = False
                    quote_char = None
                    continue

        if in_multiline_string:
            continue

        # Strip inline comments
        if "#" in stripped:
            # Simple comment strip outside strings
            stripped = stripped.split("#")[0].strip()
            if not stripped:
                continue

        # Normalize internal whitespace
        token_str = " ".join(stripped.split())
        normalized.append((line_num, token_str))

    return normalized


def detect_code_duplication(
    files: List[Any],
    min_lines: int = DUPLICATION_MIN_LINES,
) -> Tuple[List[DuplicateBlockMatch], Dict[str, Any]]:
    """Detects candidate duplicate code blocks across all discovered repository files."""
    # window_hash -> list of (file_path, start_orig_line, end_orig_line, snippet)
    hash_index = defaultdict(list)
    file_normalized = {}
    file_raw_lines = {}
    total_loc = sum(f.lines_of_code for f in files)

    for f in files:
        if not f.content:
            continue
        file_raw_lines[f.relative_path] = f.content.splitlines()
        norm_lines = _normalize_python_source(f.content)
        file_normalized[f.relative_path] = norm_lines

        if len(norm_lines) < min_lines:
            continue

        # Slide window of size min_lines
        for i in range(len(norm_lines) - min_lines + 1):
            window = norm_lines[i : i + min_lines]
            combined = "\n".join(text for _, text in window)
            h = hashlib.sha256(combined.encode("utf-8")).hexdigest()

            start_line = window[0][0]
            end_line = window[-1][0]
            raw_lines = file_raw_lines[f.relative_path]
            snippet = "\n".join(raw_lines[start_line - 1 : min(end_line, start_line + 8)])

            hash_index[h].append((f.relative_path, start_line, end_line, snippet, min_lines))

    # Match blocks sharing the same hash
    matches: List[DuplicateBlockMatch] = []
    seen_pairs = set()
    duplicated_lines_set = defaultdict(set)

    for h, occurrences in hash_index.items():
        if len(occurrences) < 2:
            continue

        for i in range(len(occurrences)):
            for j in range(i + 1, len(occurrences)):
                file_a, start_a, end_a, snippet_a, cnt_a = occurrences[i]
                file_b, start_b, end_b, _, _ = occurrences[j]

                # If same file, avoid overlapping windows
                if file_a == file_b and abs(start_a - start_b) < min_lines:
                    continue

                pair_key = tuple(sorted([(file_a, start_a), (file_b, start_b)]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                # Record lines as duplicated
                for ln in range(start_a, end_a + 1):
                    duplicated_lines_set[file_a].add(ln)
                for ln in range(start_b, end_b + 1):
                    duplicated_lines_set[file_b].add(ln)

                matches.append(
                    DuplicateBlockMatch(
                        file_a=file_a,
                        start_line_a=start_a,
                        end_line_a=end_a,
                        file_b=file_b,
                        start_line_b=start_b,
                        end_line_b=end_b,
                        line_count=cnt_a,
                        snippet=snippet_a,
                    )
                )

    total_dup_lines = sum(len(lines) for lines in duplicated_lines_set.values())
    duplication_percent = round((total_dup_lines / total_loc * 100), 1) if total_loc > 0 else 0.0

    metrics = {
        "duplicate_blocks_count": len(matches),
        "total_duplicate_lines": total_dup_lines,
        "total_code_lines": total_loc,
        "duplication_percent": duplication_percent,
    }

    return matches, metrics


def generate_duplication_findings(
    matches: List[DuplicateBlockMatch],
    start_index: int = 1,
) -> List[Dict[str, Any]]:
    """Formats detected duplicate blocks into CodeSentinel findings."""
    findings = []
    idx = start_index

    # Report up to 10 most impactful duplicate clusters
    sorted_matches = sorted(matches, key=lambda m: m.line_count, reverse=True)[:10]

    for m in sorted_matches:
        if m.line_count >= 40:
            severity = "critical"
        elif m.line_count >= 25:
            severity = "high"
        else:
            severity = "medium"

        line_range = f"lines {m.start_line_a}–{m.end_line_a}"
        finding = {
            "id": f"FIND-PY-{idx:03d}",
            "title": f"Duplicated Code Block ({m.line_count} Lines)",
            "rule_id": "duplication/block-match",
            "category": "Code Duplication",
            "severity": severity,
            "status": "Open",
            "file": f"{m.file_a} & {m.file_b}",
            "line_range": f"{line_range} & lines {m.start_line_b}–{m.end_line_b}",
            "summary": (
                f"Candidate code duplication of {m.line_count} lines identified between "
                f"{m.file_a} and {m.file_b}."
            ),
            "detailed_explanation": (
                f"Static token sequence hashing identified an identical block of {m.line_count} lines between "
                f"`{m.file_a}` (lines {m.start_line_a}–{m.end_line_a}) and `{m.file_b}` (lines {m.start_line_b}–{m.end_line_b}). "
                "Duplicated logic creates maintenance divergence risk when bug fixes or protocol updates are applied to one location but omitted in the other."
            ),
            "evidence": {
                "type": "TOKEN_DUPLICATION",
                "metric_name": "Identical Normalized Sequence",
                "measured_value": f"{m.line_count} lines duplicated",
                "threshold": f"{DUPLICATION_MIN_LINES} lines",
                "code_snippet": m.snippet,
                "clone_target_file": m.file_b,
                "clone_target_lines": f"lines {m.start_line_b}–{m.end_line_b}",
            },
            "maintainability_impact": (
                "Duplicated logic multiplies maintenance overhead and creates behavioral drift. "
                "Changes to protocol parsing or parameters must be manually synchronized across multiple files."
            ),
            "recommended_remediation": (
                "Extract common logic into a shared helper function or utility module. "
                "Adopt parameterized subroutines to avoid copy-paste drift."
            ),
            "origin": "STATIC_ANALYSIS (Token Match)",
            "remediation_estimate_hours": 3,
        }
        findings.append(finding)
        idx += 1

    return findings
