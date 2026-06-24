# ADR-002: Outages Route Data Fetching Strategy

**Date:** 2026-06-24  
**Status:** Accepted  
**Route(s):** `/outages`, `/outages/[id]`, `/outages/new`  
**Deciders:** OpSoll frontend team

## Context

Outages are the core operational surface. The route must support list views, detail drill-down, new outage creation, and SLA dispute panels — each with different data freshness requirements.

## Decision

- List view (`/outages`) uses React Query with a short stale time for near-real-time refresh.
- Detail view (`/outages/[id]`) fetches via `src/services/outages.ts` and passes data to page components.
- New outage form is client-only; submission calls the outages service directly.
- SLA dispute state is managed locally in `SLADisputesPanel` and synced via service calls.

## Consequences

- Consistent cache invalidation: creating/updating an outage invalidates the list query key.
- Detail route is coupled to the outages service contract — changes to the API shape require service layer updates.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Server-side data fetching (RSC) | Outage state changes frequently; client-side polling is more appropriate |
| SWR | React Query already in use across the app; no reason to add a second cache library |

## References

- `src/services/outages.ts`, `src/app/outages/`, `src/components/outages/SLADisputesPanel.tsx`
