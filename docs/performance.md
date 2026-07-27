# Web Performance

## Overview

The project uses Lighthouse CI to continuously monitor frontend performance and prevent regressions from being merged into the codebase.

Lighthouse audits are executed automatically against the production build in GitHub Actions.

## Performance Budgets

The following performance budgets are enforced:

| Metric | Threshold | Status |
|---|---:|---|
| Largest Contentful Paint (LCP) | < 2.5s | Required |
| Cumulative Layout Shift (CLS) | < 0.1 | Required |
| Interaction to Next Paint (INP) | < 200ms | Required |
| Performance Score | ≥ 80 | Required |

## Core Web Vitals

### Largest Contentful Paint (LCP)

LCP measures how quickly the largest visible content element is rendered.

Target:

```text
LCP < 2.5 seconds