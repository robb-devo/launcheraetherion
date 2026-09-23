const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  planManagedFiles,
  isKeptInstalledFile,
  planForMinecraftVersion,
  packInstalledRelPaths,
} = require("./managed-mods.cjs")

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

test("non-1.21.1 never receives Aetherion pack jars", () => {
  const vanilla = planForMinecraftVersion({
    minecraftVersion: "1.20.1",
    packVersion: "1.21.1",
    files,
    local: {},
    installedHashes: { "mods/sodium.jar": "deadbeef" },
    manifestVersion: "pack",
    fromVersion: null,
  })
  assert.equal(vanilla.applyPack, false)
  assert.equal(vanilla.actions.length, 0)
  assert.equal(
    vanilla.actions.some((action) => String(action.path || "").includes("sodium")),
    false,
  )

  const samePackName = planForMinecraftVersion({
    minecraftVersion: "1.21",
    packVersion: "1.21",
    files,
    local: {},
    installedHashes: {},
    manifestVersion: "pack",
    fromVersion: null,
  })
  assert.equal(samePackName.applyPack, false)
  assert.equal(samePackName.actions.length, 0)

  const pack = planForMinecraftVersion({
    minecraftVersion: "1.21.1",
    packVersion: "1.21.1",
    files,
    local: { enabledOptionalMods: {} },
    installedHashes: {},
    manifestVersion: "pack",
    fromVersion: null,
  })
  assert.equal(pack.applyPack, true)
  assert.equal(pack.actions.find((action) => action.path === "mods/sodium.jar").kind, "download")
  assert.deepEqual(packInstalledRelPaths(files), [
    "mods/sodium.jar",
    "mods/sodium.jar.disabled",
    "shaderpacks/pack.zip",
    "shaderpacks/pack.zip.disabled",
  ])
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
