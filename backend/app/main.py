"""CodeSentinel AI - FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_v1_router
from app.storage.database import init_db
from app.config import ENGINE_NAME, ENGINE_VERSION


# Initialize SQLite database immediately upon module load
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database is ready
    init_db()
    yield


app = FastAPI(
    title=ENGINE_NAME,
    description="Python Static Analysis Engine for Technical Debt and Maintainability Intelligence.",
    version=ENGINE_VERSION,
    lifespan=lifespan,
)

# Enable CORS for CodeSentinel AI frontend (Vite dev server, LAN/Wi-Fi, and production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://172.20.231.35:3000",
        "http://172.20.231.35:8000",
    ],
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
