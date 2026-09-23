const { test } = require("node:test")
const assert = require("node:assert/strict")
const { planManagedFiles, isKeptInstalledFile } = require("./managed-mods.cjs")

const files = [
  {
    path: "mods/sodium.jar",
    url: "https://example.invalid/sodium.jar",
    sha256: "",
    size: 0,
    type: "required",
  },
  {
    path: "shaderpacks/pack.zip",
    url: "https://example.invalid/pack.zip",
    sha256: "abc",
    size: 10,
    type: "shaderpack",
  },
]

test("pack mods install enabled and can be turned off without a re-download", () => {
  const first = planManagedFiles(files, { enabledOptionalMods: {} }, {})
  assert.equal(first.actions.find((action) => action.path === "mods/sodium.jar").kind, "download")

  const cached = planManagedFiles(
    files,
    { enabledOptionalMods: {} },
    { "mods/sodium.jar": "deadbeef" },
  )
  assert.equal(cached.actions.find((action) => action.path === "mods/sodium.jar").kind, "skip")

  const disabled = planManagedFiles(
    files,
    { enabledOptionalMods: { "mods/sodium.jar": false } },
    { "mods/sodium.jar": "deadbeef" },
  )
  assert.deepEqual(
    disabled.actions.find((action) => action.path === "mods/sodium.jar"),
    { kind: "disable", path: "mods/sodium.jar" },
  )
  assert.equal(
    disabled.actions.some((action) => action.kind === "download" && action.path === "mods/sodium.jar"),
    false,
  )

  const restore = planManagedFiles(
    files,
    { enabledOptionalMods: { "mods/sodium.jar": true } },
    { "mods/sodium.jar.disabled": "deadbeef" },
  )
  assert.equal(restore.actions.find((action) => action.path === "mods/sodium.jar").kind, "enable")
})

test("a disabled pack jar is not treated as an orphan", () => {
  const { validPaths } = planManagedFiles(files, { enabledOptionalMods: {} }, {})
  assert.equal(
    isKeptInstalledFile("mods/sodium.jar.disabled", validPaths, [], new Set(), () => false),
    true,
  )
  assert.equal(
    isKeptInstalledFile("mods/custom.jar", validPaths, [], new Set(), () => false),
    false,
  )
})
