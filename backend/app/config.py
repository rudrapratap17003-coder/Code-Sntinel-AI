"""CodeSentinel AI - Backend Configuration & Resource Limits."""

import os
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple


def _safe_int(env_val: Optional[str], default: int) -> int:
    """Safely parses integer environment variables with fallback on empty or malformed strings."""
    if not env_val:
        return default
    try:
        return int(env_val.strip())
    except ValueError:
        return default


# Base Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_PATH = DATA_DIR / "codesentinel.db"

# Engine Metadata
ENGINE_VERSION = "0.3.0-phase13"
ENGINE_NAME = "CodeSentinel Python Static Analysis Engine"
SUPPORTED_LANGUAGES = ["python"]

# Environment & Deployment Mode
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT in ("production", "prod")

# Local Workspace Security Controls (Safe Boundaries)
ALLOW_LOCAL_ANALYSIS = os.getenv(
    "ALLOW_LOCAL_ANALYSIS", "true" if not IS_PRODUCTION else "false"
).strip().lower() in ("true", "1", "yes")

_configured_workspaces = os.getenv("ALLOWED_LOCAL_WORKSPACES")
if _configured_workspaces and _configured_workspaces.strip():
    ALLOWED_LOCAL_WORKSPACES: List[Path] = [
        Path(p.strip()).resolve()
        for p in _configured_workspaces.split(";")
        if p.strip()
    ]
else:
    # Default authorized boundary: root project workspace (parent of backend)
    ALLOWED_LOCAL_WORKSPACES = [BACKEND_DIR.parent.resolve()]


def validate_workspace_configuration() -> Tuple[bool, List[str]]:
    """Validates local workspace configuration for security boundaries and safety.

    Returns:
        (is_valid: bool, issues: List[str])
    """
    issues: List[str] = []

    # Check for dangerous root path assignment
    for ws in ALLOWED_LOCAL_WORKSPACES:
        try:
            resolved = ws.resolve()
            if resolved == Path(resolved.anchor) or len(resolved.parts) <= 1:
                issues.append(
                    f"Security Alert: Root filesystem ({resolved}) cannot be configured as an authorized workspace."
                )
            if not resolved.exists():
                issues.append(f"Configured workspace directory does not exist: {resolved}")
            elif not resolved.is_dir():
                issues.append(f"Configured workspace is not a directory: {resolved}")
        except Exception as e:
            issues.append(f"Error checking workspace {ws}: {e}")

    # Enforce safe production default
    if IS_PRODUCTION and ALLOW_LOCAL_ANALYSIS and not _configured_workspaces:
        issues.append(
            "Production Security Warning: ALLOW_LOCAL_ANALYSIS is enabled without explicit ALLOWED_LOCAL_WORKSPACES setting."
        )

    is_valid = len(issues) == 0
    return is_valid, issues

# GitHub Integration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Gemini AI Explanation Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
GEMINI_TIMEOUT_SECONDS = _safe_int(os.getenv("GEMINI_TIMEOUT_SECONDS"), 30)
GEMINI_MAX_SNIPPET_LINES = _safe_int(os.getenv("GEMINI_MAX_SNIPPET_LINES"), 120)
GEMINI_MAX_PROMPT_CHARS = _safe_int(os.getenv("GEMINI_MAX_PROMPT_CHARS"), 8000)

# Resource & Security Limits
MAX_FILES = _safe_int(os.getenv("MAX_FILES"), 500)                               # Maximum Python files analyzed per repository
MAX_REPO_SIZE_MB = _safe_int(os.getenv("MAX_REPO_SIZE_MB"), 50)                  # Maximum total repository archive / directory size
MAX_FILE_SIZE_BYTES = _safe_int(os.getenv("MAX_FILE_SIZE_BYTES"), 1_000_000)    # 1 MB max per individual source file
DOWNLOAD_TIMEOUT_SECONDS = _safe_int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS"), 20)  # Network timeout for repository archive download
ANALYSIS_TIMEOUT_SECONDS = _safe_int(os.getenv("ANALYSIS_TIMEOUT_SECONDS"), 60)  # Maximum analysis execution time per repository
MAX_EXTRACTED_SIZE_MB = _safe_int(os.getenv("MAX_EXTRACTED_SIZE_MB"), 150)       # 150 MB max decompressed archive size
MAX_EXTRACTED_FILES = _safe_int(os.getenv("MAX_EXTRACTED_FILES"), 2500)          # Maximum total files inside extracted archive
MAX_DIRECTORY_DEPTH = _safe_int(os.getenv("MAX_DIRECTORY_DEPTH"), 25)            # Maximum directory nesting depth

