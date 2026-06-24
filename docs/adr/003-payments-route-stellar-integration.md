# ADR-003: Payments Route Stellar Integration

**Date:** 2026-06-24  
**Status:** Accepted  
**Route(s):** `/payments`  
**Deciders:** OpSoll frontend team

## Context

Payments are executed on the Stellar network. The payments route must present transaction history, allow dispute actions, and interact with the Freighter wallet — all without blocking the main UI thread.

## Decision

- Stellar network calls are wrapped in `src/services/paymentService.ts`; no direct SDK calls from components.
- Freighter wallet interactions are handled via `src/lib/auth/` utilities.
- Payment detail state is kept in a drawer (`payment-detail-drawer.tsx`) to avoid full-page navigations.
- All monetary amounts are treated as strings to avoid floating-point precision issues.

## Consequences

- The service layer is the single integration point; swapping Stellar SDK versions requires changes only in `paymentService.ts`.
- Drawer-based detail avoids losing list scroll position.
- String-based amounts require explicit formatting before display.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Direct Stellar SDK calls in components | Couples UI to SDK; hard to test and mock |
| Separate payments page for each transaction | Creates excessive routing overhead |

## References

- `src/services/paymentService.ts`, `src/app/payments/`, `src/components/payments/`
- Related: `docs/STELLAR_INTEGRATION.md`
