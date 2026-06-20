#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const INITIAL_VERSION = "1.0.0";
const VERSION_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

export function parseVersionTag(tag) {
  const match = VERSION_TAG_PATTERN.exec(tag.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

export function compareVersions(a, b) {
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  return 0;
}

export function latestVersionTag(tags) {
  const parsed = tags.map(parseVersionTag).filter(Boolean);
  if (!parsed.length) return null;
  return parsed.sort(compareVersions).at(-1);
}

export function nextPatchVersion(latest) {
  if (!latest) return INITIAL_VERSION;
  return `${latest.major}.${latest.minor}.${latest.patch + 1}`;
}

function gitLines(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function resolveReleaseVersion() {
  const headTags = gitLines(["tag", "--points-at", "HEAD"]).map(parseVersionTag).filter(Boolean);
  if (headTags.length) {
    return headTags.sort(compareVersions).at(-1).version;
  }

  const remoteTags = gitLines(["tag", "-l", "v*.*.*"]);
  const latest = latestVersionTag(remoteTags);
  return nextPatchVersion(latest);
}

function parseArgs(argv) {
  const options = { output: undefined };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--output") {
      options.output = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { output } = parseArgs(process.argv);
  const releaseVersion = resolveReleaseVersion();
  const line = `RELEASE_VERSION=${releaseVersion}\n`;

  if (output) {
    await writeFile(output, line);
  }

  process.stdout.write(line);
}
