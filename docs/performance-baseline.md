# Performance Baseline

## Baseline Branch

`main`

## Baseline Environment

- Browser: Chromium
- Lighthouse CI: `@lhci/cli`
- Build: Next.js production build
- Runs per URL: 3

## Enforced Budgets

| Metric | Budget |
|---|---:|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| Performance Score | ≥ 80 |

## Baseline Status

The initial Lighthouse baseline was established against the production build on the `main` branch.

Future pull requests must remain within the defined performance budgets.