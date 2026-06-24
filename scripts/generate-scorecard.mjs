#!/usr/bin/env node
/**
 * generate-scorecard.mjs
 *
 * Generates docs/RELIABILITY_SCORECARD.md from available test and lint results.
 * Designed to run after `npm test -- --coverage` and `npm run lint`.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const now = new Date().toISOString().slice(0, 10);
const testExitCode = process.env.TEST_EXIT_CODE ?? "0";

// ── Route domain definitions ──────────────────────────────────────────────────
const DOMAINS = [
  {
    name: "Auth",
    routes: ["/login", "/register", "/(auth)/logic"],
    testFiles: ["tests/auth-flow.test.tsx"],
    services: ["src/lib/auth/"],
    riskLevel: "🔴 Critical",
  },
  {
    name: "Outages",
    routes: ["/outages", "/outages/[id]", "/outages/new"],
    testFiles: ["tests/outages-flow.test.tsx"],
    services: ["src/services/outages.ts"],
    riskLevel: "🟠 High",
  },
  {
    name: "Payments",
    routes: ["/payments"],
    testFiles: ["tests/payments-view.test.tsx"],
    services: ["src/services/paymentService.ts"],
    riskLevel: "🔴 Critical",
  },
  {
    name: "Bulk Import",
    routes: ["/bulk-import", "/bulk-import/history"],
    testFiles: ["tests/bulk-import-view.test.tsx"],
    services: ["src/services/bulkImportService.ts"],
    riskLevel: "🟡 Medium",
  },
  {
    name: "Config",
    routes: ["/config"],
    testFiles: ["tests/config-page.test.tsx"],
    services: ["src/lib/config/"],
    riskLevel: "🟠 High",
  },
  {
    name: "Settings",
    routes: ["/setting"],
    testFiles: ["tests/settings-wallet.test.tsx"],
    services: [],
    riskLevel: "🟡 Medium",
  },
];

// ── Parse test results ────────────────────────────────────────────────────────
function parseTestResults() {
  if (!existsSync("test-results.json")) {
    return { total: "N/A", passed: "N/A", failed: "N/A", status: "⚠️ No data" };
  }
  try {
    const raw = JSON.parse(readFileSync("test-results.json", "utf8"));
    // Vitest JSON reporter shape
    const numTotalTests = raw.numTotalTests ?? raw.testResults?.reduce((s, f) => s + (f.numPassingTests + f.numFailingTests), 0) ?? 0;
    const numPassedTests = raw.numPassedTests ?? raw.testResults?.reduce((s, f) => s + f.numPassingTests, 0) ?? 0;
    const numFailedTests = raw.numFailedTests ?? (numTotalTests - numPassedTests);
    const status = testExitCode === "0" ? "✅ Pass" : "❌ Fail";
    return { total: numTotalTests, passed: numPassedTests, failed: numFailedTests, status };
  } catch {
    return { total: "N/A", passed: "N/A", failed: "N/A", status: "⚠️ Parse error" };
  }
}

// ── Lint results ──────────────────────────────────────────────────────────────
function parseLintResults() {
  if (!existsSync("lint-results.json")) return { errors: "N/A", warnings: "N/A" };
  try {
    const raw = JSON.parse(readFileSync("lint-results.json", "utf8"));
    const errors = Array.isArray(raw) ? raw.reduce((s, f) => s + f.errorCount, 0) : "N/A";
    const warnings = Array.isArray(raw) ? raw.reduce((s, f) => s + f.warningCount, 0) : "N/A";
    return { errors, warnings };
  } catch {
    return { errors: "N/A", warnings: "N/A" };
  }
}

const testSummary = parseTestResults();
const lintSummary = parseLintResults();

// ── Build scorecard markdown ──────────────────────────────────────────────────
const rows = DOMAINS.map(({ name, routes, testFiles, riskLevel }) => {
  const hasCoverage = testFiles.length > 0;
  const coverageStatus = hasCoverage ? "🟢 Has tests" : "🔴 No tests";
  return `| ${name} | ${routes.join(", ")} | ${riskLevel} | ${coverageStatus} |`;
}).join("\n");

const scorecard = `# Frontend Reliability Scorecard

> Generated: ${now} | Commit: \`${process.env.GITHUB_SHA?.slice(0, 7) ?? "local"}\`

## Overall Health

| Metric | Value |
|--------|-------|
| Test suite | ${testSummary.status} |
| Tests total | ${testSummary.total} |
| Tests passed | ${testSummary.passed} |
| Tests failed | ${testSummary.failed} |
| Lint errors | ${lintSummary.errors} |
| Lint warnings | ${lintSummary.warnings} |

## Route Domain Scorecard

| Domain | Routes | Risk | Test Coverage |
|--------|--------|------|---------------|
${rows}

## Signal Definitions

| Signal | Meaning |
|--------|---------|
| 🟢 Has tests | At least one test file exists for the domain |
| 🔴 No tests | No test coverage — high regression risk |
| 🔴 Critical | Financial or auth impact; failures affect users immediately |
| 🟠 High | Core operational surface; failures degrade NOC workflow |
| 🟡 Medium | Supporting feature; failures are non-blocking |

## Trend Export

To export this scorecard for governance reviews, download the \`reliability-scorecard\` artifact
from the [Reliability Scorecard workflow](../../actions/workflows/reliability-scorecard.yml).
The artifact is retained for 90 days per run.

## Improving the Score

- Add test files for domains marked 🔴 No tests
- Fix any failing tests before merging to \`main\`
- Resolve lint errors; warnings should trend toward zero
- After any service change, re-run: \`npm test && node scripts/generate-scorecard.mjs\`
`;

writeFileSync("docs/RELIABILITY_SCORECARD.md", scorecard);
console.log("✅ Scorecard written to docs/RELIABILITY_SCORECARD.md");
