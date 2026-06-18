#!/usr/bin/env node
// Run after `aspire publish` to make the generated Docker Compose file
// production-ready before deploying.
//
// What this does:
//   - Removes dev-only services: jaeger
//   - Removes GCS_EMULATOR_HOST from the backend environment (safety net in
//     case an old compose is patched — the AppHost already excludes it in
//     publish mode)
//   - Fixes the backend PORT from 8000 → 8080 so it matches nginx.conf's
//     proxy_pass target (http://backend:8080)
//
// Usage: node scripts/strip-compose.mjs [path/to/docker-compose.yaml]
// Default input/output: aspire-output/docker-compose.yaml (edited in place)

import { readFileSync, writeFileSync } from "fs";

const STRIP_SERVICES = ["jaeger"];

const filePath = process.argv[2] ?? "aspire-output/docker-compose.yaml";
const lines = readFileSync(filePath, "utf8").split("\n");
const out = [];

let skipService = false;
let serviceIndent = null;
let skipDepEntry = false;
let depIndent = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // ── Skip an entire top-level service block ────────────────────────────────
  if (!skipService) {
    const svcMatch = line.match(/^( {2})(\w[\w-]*):\s*$/);
    if (svcMatch && STRIP_SERVICES.includes(svcMatch[2])) {
      skipService = true;
      serviceIndent = svcMatch[1].length;
      continue;
    }
  } else {
    const indent = line.match(/^( *)\S/)?.[1].length ?? -1;
    if (line.trim() !== "" && indent <= serviceIndent) {
      skipService = false;
      serviceIndent = null;
    } else {
      continue;
    }
  }

  // ── Skip depends_on entries for removed services ──────────────────────────
  if (!skipDepEntry) {
    const depMatch = line.match(/^( {6,8})(\w[\w-]*):\s*$/);
    if (depMatch && STRIP_SERVICES.includes(depMatch[2])) {
      skipDepEntry = true;
      depIndent = depMatch[1].length;
      continue;
    }
  } else {
    const indent = line.match(/^( *)\S/)?.[1].length ?? -1;
    if (line.trim() !== "" && indent <= depIndent) {
      skipDepEntry = false;
      depIndent = null;
    } else {
      continue;
    }
  }

  // ── Remove GCS_EMULATOR_HOST (safety net) ────────────────────────────────
  if (/GCS_EMULATOR_HOST/.test(line)) continue;

  // ── Fix backend PORT 8000 → 8080 to match nginx.conf proxy_pass ──────────
  const portFixed = line
    .replace(/^(\s+PORT:\s+)"8000"/, '$1"8080"')
    .replace(/^(\s+- )"8000"/, '$1"8080"');

  out.push(portFixed);
}

writeFileSync(filePath, out.join("\n"));
console.log(`Done — stripped [${STRIP_SERVICES.join(", ")}], fixed PORT, removed GCS_EMULATOR_HOST.`);
