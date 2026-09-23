const { test } = require("node:test")
const assert = require("node:assert/strict")
const pkg = require("../../package.json")

test("GitHub Releases are the update feed", () => {
  assert.equal(pkg.dependencies["electron-updater"], "6.6.2")
  assert.equal(pkg.build.publish.provider, "github")
  assert.equal(pkg.build.publish.owner, "robb-devo")
  assert.equal(pkg.build.publish.repo, "launcheraetherion")
  assert.ok(pkg.build.files.includes("node_modules/electron-updater/**/*"))
  assert.ok(pkg.build.files.includes("node_modules/builder-util-runtime/**/*"))
})
