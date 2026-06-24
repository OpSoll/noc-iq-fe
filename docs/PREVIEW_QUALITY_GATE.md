# Preview Environment Quality Gate Checklist

This quality gate validates key route behaviors in preview environments before merge.

## Checklist

- [ ] **Auth routes** — login and register pages render without error
- [ ] **Dashboard** — SLA metrics, KPI cards, and trend charts load
- [ ] **Outages list** — paginated list renders; empty/loading/error states display correctly
- [ ] **Outage detail** — single outage loads with SLA, payment, and dispute panels
- [ ] **Create outage** — form renders, draft preservation works, submission succeeds
- [ ] **Payments** — payment list renders with drawer detail view
- [ ] **Webhooks** — webhook list loads; create/edit/delivery/retry flows functional
- [ ] **Audit / config** — SLA configuration page loads and saves
- [ ] **Bulk import** — upload and history pages render

## CI Integration

The gate runs as a GitHub Actions workflow (`.github/workflows/preview-quality-gate.yml`).

### Failure output

If a check fails, the workflow logs the failing route with a direct link to the preview URL:

```
❌ FAIL: /outages — expected 200, got 500
   Preview: https://preview-123.noc-iq.dev/outages
```
