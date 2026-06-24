# Frontend Reliability Scorecard

> Generated: 2026-06-24 | Commit: `local`

## Overall Health

| Metric | Value |
|--------|-------|
| Test suite | ⚠️ No data |
| Tests total | N/A |
| Tests passed | N/A |
| Tests failed | N/A |
| Lint errors | N/A |
| Lint warnings | N/A |

## Route Domain Scorecard

| Domain | Routes | Risk | Test Coverage |
|--------|--------|------|---------------|
| Auth | /login, /register, /(auth)/logic | 🔴 Critical | 🟢 Has tests |
| Outages | /outages, /outages/[id], /outages/new | 🟠 High | 🟢 Has tests |
| Payments | /payments | 🔴 Critical | 🟢 Has tests |
| Bulk Import | /bulk-import, /bulk-import/history | 🟡 Medium | 🟢 Has tests |
| Config | /config | 🟠 High | 🟢 Has tests |
| Settings | /setting | 🟡 Medium | 🟢 Has tests |

## Signal Definitions

| Signal | Meaning |
|--------|---------|
| 🟢 Has tests | At least one test file exists for the domain |
| 🔴 No tests | No test coverage — high regression risk |
| 🔴 Critical | Financial or auth impact; failures affect users immediately |
| 🟠 High | Core operational surface; failures degrade NOC workflow |
| 🟡 Medium | Supporting feature; failures are non-blocking |

## Trend Export

To export this scorecard for governance reviews, download the `reliability-scorecard` artifact
from the [Reliability Scorecard workflow](../../actions/workflows/reliability-scorecard.yml).
The artifact is retained for 90 days per run.

## Improving the Score

- Add test files for domains marked 🔴 No tests
- Fix any failing tests before merging to `main`
- Resolve lint errors; warnings should trend toward zero
- After any service change, re-run: `npm test && node scripts/generate-scorecard.mjs`
