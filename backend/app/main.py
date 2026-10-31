"""CodeSentinel AI - FastAPI Application Entrypoint."""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware

from app import config
from app.api.routes import router as api_v1_router, api_compat_router
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


docs_enabled = getattr(config, "ENABLE_DOCS", not getattr(config, "IS_PRODUCTION", False))

app = FastAPI(
    title=ENGINE_NAME,
    description="Python Static Analysis Engine for Technical Debt and Maintainability Intelligence.",
    version=ENGINE_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

# Exception handlers for sanitized error payloads and unhandled exception safety
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again later."},
    )


# 1. Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Enforces standard defensive HTTP security headers on all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if getattr(config, "IS_PRODUCTION", False):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# 2. Request Body Size Limit Middleware
@app.middleware("http")
async def request_size_limit_middleware(request: Request, call_next):
    """Prevents HTTP payload denial of service by rejecting oversized request bodies."""
    max_bytes = getattr(config, "MAX_REQUEST_BODY_BYTES", 5_242_880)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request payload exceeds maximum allowed size of {max_bytes} bytes."},
                )
        except ValueError:
            pass

    return await call_next(request)


# 3. Optional Shared Secret API Key Authentication Middleware
@app.middleware("http")
async def optional_api_key_auth_middleware(request: Request, call_next):
    """Enforces API key authentication if explicitly enabled in deployment configuration."""
    if getattr(config, "API_KEY_AUTH_ENABLED", False):
        expected_key = getattr(config, "CODESENTINEL_API_KEY", None)
        if expected_key:
            path = request.url.path
            public_paths = {"/", "/health", "/api/v1/health", "/api/health", "/docs", "/redoc", "/openapi.json"}
            if path not in public_paths and not path.startswith("/docs") and not path.startswith("/redoc"):
                api_key = request.headers.get("X-API-Key")
                auth_header = request.headers.get("Authorization")
                bearer_key = None
                if auth_header and auth_header.startswith("Bearer "):
                    bearer_key = auth_header[7:].strip()
                provided = api_key or bearer_key
                if not provided or provided != expected_key:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Unauthorized: Invalid or missing API key."},
                        headers={"WWW-Authenticate": "Bearer"},
                    )
    return await call_next(request)


# 4. CORS Configuration (Environment-Aware Hardening)
is_prod = getattr(config, "IS_PRODUCTION", False)
custom_cors = os.getenv("CORS_ORIGINS")

if is_prod:
    # Strict CORS in Production: only explicitly configured origins
    prod_origins = []
    if custom_cors and custom_cors.strip():
        for origin in custom_cors.split(","):
            trimmed = origin.strip()
            if trimmed and trimmed not in prod_origins:
                prod_origins.append(trimmed)
    cors_origins = prod_origins
    cors_regex = None
    cors_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    cors_headers = ["Content-Type", "Authorization", "Accept", "X-Requested-With", "X-API-Key"]
else:
    # Development CORS (Localhost and internal developer subnets)
    dev_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://172.20.231.35:3000",
        "http://172.20.231.35:8000",
    ]
    if custom_cors and custom_cors.strip():
        for origin in custom_cors.split(","):
            trimmed = origin.strip()
            if trimmed and trimmed not in dev_origins:
                dev_origins.append(trimmed)
    cors_origins = dev_origins
    cors_regex = r"^https?://(localhost|127\.0\.0\.1|172\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$"
    cors_methods = ["*"]
    cors_headers = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=cors_methods,
    allow_headers=cors_headers,
)

# 5. Response Compression Middleware (GZip for payloads >= 1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount primary versioned API router and compatibility alias router
app.include_router(api_v1_router)
app.include_router(api_compat_router)


@app.get("/")
def root_index():
    docs_on = getattr(config, "ENABLE_DOCS", not getattr(config, "IS_PRODUCTION", False))
    payload = {
        "service": ENGINE_NAME,
        "version": ENGINE_VERSION,
        "health_url": "/api/v1/health",
    }
    if docs_on:
        payload["docs_url"] = "/docs"
    return payload


@app.get("/health")
def root_health():
    """Root health endpoint alias for service monitors and external health checks."""
    from app.api.routes import get_health
    return get_health()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