# HTTP Body & Concurrency Caps (Abuse Prevention)
MAX_REQUEST_BODY_BYTES = _safe_int(os.getenv("MAX_REQUEST_BODY_BYTES"), 5_242_880) # 5 MB max HTTP request payload
MAX_CONCURRENT_ANALYSES = _safe_int(os.getenv("MAX_CONCURRENT_ANALYSES"), 3)      # Max in-flight analysis tasks
RATE_LIMIT_ANALYZE_PER_MINUTE = _safe_int(os.getenv("RATE_LIMIT_ANALYZE_PER_MINUTE"), 15) # Per-client analyze rate limit
RATE_LIMIT_EXPLAIN_PER_MINUTE = _safe_int(os.getenv("RATE_LIMIT_EXPLAIN_PER_MINUTE"), 45) # Per-client explain rate limit

# Production Security & Documentation Controls
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "false" if IS_PRODUCTION else "true").strip().lower() in ("true", "1", "yes")

# Optional Shared Secret Authentication (for shared/cloud server deployments)
API_KEY_AUTH_ENABLED = os.getenv("API_KEY_AUTH_ENABLED", "false").strip().lower() in ("true", "1", "yes")
CODESENTINEL_API_KEY = os.getenv("CODESENTINEL_API_KEY", "").strip() or None

# Analysis Thresholds
COMPLEXITY_CRITICAL_THRESHOLD = _safe_int(os.getenv("COMPLEXITY_CRITICAL_THRESHOLD"), 25) # McCabe complexity >= 25 is Critical
COMPLEXITY_HIGH_THRESHOLD = _safe_int(os.getenv("COMPLEXITY_HIGH_THRESHOLD"), 15)         # McCabe complexity >= 15 is High
COMPLEXITY_WARNING_THRESHOLD = _safe_int(os.getenv("COMPLEXITY_WARNING_THRESHOLD"), 10)   # McCabe complexity > 10 is Moderate

DUPLICATION_MIN_LINES = _safe_int(os.getenv("DUPLICATION_MIN_LINES"), 10)                 # Minimum identical lines to flag duplication
DUPLICATION_WINDOW_TOKENS = _safe_int(os.getenv("DUPLICATION_WINDOW_TOKENS"), 30)         # Sliding window token size for duplication n-grams

COUPLING_CIRCULAR_SEVERITY = "critical"
COUPLING_HIGH_IN_DEGREE = _safe_int(os.getenv("COUPLING_HIGH_IN_DEGREE"), 12)             # Flag modules imported by >= 12 dependents


def get_safe_config_summary() -> Dict[str, Any]:
    """Returns safe, non-sensitive configuration diagnostics without exposing secret keys or credentials."""
    return {
        "engine_name": ENGINE_NAME,
        "engine_version": ENGINE_VERSION,
        "environment": ENVIRONMENT,
        "supported_languages": SUPPORTED_LANGUAGES,
        "allow_local_analysis": ALLOW_LOCAL_ANALYSIS,
        "allowed_workspace_roots": [str(p) for p in ALLOWED_LOCAL_WORKSPACES],
        "gemini_model": GEMINI_MODEL,
        "gemini_configured": bool(GEMINI_API_KEY and GEMINI_API_KEY.strip()),
        "github_configured": bool(GITHUB_TOKEN and GITHUB_TOKEN.strip()),
        "resource_limits": {
            "max_files": MAX_FILES,
            "max_repo_size_mb": MAX_REPO_SIZE_MB,
            "max_file_size_bytes": MAX_FILE_SIZE_BYTES,
            "download_timeout_seconds": DOWNLOAD_TIMEOUT_SECONDS,
            "analysis_timeout_seconds": ANALYSIS_TIMEOUT_SECONDS,
            "max_extracted_size_mb": MAX_EXTRACTED_SIZE_MB,
            "max_extracted_files": MAX_EXTRACTED_FILES,
            "max_directory_depth": MAX_DIRECTORY_DEPTH,
        },
    }
