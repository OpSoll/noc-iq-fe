# Mismatch Remediation Workflow Guide

When the automated `sla_tasks.py` worker flags a discrepancy, it indicates that analytical aggregates have drifted outside acceptable tolerance levels due to pipeline latency or write contention. Follow this step-by-step resolution path:

## 1. Triage & Impact Scope Isolation
Analyze the JSON log payload emitted inside your alerting engine. Identify:
* The affected `status_scope` (e.g., SUCCESS vs FAILED payment mismatches).
* The precise `window_start` and `window_end` ISO timestamps.

## 2. Automated Re-Sync Execution (Level 1 Remediation)
If the drift is caused by a temporary message-broker lag, trigger the explicit recovery script to replay transactions for that timeframe:
```bash
python manage.py analytics:resync --start="2026-06-29T12:00:00" --end="2026-06-29T13:00:00"