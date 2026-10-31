"""CodeSentinel AI - Historical CMDI Trend Analysis Engine.

Tracks how code maintainability and CMDI scores evolve across multiple analyses
for the same normalized repository:
- Queries actual persisted records from SQLite in chronological order.
- Calculates delta from previous analysis and valid percentage changes.
- Distinguishes improved (CMDI decreased), worsened (CMDI increased), unchanged, and unavailable scores.
- Handles edge cases: single analysis, empty history, null/unavailable CMDI scores.
- Never invents data or assumes missing CMDI is zero.
"""

from typing import List, Optional, Dict, Any
from app.models.schemas import (
    AnalysisListItem,
    TrendPoint,
    RepositoryTrendsResponse,
)
from app.analyzer.scoring import CMDI_DISCLAIMER


def compute_cmdi_trends(
    repository_name: str,
    repository_url: str,
    analyses: List[AnalysisListItem],
) -> RepositoryTrendsResponse:
    """Computes chronological CMDI trend points and overall repository trajectory."""
    if not analyses:
        return RepositoryTrendsResponse(
            repository_name=repository_name,
            repository_url=repository_url,
            total_analyses=0,
            earliest_date=None,
            latest_date=None,
            analyses=[],
            overall_trend="insufficient_data",
            net_cmdi_delta=None,
            heuristic_disclaimer=CMDI_DISCLAIMER,
        )

    # Sort chronologically by timestamp (oldest first)
    sorted_analyses = sorted(analyses, key=lambda a: a.timestamp)

    trend_points: List[TrendPoint] = []
    prev_cmdi: Optional[float] = None

    for idx, item in enumerate(sorted_analyses):
        cur_cmdi = item.cmdi if item.score_available else None
        delta: Optional[float] = None
        pct_change: Optional[float] = None
        direction = "baseline"

        if idx > 0:
            if cur_cmdi is not None and prev_cmdi is not None:
                delta = round(cur_cmdi - prev_cmdi, 2)
                # Lower CMDI represents lower debt = improved
                if delta < -0.2:
                    direction = "improved"
                elif delta > 0.2:
                    direction = "worsened"
                else:
                    direction = "unchanged"

                # Percentage change is only valid when previous CMDI > 0
                if prev_cmdi > 0:
                    pct_change = round(((cur_cmdi - prev_cmdi) / prev_cmdi) * 100.0, 1)
            else:
                direction = "unavailable"

        trend_points.append(
            TrendPoint(
                id=item.id,
                timestamp=item.timestamp,
                display_timestamp=item.display_timestamp,
                cmdi=cur_cmdi,
                score_available=item.score_available,
                risk_category=item.risk_category,
                findings_count=item.findings_count,
                files_examined=item.files_examined,
                delta_from_previous=delta,
                percentage_change=pct_change,
                trend_direction=direction,
            )
        )

        if cur_cmdi is not None:
            prev_cmdi = cur_cmdi

    # Compute overall trajectory from earliest to latest valid CMDI
    valid_points = [p for p in trend_points if p.cmdi is not None]
    overall_trend = "insufficient_data"
    net_delta: Optional[float] = None

    if len(valid_points) >= 2:
        earliest_val = valid_points[0].cmdi
        latest_val = valid_points[-1].cmdi
        net_delta = round(latest_val - earliest_val, 2)
        if net_delta < -0.2:
            overall_trend = "improved"
        elif net_delta > 0.2:
            overall_trend = "worsened"
        else:
            overall_trend = "unchanged"
    elif len(valid_points) == 1:
        overall_trend = "insufficient_data"
    else:
        overall_trend = "unavailable"

    earliest_date = sorted_analyses[0].timestamp if sorted_analyses else None
    latest_date = sorted_analyses[-1].timestamp if sorted_analyses else None

    return RepositoryTrendsResponse(
        repository_name=sorted_analyses[-1].repository_name if sorted_analyses else repository_name,
        repository_url=repository_url,
        total_analyses=len(sorted_analyses),
        earliest_date=earliest_date,
        latest_date=latest_date,
        analyses=trend_points,
        overall_trend=overall_trend,
        net_cmdi_delta=net_delta,
        heuristic_disclaimer=CMDI_DISCLAIMER,
    )
