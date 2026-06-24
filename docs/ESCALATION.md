# Escalation Map

On-call paths and owner contacts for high-risk frontend modules.

## Module Ownership

| Module / Path | Risk | Owner Group | Fallback |
|---------------|------|-------------|---------|
| `src/lib/auth/`, `src/providers/session.tsx`, `src/components/RouteGuard.tsx` | 🔴 Critical — auth/session | `@OpSoll/noc-iq-security` | `@OpSoll/noc-iq-frontend` |
| `src/services/paymentService.ts`, `src/app/payments/`, `src/components/payments/` | 🔴 Critical — financial | `@OpSoll/noc-iq-stellar` | `@OpSoll/noc-iq-frontend` |
| `src/services/sla.ts`, `src/hooks/useSlaConfig.ts` | 🔴 Critical — contract/billing | `@OpSoll/noc-iq-stellar` | `@OpSoll/noc-iq-frontend` |
| `src/services/outages.ts`, `src/app/outages/` | 🟠 High — operational | `@OpSoll/noc-iq-frontend` | Any contributor assigned to FE issues |
| `src/lib/api.ts`, `src/lib/config/`, `src/app/config/` | 🟠 High — env config | `@OpSoll/noc-iq-frontend` | Any contributor assigned to FE issues |
| `.github/workflows/` | 🟡 Medium — CI | `@OpSoll/noc-iq-frontend` | Repository admin |

## Escalation Paths

### Incident Response (Production Issue)

1. **P0 — Auth or Payment broken**
   - Page `@OpSoll/noc-iq-security` + `@OpSoll/noc-iq-stellar` immediately via Discord `#incidents`
   - If no response within 15 min → escalate to repository admin
   - Rollback via: revert the relevant merge commit on `main` and force-deploy

2. **P1 — Outage route unavailable**
   - Ping `@OpSoll/noc-iq-frontend` in Discord `#incidents`
   - If no response within 30 min → escalate to repository admin

3. **P2 — Non-blocking UI regression**
   - Open a GitHub issue tagged `bug`, `priority: high`
   - Assign to owning team from the table above

### Review Escalation (PR Stuck)

If a PR touching a high-risk module has not received review within **48 hours**:
1. Comment `@OpSoll/noc-iq-frontend` on the PR requesting review
2. If still no response after 24 hours → ping in Discord `#fe-reviews`
3. If blocked by an absent owner → repository admin may approve with a second contributor's sign-off

## Machine-Readable Ownership

Ownership is encoded in `.github/CODEOWNERS`. Tools can parse this file to:
- Auto-assign reviewers (GitHub enforces this natively)
- Generate ownership reports: `grep "^src/" .github/CODEOWNERS`
- Feed into incident routing scripts

## Communication Channels

| Channel | Purpose |
|---------|---------|
| GitHub Issues | Bug reports, feature requests, escalation tracking |
| Discord `#incidents` | Live incident coordination |
| Discord `#fe-reviews` | PR review requests |
