"""FastAPI Versioned API Endpoints (v1 and Compatibility Aliases)."""

import os
import sys
import time
import logging
import threading
from collections import defaultdict
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Query, Request, status

from app import config
from app.config import (
    ENGINE_VERSION,
    ENGINE_NAME,
    SUPPORTED_LANGUAGES,
    MAX_FILES,
    MAX_REPO_SIZE_MB,
)
from app.models.schemas import (
    AnalyzeRequest,
    AnalysisResult,
    AnalysisListItem,
    ExplainFindingRequest,
    FindingExplanationResponse,
    RepositoryTrendsResponse,
    ComparisonResponse,
    PrioritizedFinding,
    ModuleHotspotRankItem,
    PatternInsightItem,
    DeveloperReportResponse,
)
from app.ingestion.validator import validate_github_url
from app.ingestion.downloader import SecureRepositoryIngester, IngestionError
from app.analyzer.engine import StaticAnalysisEngine
from app.storage.database import (
    save_analysis,
    get_analysis,
    list_analyses,
    delete_analysis,
    get_analyses_by_repository,
)
from app.analyzer.trends import compute_cmdi_trends
from app.analyzer.comparison import compare_analyses, ComparisonError
from app.analyzer.prioritization import prioritize_findings
from app.analyzer.hotspot_ranking import rank_modules
from app.analyzer.pattern_insights import extract_pattern_insights
from app.analyzer.report import generate_developer_report
from app.ai.gemini_explainer import (
    GeminiExplainer,
    GeminiKeyMissingError,
    GeminiRateLimitError,
    GeminiTimeoutError,
    GeminiInvalidResponseError,
    GeminiServiceError,
)

logger = logging.getLogger("codesentinel.api")


