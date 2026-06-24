#!/usr/bin/env node
// Release gate: validates frontend-backend compatibility before production tagging.
// Usage: node scripts/release-gate.mjs
// Bypass:  RELEASE_GATE_BYPASS=approved node scripts/release-gate.mjs

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── Load compatibility logic (compiled JS lives in .next; for the gate we
//    duplicate the pure logic inline to avoid a build dependency at tag time).
/** @type {Record<string, string[]>} */
const COMPATIBILITY_MATRIX = {
  "0.1": ["v1", "v1.1"],
  "0.2": ["v1.1", "v2"],
  "1.0": ["v2", "v2.1"],
};

function checkCompatibility(feVersion, beVersion) {
  const prefix = feVersion.split(".").slice(0, 2).join(".");
  const supported = COMPATIBILITY_MATRIX[prefix];
  if (!supported) {
    return {
      compatible: false,
      details: `Frontend version "${feVersion}" (prefix "${prefix}") has no entry in the compatibility matrix.`,
    };
  }
  if (!supported.includes(beVersion)) {
    return {
      compatible: false,
      details: `Frontend ${feVersion} supports backend API versions [${supported.join(", ")}], but got "${beVersion}".`,
    };
  }
  return {
    compatible: true,
    details: `Frontend ${feVersion} is compatible with backend API ${beVersion}.`,
  };
}

// ── Resolve versions ──────────────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const feVersion = pkg.version;

let beVersion = process.env.BACKEND_API_VERSION;
if (!beVersion) {
  const contractPath = path.join(root, "fixtures", "backend-contract.json");
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  beVersion = contract.apiVersion;
}

console.log(`Release gate: FE=${feVersion}  BE=${beVersion}`);

// ── Bypass path ───────────────────────────────────────────────────────────────
if (process.env.RELEASE_GATE_BYPASS === "approved") {
  console.warn(
    `[RELEASE-GATE BYPASS] Compatibility check skipped. ` +
      `Approved by: ${process.env.RELEASE_GATE_APPROVER ?? "unspecified"}. ` +
      `Reason: ${process.env.RELEASE_GATE_REASON ?? "no reason provided"}.`
  );
  process.exit(0);
}

// ── Compatibility check ───────────────────────────────────────────────────────
const result = checkCompatibility(feVersion, beVersion);

if (!result.compatible) {
  console.error(`\n❌ Release gate FAILED — incompatibility detected:`);
  console.error(`   ${result.details}`);
  console.error(
    `\n   To bypass (requires documented approval), set:\n` +
      `   RELEASE_GATE_BYPASS=approved RELEASE_GATE_APPROVER="<name>" RELEASE_GATE_REASON="<reason>"`
  );
  process.exit(1);
}

console.log(`\n✅ Release gate PASSED — ${result.details}`);
