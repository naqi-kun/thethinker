import assert from "node:assert/strict";
import test from "node:test";

import {
  compareVersions,
  latestVersionTag,
  nextPatchVersion,
  parseVersionTag,
} from "./bump-version.mjs";

test("parseVersionTag accepts semver release tags only", () => {
  assert.deepEqual(parseVersionTag("v1.0.0"), {
    major: 1,
    minor: 0,
    patch: 0,
    version: "1.0.0",
  });
  assert.equal(parseVersionTag("deploy-test-20260619"), null);
  assert.equal(parseVersionTag("v1.0"), null);
});

test("latestVersionTag ignores non-semver tags", () => {
  const latest = latestVersionTag(["deploy-test-20260619", "v1.0.0", "v1.0.2", "v1.0.1"]);
  assert.equal(latest.version, "1.0.2");
});

test("nextPatchVersion starts at 1.0.0 and increments patch", () => {
  assert.equal(nextPatchVersion(null), "1.0.0");
  assert.equal(nextPatchVersion(parseVersionTag("v1.0.0")), "1.0.1");
  assert.equal(nextPatchVersion(parseVersionTag("v2.3.9")), "2.3.10");
});

test("compareVersions sorts semver tags", () => {
  const tags = ["v1.0.10", "v1.0.2", "v2.0.0"].map(parseVersionTag);
  assert.equal(tags.sort(compareVersions).at(-1).version, "2.0.0");
});
