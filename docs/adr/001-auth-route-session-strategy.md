# ADR-001: Auth Route Session Strategy

**Date:** 2026-06-24  
**Status:** Accepted  
**Route(s):** `/login`, `/register`, `/(auth)/logic`  
**Deciders:** OpSoll frontend team

## Context

The auth routes (`/login`, `/register`) must handle token storage, redirect preservation, and session hydration consistently. An inconsistent strategy causes redirect loops and lost in-flight state after login.

## Decision

- Session state is managed via `SessionProvider` (`src/providers/session.tsx`) wrapping the app.
- On login success, `redirect` query param is consumed and the user is sent to the preserved route.
- Auth utilities live in `src/lib/auth/` and are shared across all auth routes.
- `RouteGuard` (`src/components/RouteGuard.tsx`) enforces auth on protected routes.

## Consequences

- All auth logic is colocated; adding new auth providers only requires updating `src/lib/auth/`.
- Redirect preservation is guaranteed but requires the login page to forward the `?redirect=` param.
- Server components cannot access session directly — they rely on `RouteGuard` client-side checks.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Next.js middleware-based auth | Added complexity without benefit given current backend JWT model |
| Cookie-only session | Freighter wallet auth is client-side, making server cookie approach impractical |

## References

- Related issue: #213
- `src/lib/auth/`, `src/providers/session.tsx`, `src/components/RouteGuard.tsx`
