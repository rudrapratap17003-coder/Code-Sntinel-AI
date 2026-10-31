"""Python File Discovery and Safe Code Loading."""

import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any

from app.config import MAX_FILES, MAX_FILE_SIZE_BYTES
from app.ingestion.validator import is_path_within_workspace

IGNORED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".tox",
    ".pytest_cache",
    ".eggs",
    ".mypy_cache",
    ".ruff_cache",
    # Sensitive credential, key, and configuration trees (Security Hardening)
    ".env",
    ".secrets",
    ".ssh",
    ".aws",
    ".azure",
    ".gcp",
    ".kube",
    ".gnupg",
    ".credentials",
}


class DiscoveredFile:
    def __init__(
        self,
        relative_path: str,
        full_path: Path,
        size_bytes: int,
        content: Optional[str] = None,
        tree: Optional[Any] = None,
    ):
        self.relative_path = relative_path.replace("\\", "/")
        self.full_path = full_path
        self.size_bytes = size_bytes
        self.content = content
        self.lines_of_code = len(content.splitlines()) if content else 0
        self.tree = tree


def discover_python_files(repo_root: Path) -> Tuple[List[DiscoveredFile], List[str]]:
    """Recursively discovers Python files in the repository using high-performance scandir.
    
    Returns:
        (discovered_files_list, skipped_or_warning_messages)
    """
    discovered: List[DiscoveredFile] = []
    warnings: List[str] = []

    repo_root = repo_root.resolve()
    has_isjunction = hasattr(os.path, "isjunction")

    def _walk_fast(current_dir: Path, rel_prefix: str = ""):
        if len(discovered) >= MAX_FILES:
            return

        try:
            with os.scandir(current_dir) as entries:
                # Group entries to process directories and files efficiently
                dir_entries = []
                file_entries = []
                for entry in entries:
                    name = entry.name
                    if name.startswith(".") or name.endswith(".egg-info") or name in IGNORED_DIRS:
                        continue
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            dir_entries.append(entry)
                        elif entry.is_file(follow_symlinks=False) and name.endswith(".py"):
                            file_entries.append(entry)
                    except OSError:
                        continue

                # Process files first in current directory
                for entry in file_entries:
                    if len(discovered) >= MAX_FILES:
                        warnings.append(f"Reached maximum file analysis cap of {MAX_FILES} Python files.")
                        return

                    filename = entry.name
                    file_path = Path(entry.path)
                    rel_path = f"{rel_prefix}/{filename}" if rel_prefix else filename

                    # Security: Symlink / junction boundary enforcement
                    is_link = entry.is_symlink() or (has_isjunction and os.path.isjunction(entry.path))
                    if is_link:
                        try:
                            resolved_file = file_path.resolve()
                            if not is_path_within_workspace(resolved_file, repo_root):
                                warnings.append(f"Security: Skipping symlink {filename} pointing outside repository.")
                                continue
                        except (OSError, RuntimeError):
                            warnings.append(f"Security: Skipping cyclic or invalid symlink {filename}.")
                            continue

                    try:
                        stat_res = entry.stat(follow_symlinks=False)
                        size = stat_res.st_size

                        if size > MAX_FILE_SIZE_BYTES:
                            warnings.append(
                                f"File {rel_path} ({size} bytes) exceeds maximum file limit of {MAX_FILE_SIZE_BYTES} bytes. Skipped."
                            )
                            continue

                        # Read content safely
                        content = None
                        try:
                            with open(entry.path, "r", encoding="utf-8") as f:
                                content = f.read()
                        except UnicodeDecodeError:
                            try:
                                with open(entry.path, "r", encoding="latin-1") as f:
                                    content = f.read()
                            except Exception as err:
                                warnings.append(f"Could not decode {rel_path}: {str(err)}")
                                continue

                        discovered.append(DiscoveredFile(rel_path, file_path, size, content))

                    except (OSError, PermissionError) as e:
                        warnings.append(f"Error accessing {rel_path}: {str(e)}")

                # Recurse into subdirectories
                for dir_entry in dir_entries:
                    if len(discovered) >= MAX_FILES:
                        return
                    dir_name = dir_entry.name
                    sub_dir = Path(dir_entry.path)
                    sub_rel = f"{rel_prefix}/{dir_name}" if rel_prefix else dir_name

                    # Security: Directory symlink boundary check
                    is_dir_link = dir_entry.is_symlink() or (has_isjunction and os.path.isjunction(dir_entry.path))
                    if is_dir_link:
                        try:
                            resolved_dir = sub_dir.resolve()
                            if not is_path_within_workspace(resolved_dir, repo_root):
                                warnings.append(f"Security: Skipping directory symlink {dir_name} pointing outside repository.")
                                continue
                        except (OSError, RuntimeError):
                            warnings.append(f"Security: Skipping cyclic or invalid directory link {dir_name}.")
                            continue

                    _walk_fast(sub_dir, sub_rel)

        except (OSError, PermissionError) as e:
            warnings.append(f"Error reading directory {rel_prefix or '.'}: {str(e)}")

    _walk_fast(repo_root)
    return discovered, warnings
