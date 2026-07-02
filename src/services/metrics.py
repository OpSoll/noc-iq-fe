from typing import Dict, Any
from pydantic import BaseModel

class ScorecardMetrics(BaseModel):
    slo_success_rate: float      # e.g., 0.995 (99.5%)
    test_pass_rate: float         # e.g., 1.00 (100%)
    open_security_vulns: int     # Count of blocking CVEs
    incident_count: int          # Active P1/P2 production events

class ReliabilityScorecardService:
    @staticmethod
    def calculate_reliability_index(metrics: ScorecardMetrics) -> Dict[str, Any]:
        """
        Computes a consolidated reliability score normalized between 0 and 100.
        Weight Distribution: SLO Health (40%), Test Pass Rate (30%), Security (20%), Incident Signals (10%)
        """
        # 1. Base components calculations
        slo_score = metrics.slo_success_rate * 100
        test_score = metrics.test_pass_rate * 100
        
        # Deduct 25 points per open vulnerability, capped at 0
        security_score = max(0, 100 - (metrics.open_security_vulns * 25))
        
        # Deduct 50 points per active incident, capped at 0
        incident_score = max(0, 100 - (metrics.incident_count * 50))
        
        # 2. Weighted Aggregation Formula
        reliability_index = (
            (slo_score * 0.40) +
            (test_score * 0.30) +
            (security_score * 0.20) +
            (incident_score * 0.10)
        )
        
        # 3. Governance Evaluation Rule
        decision = "GO" if reliability_index >= 85.0 and metrics.open_security_vulns == 0 else "NO-GO"
        
        return {
            "reliability_index": round(reliability_index, 2),
            "status": decision,
            "breakdown": {
                "slo_component": round(slo_score, 2),
                "test_component": round(test_score, 2),
                "security_component": security_score,
                "incident_component": incident_score
            },
            "metrics_evaluated": metrics.dict()
        }