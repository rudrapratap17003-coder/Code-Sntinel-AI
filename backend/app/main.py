"""CodeSentinel AI - FastAPI Application Entrypoint."""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_v1_router
from app.storage.database import init_db
from app.config import (
    ENGINE_NAME,
    ENGINE_VERSION,
    get_safe_config_summary,
    validate_workspace_configuration,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("codesentinel.api")

# Initialize SQLite database immediately upon module load
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database is ready and log non-sensitive diagnostics
    init_db()
    cfg = get_safe_config_summary()

    # Validate workspace containment configuration
    ws_valid, ws_issues = validate_workspace_configuration()
    if not ws_valid:
        for issue in ws_issues:
            logger.warning("Workspace configuration issue: %s", issue)

    logger.info(
        "CodeSentinel AI engine initialized (version=%s, env=%s, local_analysis=%s, gemini_configured=%s)",
        cfg["engine_version"],
        cfg["environment"],
        cfg["allow_local_analysis"],
        cfg["gemini_configured"],
    )
    yield
    logger.info("CodeSentinel AI engine shutting down cleanly.")


app = FastAPI(
    title=ENGINE_NAME,
    description="Python Static Analysis Engine for Technical Debt and Maintainability Intelligence.",
    version=ENGINE_VERSION,
    lifespan=lifespan,
)

# Build CORS allowed origins list (including defaults, LAN IP, and optional CORS_ORIGINS from env)
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://172.20.231.35:3000",
    "http://172.20.231.35:8000",
]
custom_cors = os.getenv("CORS_ORIGINS")
if custom_cors and custom_cors.strip():
    for origin in custom_cors.split(","):
        trimmed = origin.strip()
        if trimmed and trimmed not in cors_origins:
            cors_origins.append(trimmed)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|172\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.get("/")
def root_index():
    return {
        "service": ENGINE_NAME,
        "version": ENGINE_VERSION,
        "docs_url": "/docs",
        "health_url": "/api/v1/health",
    }


@app.get("/health")
def root_health():
    """Root health endpoint alias for service monitors and external health checks."""
    from app.api.routes import get_health
    return get_health()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
