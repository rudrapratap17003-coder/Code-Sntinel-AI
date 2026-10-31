"""Python File Discovery and Safe Code Loading."""

import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple

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
}


class DiscoveredFile:
    def __init__(self, relative_path: str, full_path: Path, size_bytes: int, content: Optional[str] = None):
        self.relative_path = relative_path.replace("\\", "/")
        self.full_path = full_path
        self.size_bytes = size_bytes
        self.content = content
        self.lines_of_code = len(content.splitlines()) if content else 0


def discover_python_files(repo_root: Path) -> Tuple[List[DiscoveredFile], List[str]]:
    """Recursively discovers Python files in the repository.
    
    Returns:
        (discovered_files_list, skipped_or_warning_messages)
    """
    discovered: List[DiscoveredFile] = []
    warnings: List[str] = []

    repo_root = repo_root.resolve()

    for root, dirs, files in os.walk(repo_root, followlinks=False):
        # Prune ignored directory trees
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.endswith(".egg-info")]

        for filename in files:
            if not filename.endswith(".py"):
                continue

            file_path = Path(root) / filename

            # Security: Verify symlinks do not escape repository boundary
            is_link = file_path.is_symlink() or (hasattr(os.path, "isjunction") and os.path.isjunction(file_path))
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
                rel_path = str(file_path.relative_to(repo_root))
            except ValueError:
                rel_path = filename

            try:
                stat = file_path.stat()
                size = stat.st_size

                if size > MAX_FILE_SIZE_BYTES:
                    warnings.append(
                        f"File {rel_path} ({size} bytes) exceeds maximum file limit of {MAX_FILE_SIZE_BYTES} bytes. Skipped."
                    )
                    continue

                # Read content safely
                content = None
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                except UnicodeDecodeError:
                    try:
                        with open(file_path, "r", encoding="latin-1") as f:
                            content = f.read()
                    except Exception as err:
                        warnings.append(f"Could not decode {rel_path}: {str(err)}")
                        continue

                discovered.append(DiscoveredFile(rel_path, file_path, size, content))

                if len(discovered) >= MAX_FILES:
                    warnings.append(f"Reached maximum file analysis cap of {MAX_FILES} Python files.")
                    return discovered, warnings

            except (OSError, PermissionError) as e:
                warnings.append(f"Error accessing {rel_path}: {str(e)}")

    return discovered, warnings
