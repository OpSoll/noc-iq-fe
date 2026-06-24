#!/usr/bin/env node
/**
 * dep-policy-check.mjs
 * Enforces frontend dependency policy — flags disallowed dependency classes
 * and duplicated utility packages.
 *
 * Usage: node scripts/dep-policy-check.mjs
 * Exit 0 = clean, Exit 1 = violations found.
 */

import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const allDeps = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
};
const depNames = Object.keys(allDeps);

let exceptions = {};
try {
  exceptions = JSON.parse(
    readFileSync("scripts/dep-policy-exceptions.json", "utf8")
  );
} catch {
  // no exceptions file is fine
}

const violations = [];

function isExcepted(pkg, rule) {
  return exceptions[pkg]?.rules?.includes(rule);
}

// ── Rules ─────────────────────────────────────────────────────────────────────

// 1. Only one HTTP client (axios is the approved one)
const HTTP_CLIENTS = ["axios", "got", "ky", "node-fetch", "superagent", "undici", "needle"];
const foundHttpClients = depNames.filter((d) => HTTP_CLIENTS.includes(d));
if (foundHttpClients.length > 1) {
  violations.push({
    rule: "single-http-client",
    message: `Multiple HTTP clients found: ${foundHttpClients.join(", ")}. Only 'axios' is allowed.`,
    fix: `Remove all HTTP clients except 'axios'.`,
    packages: foundHttpClients.filter((d) => d !== "axios"),
  });
}

// 2. Only one date library
const DATE_LIBS = ["moment", "dayjs", "date-fns", "luxon", "chrono-node"];
const foundDateLibs = depNames.filter((d) => DATE_LIBS.includes(d) && !isExcepted(d, "date-lib"));
if (foundDateLibs.length > 1) {
  violations.push({
    rule: "single-date-lib",
    message: `Multiple date libraries found: ${foundDateLibs.join(", ")}.`,
    fix: `Keep only one date library. Add an exception in scripts/dep-policy-exceptions.json if both are genuinely needed.`,
    packages: foundDateLibs,
  });
}

// 3. No duplicate utility packages (lodash variants)
const LODASH_VARIANTS = ["lodash", "lodash-es", "lodash-fp"];
const foundLodash = depNames.filter((d) => LODASH_VARIANTS.includes(d) && !isExcepted(d, "lodash-variant"));
if (foundLodash.length > 1) {
  violations.push({
    rule: "no-duplicate-lodash",
    message: `Multiple lodash variants found: ${foundLodash.join(", ")}.`,
    fix: `Use only one variant. Prefer 'lodash-es' for tree-shaking.`,
    packages: foundLodash,
  });
}

// 4. No CSS-in-JS (project uses Tailwind)
const CSS_IN_JS = ["styled-components", "emotion", "@emotion/react", "@emotion/styled", "stitches", "vanilla-extract"];
const foundCssInJs = depNames.filter((d) => CSS_IN_JS.includes(d) && !isExcepted(d, "css-in-js"));
if (foundCssInJs.length > 0) {
  violations.push({
    rule: "no-css-in-js",
    message: `CSS-in-JS libraries are disallowed (project uses Tailwind): ${foundCssInJs.join(", ")}.`,
    fix: `Remove these packages and use Tailwind classes instead.`,
    packages: foundCssInJs,
  });
}

// 5. No direct polyfill packages in prod deps (should be devDeps or removed)
const POLYFILLS = ["core-js", "regenerator-runtime", "whatwg-fetch"];
const foundPolyfills = POLYFILLS.filter(
  (d) => pkg.dependencies?.[d] && !isExcepted(d, "polyfill")
);
if (foundPolyfills.length > 0) {
  violations.push({
    rule: "no-prod-polyfills",
    message: `Polyfill packages in dependencies (should be devDependencies or removed): ${foundPolyfills.join(", ")}.`,
    fix: `Move to devDependencies or remove if the build pipeline handles polyfills.`,
    packages: foundPolyfills,
  });
}

// ── Output ────────────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log("✅ Dependency policy check passed.");
  process.exit(0);
}

console.log(`\n❌ Dependency policy violations found (${violations.length}):\n`);
violations.forEach(({ rule, message, fix }, i) => {
  console.log(`  ${i + 1}. [${rule}] ${message}`);
  console.log(`     → Fix: ${fix}\n`);
});

console.log(
  "To add an exception, edit scripts/dep-policy-exceptions.json:\n" +
  '  { "package-name": { "rules": ["rule-id"], "reason": "why this is needed" } }\n'
);

process.exit(1);
