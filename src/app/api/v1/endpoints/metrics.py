from fastapi import APIRouter, Depends, HTTPException, status
from app.services.metrics import ReliabilityScorecardService, ScorecardMetrics

router = APIRouter()

@router.post("/scorecard/evaluate", status_code=status.HTTP_200_OK)
async def evaluate_release_governance(metrics: ScorecardMetrics):
    """
    Evaluates system logs and telemetry payloads against governance criteria to issue an auditable deployment decision.
    """
    try:
        scorecard = ReliabilityScorecardService.calculate_reliability_index(metrics)
        return {
            "success": True,
            "data": scorecard
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile reliability analytics: {str(e)}"
        )