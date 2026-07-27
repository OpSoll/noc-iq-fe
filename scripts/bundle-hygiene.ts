#!/usr/bin/env npx tsx
/**
 * scripts/bundle-hygiene.ts
 * Scans package.json for suspicious or accidental dependencies and devDependencies.
 * Exit 0 = clean, Exit 1 = suspicious packages found.
 */

import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

interface Violation {
  name: string;
  section: string;
  reason: string;
  severity: "error" | "warn";
}

const violations: Violation[] = [];

// ── Known accidental / CLI-tool packages that should never be app deps ──────

const ACCIDENTAL: Record<string, { reason: string; severity: "error" | "warn" }> = {
  install: { reason: "The 'install' package is not a real runtime dependency — likely added by mistake (npm install install).", severity: "error" },
  npm: { reason: "The 'npm' CLI package should not be bundled as a runtime dependency.", severity: "error" },
  npx: { reason: "The 'npx' package should not be bundled as a runtime dependency.", severity: "error" },
  yarn: { reason: "The 'yarn' package should not be bundled as a runtime dependency.", severity: "error" },
  pnpm: { reason: "The 'pnpm' package should not be bundled as a runtime dependency.", severity: "error" },
  node: { reason: "The 'node' package should not be bundled as a runtime dependency.", severity: "error" },
  "npm-cli": { reason: "The 'npm-cli' package should not be bundled as a runtime dependency.", severity: "error" },
};

// ── Check production dependencies ───────────────────────────────────────────

for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
  if (ACCIDENTAL[name]) {
    violations.push({
      name,
      section: "dependencies",
      reason: ACCIDENTAL[name].reason,
      severity: ACCIDENTAL[name].severity,
    });
  }
}

// ── Check devDependencies ───────────────────────────────────────────────────

for (const [name] of Object.entries(pkg.devDependencies ?? {})) {
  if (ACCIDENTAL[name]) {
    violations.push({
      name,
      section: "devDependencies",
      reason: ACCIDENTAL[name].reason,
      severity: ACCIDENTAL[name].severity,
    });
  }
}

// ── Detect potential duplicate-purpose packages ──────────────────────────────

const HTTP_CLIENTS = ["axios", "got", "ky", "node-fetch", "superagent", "undici", "needle"];
const allDepNames = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
const foundHttpClients = allDepNames.filter((d) => HTTP_CLIENTS.includes(d));
if (foundHttpClients.length > 1) {
  violations.push({
    name: foundHttpClients.join(", "),
    section: "multiple",
    reason: `Multiple HTTP clients detected: ${foundHttpClients.join(", ")}. Only one should be used.`,
    severity: "warn",
  });
}

// ── Detect empty or suspicious version strings ───────────────────────────────

for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
  if (typeof version === "string" && (version === "" || version === "*")) {
    violations.push({
      name,
      section: "dependencies",
      reason: `Dependency '${name}' has an unbounded version (${version}). Pin to a specific range.`,
      severity: "warn",
    });
  }
}

// ── Output ───────────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log("✅ Bundle hygiene check passed. No suspicious dependencies found.");
  process.exit(0);
}

const errors = violations.filter((v) => v.severity === "error");
const warns = violations.filter((v) => v.severity === "warn");

if (errors.length > 0) {
  console.log(`\n❌ Bundle hygiene errors (${errors.length}):\n`);
  errors.forEach(({ name, section, reason }, i) => {
    console.log(`  ${i + 1}. [${section}] ${name}`);
    console.log(`     → ${reason}\n`);
  });
}

if (warns.length > 0) {
  console.log(`\n⚠️  Bundle hygiene warnings (${warns.length}):\n`);
  warns.forEach(({ name, section, reason }, i) => {
    console.log(`  ${i + 1}. [${section}] ${name}`);
    console.log(`     → ${reason}\n`);
  });
}

process.exit(errors.length > 0 ? 1 : 0);
