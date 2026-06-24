# Architecture Decision Records

This directory contains ADRs for significant frontend architectural decisions, scoped per route domain.

## Index

| ADR | Title | Route(s) | Status |
|-----|-------|----------|--------|
| [000](./000-template.md) | Template | — | Template |
| [001](./001-auth-route-session-strategy.md) | Auth Route Session Strategy | `/login`, `/register` | Accepted |
| [002](./002-outages-route-data-fetching.md) | Outages Route Data Fetching Strategy | `/outages`, `/outages/[id]` | Accepted |
| [003](./003-payments-route-stellar-integration.md) | Payments Route Stellar Integration | `/payments` | Accepted |

## When to Write an ADR

Write an ADR when:
- Choosing a data-fetching pattern for a new route
- Changing how auth/session is propagated
- Adopting a new library that affects multiple routes
- Making a breaking change to a shared service contract

## How to Add a New ADR

1. Copy `000-template.md` to `NNN-short-title.md` (next number in sequence)
2. Fill in all sections
3. Add a row to the index above
4. Link from the relevant route's section in `CONTRIBUTING.md`
