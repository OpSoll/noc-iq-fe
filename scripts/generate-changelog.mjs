#!/usr/bin/env node
/**
 * generate-changelog.mjs
 * Generates a markdown changelog section from git log since last tag (or --since ref).
 * Groups commits by conventional commit type and flags route-impacting changes.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs [--since <ref>] [--dry-run]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sinceIndex = args.indexOf('--since');
let sinceRef = sinceIndex !== -1 ? args[sinceIndex + 1] : null;

// Fall back to last tag, or first commit if no tags exist
if (!sinceRef) {
  try {
    sinceRef = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch {
    sinceRef = execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  }
}

const TYPES = {
  feat: '### Features',
  fix: '### Bug Fixes',
  perf: '### Performance',
  refactor: '### Refactoring',
  docs: '### Documentation',
};

// git log: <hash> <subject> | <body>
const log = execSync(
  `git log ${sinceRef}..HEAD --pretty=format:"%H %s"`,
  { encoding: 'utf8' }
).trim();

if (!log) {
  console.log('No commits since', sinceRef);
  process.exit(0);
}

const commits = log.split('\n').map((line) => {
  const [hash, ...rest] = line.split(' ');
  const subject = rest.join(' ');
  const match = subject.match(/^(\w+)(\(.+?\))?!?:\s*(.+)/);
  return { hash, subject, type: match?.[1] ?? 'other', scope: match?.[2] ?? '', message: match?.[3] ?? subject };
});

// Detect route-impacting commits: any commit that touched src/app/
const routeCommits = new Set();
for (const { hash } of commits) {
  try {
    const files = execSync(`git diff-tree --no-commit-id -r --name-only ${hash}`, { encoding: 'utf8' });
    if (files.split('\n').some((f) => f.startsWith('src/app/'))) {
      routeCommits.add(hash);
    }
  } catch { /* skip */ }
}

// Group by type
const grouped = {};
for (const commit of commits) {
  if (!TYPES[commit.type]) continue;
  (grouped[commit.type] ??= []).push(commit);
}

// Build markdown section
const date = new Date().toISOString().slice(0, 10);
const lines = [`## [Unreleased] — ${date}`, ''];

for (const [type, heading] of Object.entries(TYPES)) {
  if (!grouped[type]?.length) continue;
  lines.push(heading);
  for (const c of grouped[type]) {
    const routeNote = routeCommits.has(c.hash) ? ' ⚠️ **route-impacting**' : '';
    const scope = c.scope ? `**${c.scope.replace(/[()]/g, '')}**: ` : '';
    lines.push(`- ${scope}${c.message}${routeNote} (\`${c.hash.slice(0, 7)}\`)`);
  }
  lines.push('');
}

lines.push('> **Rollout notes:** Review route-impacting changes above before deploying. Manual corrections can be made directly in CHANGELOG.md.');
lines.push('');

const section = lines.join('\n');

if (dryRun) {
  console.log('--- DRY RUN ---');
  console.log(section);
  process.exit(0);
}

// Prepend section into CHANGELOG.md after the header block
const changelogPath = resolve('CHANGELOG.md');
const existing = readFileSync(changelogPath, 'utf8');
const insertAfter = '<!-- CHANGELOG_START -->';
const idx = existing.indexOf(insertAfter);

let updated;
if (idx !== -1) {
  updated = existing.slice(0, idx + insertAfter.length) + '\n\n' + section + existing.slice(idx + insertAfter.length);
} else {
  updated = existing + '\n' + section;
}

writeFileSync(changelogPath, updated, 'utf8');
console.log('CHANGELOG.md updated.');