class ProcessRateLimiter:
    """In-memory sliding-window rate limiter per client identifier."""
    def __init__(self):
        self._lock = threading.Lock()
        self._records = defaultdict(list)

    def reset(self):
        """Clears all stored rate limit records (for testing)."""
        with self._lock:
            self._records.clear()

    def check_rate_limit(self, client_id: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int]:
        """Checks if client exceeded rate limit.

        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        if max_requests <= 0:
            return True, 0

        # In test environments, bypass rate limiting unless ENVIRONMENT == "test_rate_limit"
        raw_ip = client_id.split(":")[-1]
        if getattr(config, "ENVIRONMENT", "") != "test_rate_limit":
            if (raw_ip in ("testclient", "127.0.0.1", "localhost") and "pytest" in sys.modules) or os.getenv("DISABLE_RATE_LIMITER") == "true":
                return True, 0

        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            timestamps = self._records[client_id]
            # Prune old timestamps
            self._records[client_id] = [t for t in timestamps if t > cutoff]

            if len(self._records[client_id]) >= max_requests:
                earliest = self._records[client_id][0]
                retry_after = max(1, int(earliest + window_seconds - now))
                return False, retry_after

            self._records[client_id].append(now)
            return True, 0


rate_limiter = ProcessRateLimiter()
analysis_semaphore = threading.BoundedSemaphore(getattr(config, "MAX_CONCURRENT_ANALYSES", 3))

base_router = APIRouter()


@base_router.get("/health")
def get_health():
    """Engine health status and diagnostic capabilities."""
    from app.storage.database import check_db_health
    from app.config import get_safe_config_summary

    db_ok, db_status, record_count = check_db_health()
    cfg = get_safe_config_summary()

    return {
        "status": "healthy" if db_ok else "degraded",
        "engine_version": ENGINE_VERSION,
        "engine_name": ENGINE_NAME,
        "supported_languages": SUPPORTED_LANGUAGES,
        "database": {
            "status": db_status,
            "persisted_records": record_count,
        },
        "gemini": {
            "configured": cfg["gemini_configured"],
            "model": cfg["gemini_model"],
        },
        "environment": cfg["environment"],
        "allow_local_analysis": cfg["allow_local_analysis"],
        "limits": cfg["resource_limits"],
    }


@base_router.post("/analyze", response_model=AnalysisResult, status_code=status.HTTP_200_OK)
def analyze_repository(request: AnalyzeRequest, http_request: Request):
    """Initiates static maintainability analysis on a GitHub repository or local directory."""
    client_ip = http_request.client.host if (http_request and http_request.client) else "unknown"

    # 1. Enforce process-local rate limiting
    allowed, retry_after = rate_limiter.check_rate_limit(
        client_id=f"analyze:{client_ip}",
        max_requests=getattr(config, "RATE_LIMIT_ANALYZE_PER_MINUTE", 15),
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Analysis request rate limit reached. Please wait before submitting another repository.",
            headers={"Retry-After": str(retry_after)},
        )

    # 2. Enforce concurrent analysis capacity
    acquired = analysis_semaphore.acquire(blocking=False)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The analysis engine is currently processing maximum concurrent repository tasks. Please retry shortly.",
            headers={"Retry-After": "5"},
        )

    try:
        repo_url = request.repository_url.strip() if request.repository_url else None
        local_path = request.local_path.strip() if request.local_path else None

        if not repo_url and not local_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must provide either 'repository_url' or 'local_path'.",
            )

        if repo_url and local_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot provide both 'repository_url' and 'local_path'. Please provide only one target.",
            )

        ingester = SecureRepositoryIngester()
        engine = StaticAnalysisEngine()

        # Flow A: Public GitHub Repository URL
        if repo_url:
            is_valid, err_msg, norm_url, owner, repo = validate_github_url(repo_url)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=err_msg,
                )

            try:
                repo_path, effective_branch = ingester.ingest_github_repository(owner, repo)
                try:
                    result = engine.analyze_repository(
                        repo_root=repo_path,
                        repo_name=f"{owner}/{repo}",
                        repo_url=norm_url,
                        branch=effective_branch,
                    )
                    try:
                        save_analysis(result)
                    except Exception as save_err:
                        logger.warning("Failed to persist analysis %s to database: %s", result.id, save_err)
                    return result
                finally:
                    ingester.cleanup_sandbox(repo_path)
            except IngestionError as ie:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(ie),
                )
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("Static analysis failure: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Static analysis engine encountered an unexpected error while processing the repository.",
                )

        # Flow B: Local Directory (Testing / Offline Scanning)
        if local_path:
            if not getattr(config, "ALLOW_LOCAL_ANALYSIS", True):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Local directory analysis is disabled on this server.",
                )
            try:
                local_dir = ingester.ingest_local_directory(local_path)
                repo_name = local_dir.name
                result = engine.analyze_repository(
                    repo_root=local_dir,
                    repo_name=repo_name,
                    repo_url=f"local://{repo_name}",
                    branch="local",
                )
                try:
                    save_analysis(result)
                except Exception as save_err:
                    logger.warning("Failed to persist local analysis %s to database: %s", result.id, save_err)
                return result
            except IngestionError as ie:
                err_msg = str(ie)
                if "outside authorized workspace boundaries" in err_msg or "disabled" in err_msg:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=err_msg,
                    )
                if "does not exist" in err_msg:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=err_msg,
                    )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=err_msg,
                )
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("Local static analysis failure: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Local static analysis engine encountered an unexpected error while processing the directory.",
                )
    finally:
        analysis_semaphore.release()


@base_router.get("/analyses", response_model=List[AnalysisListItem])
def list_previous_analyses(
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of historical records to retrieve"),
    offset: int = Query(default=0, ge=0, description="Number of historical records to skip for pagination"),
):
    """Retrieves previous historical analyses."""
    try:
        return list_analyses(limit=limit, offset=offset)
    except Exception as e:
        logger.exception("Database error while listing analyses: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve previous analyses from database.",
        )


@base_router.get("/analyses/trends", response_model=RepositoryTrendsResponse)
def get_repository_trends(
    repository_url: str = Query(..., description="Normalized repository URL to trace historical CMDI trajectory"),
):
    """Retrieves chronological CMDI trends for a specific repository."""
    raw_url = repository_url.strip() if repository_url else ""
    if not raw_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository URL cannot be empty.",
        )

    # Normalize URL format
    normalized_url = raw_url.rstrip("/")
    repo_name = normalized_url.split("/")[-1] if "/" in normalized_url else normalized_url

    if raw_url.startswith(("http://", "https://")):
        is_valid, err_msg, norm_url, owner, repo = validate_github_url(raw_url)
        if is_valid:
            normalized_url = norm_url
            repo_name = f"{owner}/{repo}"

    try:
        history_items = get_analyses_by_repository(normalized_url)
        return compute_cmdi_trends(
            repository_name=repo_name,
            repository_url=normalized_url,
            analyses=history_items,
        )
    except Exception as e:
        logger.exception("Error computing repository trends for %s: %s", normalized_url, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve historical trends for repository.",
        )


@base_router.get("/analyses/compare", response_model=ComparisonResponse)
def compare_two_analyses_get(
    base_id: str = Query(..., description="Earlier or baseline analysis ID"),
    target_id: str = Query(..., description="Later or target analysis ID"),
):
    """Compares two historical analyses belonging to the same repository (GET method)."""
    clean_base = base_id.strip() if base_id else ""
    clean_target = target_id.strip() if target_id else ""

    if not clean_base or not clean_target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'base_id' and 'target_id' query parameters are required.",
        )

    try:
        analysis_a = get_analysis(clean_base)
        if not analysis_a:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Baseline analysis with ID '{clean_base}' was not found.",
            )

        analysis_b = get_analysis(clean_target)
        if not analysis_b:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target analysis with ID '{clean_target}' was not found.",
            )

        return compare_analyses(analysis_a, analysis_b)
    except ComparisonError as ce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ce),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error during analysis comparison (%s vs %s): %s", clean_base, clean_target, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compare the specified analysis snapshots.",
        )


@base_router.post("/analyses/compare", response_model=ComparisonResponse)
def compare_two_analyses_post(
    payload: Dict[str, str],
):
    """Compares two historical analyses belonging to the same repository (POST method)."""
    base_id = payload.get("base_id") or payload.get("baseId") or ""
    target_id = payload.get("target_id") or payload.get("targetId") or ""
    return compare_two_analyses_get(base_id=base_id, target_id=target_id)


@base_router.get("/analyses/{analysis_id}", response_model=AnalysisResult)
def get_analysis_by_id(analysis_id: str):
    """Retrieves a full analysis report by ID."""
    clean_id = analysis_id.strip() if analysis_id else ""
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis ID cannot be empty.",
        )
    try:
        result = get_analysis(clean_id)
    except Exception as e:
        logger.exception("Database error while retrieving analysis %s: %s", clean_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve analysis from database.",
        )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{clean_id}' was not found.",
        )
    return result


@base_router.get("/analyses/{analysis_id}/prioritized", response_model=List[PrioritizedFinding])
def get_prioritized_findings(analysis_id: str):
    """Retrieves technical debt findings prioritized by analyzer severity, evidence, and module blast radius."""
    analysis = get_analysis_by_id(analysis_id)
    return prioritize_findings(
        findings=analysis.findings,
        hotspots=analysis.hotspots,
        architecture_nodes=analysis.architecture.nodes if analysis.architecture else None,
    )


@base_router.get("/analyses/{analysis_id}/hotspots-ranking", response_model=List[ModuleHotspotRankItem])
def get_module_hotspots_ranking(analysis_id: str):
    """Retrieves ranked module-level hotspots synthesizing cyclomatic complexity, coupling, and findings."""
    analysis = get_analysis_by_id(analysis_id)
    return rank_modules(analysis)


@base_router.get("/analyses/{analysis_id}/pattern-insights", response_model=List[PatternInsightItem])
def get_ai_pattern_insights(analysis_id: str):
    """Retrieves maintainability pattern insights associated with AI-assisted development workflows."""
    analysis = get_analysis_by_id(analysis_id)
    return extract_pattern_insights(analysis)


@base_router.get("/analyses/{analysis_id}/report", response_model=DeveloperReportResponse)
def get_developer_improvement_report(analysis_id: str):
    """Generates an executive developer improvement report summarizing analysis findings, hotspots, and actions."""
    analysis = get_analysis_by_id(analysis_id)
    return generate_developer_report(analysis)



@base_router.delete("/analyses/{analysis_id}")
def remove_analysis(analysis_id: str):
    """Deletes an analysis record."""
    clean_id = analysis_id.strip() if analysis_id else ""
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis ID cannot be empty.",
        )
    try:
        deleted = delete_analysis(clean_id)
    except Exception as e:
        logger.exception("Database error while deleting analysis %s: %s", clean_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete analysis from database.",
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{clean_id}' was not found.",
        )
    return {"status": "deleted", "id": clean_id}


@base_router.post("/findings/explain", response_model=FindingExplanationResponse, status_code=status.HTTP_200_OK)
def explain_finding_with_ai(
    request: ExplainFindingRequest,
    http_request: Request,
    fallback: bool = Query(default=False, description="Whether to return a deterministic rule-based fallback if AI explanation is unavailable"),
):
    """Generates an AI-powered plain-language explanation and refactoring guidance for a finding using Gemini."""
    client_ip = http_request.client.host if (http_request and http_request.client) else "unknown"

    # Enforce process-local rate limiting
    allowed, retry_after = rate_limiter.check_rate_limit(
        client_id=f"explain:{client_ip}",
        max_requests=getattr(config, "RATE_LIMIT_EXPLAIN_PER_MINUTE", 45),
        window_seconds=60,
    )
    if not allowed:
        if fallback:
            explainer = GeminiExplainer()
            return explainer.generate_fallback_explanation(request, reason="Rate limit reached")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Explanation request rate limit reached. Please wait before requesting additional AI guidance.",
            headers={"Retry-After": str(retry_after)},
        )

    explainer = GeminiExplainer()
    try:
        return explainer.explain_finding(request)
    except GeminiKeyMissingError as e:
        if fallback:
            return explainer.generate_fallback_explanation(request, reason=e.message)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        )
    except GeminiRateLimitError as e:
        if fallback:
            return explainer.generate_fallback_explanation(request, reason=e.message)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=e.message,
        )
    except GeminiTimeoutError as e:
        if fallback:
            return explainer.generate_fallback_explanation(request, reason=e.message)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=e.message,
        )
    except GeminiInvalidResponseError as e:
        if fallback:
            return explainer.generate_fallback_explanation(request, reason=e.message)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message,
        )
    except GeminiServiceError as e:
        if fallback:
            return explainer.generate_fallback_explanation(request, reason=e.message)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in Gemini explanation engine: %s", e)
        if fallback:
            return explainer.generate_fallback_explanation(request, reason="Internal unexpected error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred in the Gemini explanation engine. Please try again later.",
        )


# Export versioned router (primary v1 API)
router = APIRouter(prefix="/api/v1", tags=["Analysis"])
router.include_router(base_router)

# Export unversioned /api compatibility router to prevent unexpected 404s
api_compat_router = APIRouter(prefix="/api", tags=["Analysis (Compatibility Alias)"])
api_compat_router.include_router(base_router)
