"""FastAPI Versioned API Endpoints (v1)."""

import os
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, status

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
)
from app.ingestion.validator import validate_github_url
from app.ingestion.downloader import SecureRepositoryIngester, IngestionError
from app.analyzer.engine import StaticAnalysisEngine
from app.storage.database import (
    save_analysis,
    get_analysis,
    list_analyses,
    delete_analysis,
)
from app.ai.gemini_explainer import (
    GeminiExplainer,
    GeminiKeyMissingError,
    GeminiRateLimitError,
    GeminiTimeoutError,
    GeminiInvalidResponseError,
    GeminiServiceError,
)

router = APIRouter(prefix="/api/v1", tags=["Analysis"])


@router.get("/health")
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


@router.post("/analyze", response_model=AnalysisResult, status_code=status.HTTP_200_OK)
def analyze_repository(request: AnalyzeRequest):
    """Initiates static maintainability analysis on a GitHub repository or local directory."""
    if not request.repository_url and not request.local_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'repository_url' or 'local_path'.",
        )

    ingester = SecureRepositoryIngester()
    engine = StaticAnalysisEngine()

    # Flow A: Public GitHub Repository URL
    if request.repository_url:
        is_valid, err_msg, norm_url, owner, repo = validate_github_url(request.repository_url)
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
                save_analysis(result)
                return result
            finally:
                ingester.cleanup_sandbox(repo_path)
        except IngestionError as ie:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(ie),
            )
        except Exception as e:
            import logging
            logging.getLogger("codesentinel.api").exception(f"Static analysis failure: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Static analysis engine encountered an unexpected error while processing the repository.",
            )

    # Flow B: Local Directory (Testing / Offline Scanning)
    if request.local_path:
        if not getattr(config, "ALLOW_LOCAL_ANALYSIS", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Local directory analysis is disabled on this server.",
            )
        try:
            local_dir = ingester.ingest_local_directory(request.local_path)
            repo_name = local_dir.name
            result = engine.analyze_repository(
                repo_root=local_dir,
                repo_name=repo_name,
                repo_url=f"local://{repo_name}",
                branch="local",
            )
            save_analysis(result)
            return result
        except IngestionError as ie:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(ie),
            )
        except Exception as e:
            import logging
            logging.getLogger("codesentinel.api").exception(f"Local static analysis failure: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Local static analysis engine encountered an unexpected error while processing the directory.",
            )


@router.get("/analyses", response_model=List[AnalysisListItem])
def list_previous_analyses(limit: int = 50):
    """Retrieves previous historical analyses."""
    return list_analyses(limit=limit)


@router.get("/analyses/{analysis_id}", response_model=AnalysisResult)
def get_analysis_by_id(analysis_id: str):
    """Retrieves a full analysis report by ID."""
    result = get_analysis(analysis_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' was not found.",
        )
    return result


@router.delete("/analyses/{analysis_id}")
def remove_analysis(analysis_id: str):
    """Deletes an analysis record."""
    deleted = delete_analysis(analysis_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' was not found.",
        )
    return {"status": "deleted", "id": analysis_id}


@router.post("/findings/explain", response_model=FindingExplanationResponse, status_code=status.HTTP_200_OK)
def explain_finding_with_ai(request: ExplainFindingRequest):
    """Generates an AI-powered plain-language explanation and refactoring guidance for a finding using Gemini."""
    explainer = GeminiExplainer()
    try:
        return explainer.explain_finding(request)
    except GeminiKeyMissingError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        )
    except GeminiRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=e.message,
        )
    except GeminiTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=e.message,
        )
    except GeminiInvalidResponseError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message,
        )
    except GeminiServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error in Gemini explanation engine: {str(e)}",
        )
