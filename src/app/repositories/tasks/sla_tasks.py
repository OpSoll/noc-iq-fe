import logging
from datetime import datetime, timedelta
from app.repositories.payment_repository import PaymentRepository
from app.utils.analytics_exporter import AnalyticsExporter

logger = logging.getLogger("reconciliation_engine")

def run_analytics_reconciliation_job(db_session, analytics_client):
    """
    Automated check-and-balance task checking metrics consistency.
    Executes behind a 10-minute sliding safety buffer to account for data pipeline latency.
    """
    # Define validation tracking windows
    end_marker = datetime.utcnow() - timedelta(minutes=10)
    start_marker = end_marker - timedelta(hours=1)
    
    repo = PaymentRepository(db_session)
    exporter = AnalyticsExporter(analytics_client)
    
    tx_truth = {item["status"]: item for item in repo.get_transactional_summary(start_marker, end_marker)}
    analytics_truth = {item["status"]: item for item in exporter.get_aggregated_analytics_summary(start_marker, end_marker)}
    
    mismatches = []
    
    for status, tx_data in tx_truth.items():
        an_data = analytics_truth.get(status, {"count": 0, "total": 0.0})
        
        count_drift = abs(tx_data["count"] - an_data["count"])
        amount_drift = abs(tx_data["total"] - an_data["total"])
        
        if count_drift > 0 or amount_drift > 0.01:
            mismatch_log = {
                "status_scope": status,
                "window_start": start_marker.isoformat(),
                "window_end": end_marker.isoformat(),
                "expected": tx_data,
                "actual": an_data,
                "drift": {"count_diff": count_drift, "amount_diff": amount_drift}
            }
            mismatches.append(mismatch_log)
            
    if mismatches:
        # Task Requirement: Automatically flags and outputs discrepancies
        logger.error(f"CRITICAL DISCREPANCY DETECTED: Analytics drift identified: {mismatches}")
        trigger_slack_pagerduty_alert(mismatches)
        return False
        
    logger.info("Reconciliation cycle complete. Data balances are 100% aligned.")
    return True

def trigger_slack_pagerduty_alert(payload):
    # Call core webhooks or operational notification utilities here
    pass