"""CodeSentinel AI - Backend Configuration & Resource Limits."""

import os
from pathlib import Path

# Base Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_PATH = DATA_DIR / "codesentinel.db"

# Engine Metadata
ENGINE_VERSION = "0.3.0-phase13"
ENGINE_NAME = "CodeSentinel Python Static Analysis Engine"
SUPPORTED_LANGUAGES = ["python"]

# Gemini AI Explanation Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))
GEMINI_MAX_SNIPPET_LINES = 120
GEMINI_MAX_PROMPT_CHARS = 8000

# Resource & Security Limits
MAX_FILES = 500                    # Maximum Python files analyzed per repository
MAX_REPO_SIZE_MB = 50              # Maximum total repository archive / directory size
MAX_FILE_SIZE_BYTES = 1_000_000    # 1 MB max per individual source file
DOWNLOAD_TIMEOUT_SECONDS = 20      # Network timeout for repository archive download
ANALYSIS_TIMEOUT_SECONDS = 60      # Maximum analysis execution time per repository

# Analysis Thresholds
COMPLEXITY_CRITICAL_THRESHOLD = 25 # McCabe complexity >= 25 is Critical
COMPLEXITY_HIGH_THRESHOLD = 15     # McCabe complexity >= 15 is High
COMPLEXITY_WARNING_THRESHOLD = 10  # McCabe complexity > 10 is Moderate

DUPLICATION_MIN_LINES = 10         # Minimum identical or near-identical lines to flag duplication
DUPLICATION_WINDOW_TOKENS = 30     # Sliding window token size for duplication n-grams

COUPLING_CIRCULAR_SEVERITY = "critical"
COUPLING_HIGH_IN_DEGREE = 12       # Flag modules imported by >= 12 dependents as god-objects
