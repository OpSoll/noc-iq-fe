# Seed Data Packs for Preview Environments

Deterministic preview data packs allow UI reviewers to validate complex states across PRs.

## Available Packs

| Pack | Description |
|---|---|
| `normal` | All systems operational, minimal activity |
| `degraded` | Several low-to-medium severity outages in progress |
| `incident-heavy` | Multiple critical outages with SLA violations and delivery history |

## Usage

### CLI

```bash
npx tsx scripts/load-seed-pack.ts <pack-name>
```

### In tests / preview setup

```ts
import { getSeedPack, listSeedPacks } from "@/tests/fixtures/seed-packs";

const pack = getSeedPack("incident-heavy");
console.log(pack.outages.length); // 3
```

## Lifecycle & Versioning

- Seed packs live in `tests/fixtures/seed-packs.ts`
- Versioning follows git commits — no separate version scheme
- Update packs by editing the fixture file directly
- Add new packs by exporting named constants and registering in `ALL_PACKS`
