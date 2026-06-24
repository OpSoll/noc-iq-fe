# Contract Change Guide

When a backend API contract changes (new/removed fields, changed endpoints), this guide ensures frontend contributors update all impacted surfaces before merging.

## Automatic Detection

The CI workflow (`.github/workflows/contract-change-check.yml`) triggers on PRs that modify service files and posts a checklist comment automatically.

To run locally before pushing:

```bash
node scripts/contract-change-check.mjs
```

Or against a specific base:

```bash
node scripts/contract-change-check.mjs --base origin/main
```

## What Counts as a Contract Change

| File changed | Impacted service | Affected routes |
|---|---|---|
| `src/services/outages.ts`, `src/lib/api.ts` | outages | `/outages`, `/outages/[id]`, `/outages/new` |
| `src/services/paymentService.ts`, `src/lib/client.ts` | payments | `/payments` |
| `src/services/sla.ts`, `src/hooks/useSlaConfig.ts` | sla | `/outages/[id]`, `/config` |
| `src/services/bulkImportService.ts` | bulkImport | `/bulk-import`, `/bulk-import/history` |
| `src/services/webhookService.ts` | webhooks | `/webhooks` |
| `src/lib/auth/**` | auth | `/login`, `/register` |

## Checklist

When the script or CI flags a contract change, confirm:

- [ ] Run the affected test files and confirm they pass
- [ ] Update `docs/API.md` if the API response shape changed
- [ ] Update the relevant ADR in `docs/adr/` if the architectural pattern changed
- [ ] Update type definitions in `src/types/` to match the new contract
- [ ] If a new field is optional for now, add a `// TODO:` with the migration plan

## Adding New Services

To track a new service in the checker, add an entry to the `CONTRACT_MAP` array in `scripts/contract-change-check.mjs` and add the file pattern to the `paths` filter in `.github/workflows/contract-change-check.yml`.
