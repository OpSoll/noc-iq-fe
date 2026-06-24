# Frontend Dependency Policy

CI enforces this policy on every PR that modifies `package.json`.

## Rules

| Rule ID | Description |
|---------|-------------|
| `single-http-client` | Only `axios` is the approved HTTP client. |
| `single-date-lib` | At most one date utility library. |
| `no-duplicate-lodash` | Only one lodash variant (prefer `lodash-es`). |
| `no-css-in-js` | No CSS-in-JS libraries — use Tailwind classes. |
| `no-prod-polyfills` | Polyfill packages must be in `devDependencies`. |

## Adding an Exception

Edit `scripts/dep-policy-exceptions.json`:

```json
{
  "package-name": {
    "rules": ["rule-id"],
    "reason": "Specific justification for this project"
  }
}
```

Exceptions require a PR review and a clear business reason. They are visible in code review.

## Running Locally

```bash
node scripts/dep-policy-check.mjs
```
