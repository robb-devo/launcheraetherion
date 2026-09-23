const { test } = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { resolveLaunchTarget, versionChoices } = require("./launch-target.cjs")

test("1.21.1 keeps the default instance and other versions get a sibling folder", () => {
  const gameDirectory = path.join("/data", "instances", "aetherion-client")
  const pack = resolveLaunchTarget({
    requestedVersion: "1.21.1",
    gameDirectory,
  })
  const older = resolveLaunchTarget({
    requestedVersion: "1.20.1",
    gameDirectory,
  })
  assert.equal(pack.usePack, true)
  assert.equal(pack.root, gameDirectory)
  assert.equal(pack.autoJoinRealm, true)
  assert.equal(older.usePack, false)
  assert.equal(older.autoJoinRealm, false)
  assert.equal(older.root, path.join("/data", "instances", "mc-1.20.1"))
  assert.notEqual(older.root, pack.root)
})

test("version choices keep the Aetherion pack first", () => {
  const choices = versionChoices(["1.21.8", "1.21.1", "1.20.1"])
  assert.equal(choices[0].id, "1.21.1")
  assert.equal(choices[0].pack, true)
  assert.match(choices[0].label, /Aetherion/)
  assert.equal(choices.filter((item) => item.id === "1.21.1").length, 1)
})
