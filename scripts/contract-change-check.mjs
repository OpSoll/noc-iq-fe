#!/usr/bin/env node
/**
 * contract-change-check.mjs
 *
 * Detects impacted services and routes from changed files and prints
 * a contributor checklist when backend contracts may have changed.
 *
 * Usage:
 *   node scripts/contract-change-check.mjs [--base <ref>]
 *
 * Exits 0 if no contract changes detected, 1 if checklist items are printed.
 */

import { execSync } from "child_process";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "origin/main";

// Map of file patterns to the service/route they affect
const CONTRACT_MAP = [
  {
    pattern: /src\/services\/outages\.ts|src\/lib\/api\.ts/,
    service: "outages",
    routes: ["/outages", "/outages/[id]", "/outages/new"],
    tests: ["tests/outages-flow.test.tsx"],
    docs: ["docs/API.md", "docs/adr/002-outages-route-data-fetching.md"],
  },
  {
    pattern: /src\/services\/paymentService\.ts|src\/lib\/client\.ts/,
    service: "payments",
    routes: ["/payments"],
    tests: ["tests/payments-view.test.tsx"],
    docs: ["docs/API.md", "docs/adr/003-payments-route-stellar-integration.md"],
  },
  {
    pattern: /src\/services\/sla\.ts|src\/hooks\/useSlaConfig\.ts/,
    service: "sla",
    routes: ["/outages/[id]", "/config"],
    tests: ["src/hooks/useSlaConfig.test.tsx"],
    docs: ["docs/API.md"],
  },
  {
    pattern: /src\/services\/bulkImportService\.ts/,
    service: "bulkImport",
    routes: ["/bulk-import", "/bulk-import/history"],
    tests: ["tests/bulk-import-view.test.tsx"],
    docs: ["docs/API.md"],
  },
  {
    pattern: /src\/services\/webhookService\.ts/,
    service: "webhooks",
    routes: ["/webhooks"],
    tests: [],
    docs: ["docs/API.md"],
  },
  {
    pattern: /src\/lib\/auth\//,
    service: "auth",
    routes: ["/login", "/register"],
    tests: ["tests/auth-flow.test.tsx"],
    docs: ["docs/adr/001-auth-route-session-strategy.md"],
  },
];

function getChangedFiles() {
  try {
    const output = execSync(`git diff --name-only ${BASE} HEAD`, {
      encoding: "utf8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    // Fallback: staged files
    const output = execSync("git diff --name-only --cached", {
      encoding: "utf8",
    });
    return output.trim().split("\n").filter(Boolean);
  }
}

const changed = getChangedFiles();
if (!changed.length) {
  console.log("✅ No changed files detected.");
  process.exit(0);
}

const impacted = CONTRACT_MAP.filter(({ pattern }) =>
  changed.some((f) => pattern.test(f))
);

if (!impacted.length) {
  console.log("✅ No backend contract changes detected.");
  process.exit(0);
}

console.log("\n⚠️  Backend contract changes detected!\n");
console.log("Impacted services and routes:\n");

impacted.forEach(({ service, routes, tests, docs }) => {
  console.log(`  Service: ${service}`);
  console.log(`  Routes:  ${routes.join(", ")}`);
  if (tests.length) console.log(`  Tests:   ${tests.join(", ")}`);
  if (docs.length) console.log(`  Docs:    ${docs.join(", ")}`);
  console.log("");
});

console.log("📋 Contributor Checklist:");
console.log(
  "  [ ] Run the affected test files listed above and confirm they pass"
);
console.log("  [ ] Update docs/API.md if the API shape changed");
console.log("  [ ] Update the relevant ADR in docs/adr/ if the pattern changed");
console.log(
  "  [ ] Update type definitions in src/types/ to match new contract"
);
console.log(
  "  [ ] If a new field is optional for now, add a TODO with the migration plan"
);
console.log("");
console.log(
  "Fix the checklist items above before merging. This check exits with code 1."
);
process.exit(1);
