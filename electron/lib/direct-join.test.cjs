const { test } = require("node:test")
const assert = require("node:assert/strict")
const { supportsQuickPlay, directJoinGameArgs, describedJoinArgs } = require("./direct-join.cjs")

test("1.21.1 realm uses quick play and does not pass the removed server flags", () => {
  const args = directJoinGameArgs({
    host: "play.donnernet.de",
    port: 25565,
    minecraftVersion: "1.21.1",
  })
  assert.deepEqual(args, ["--quickPlayMultiplayer", "play.donnernet.de:25565"])
  assert.equal(args.includes("--server"), false)
  assert.equal(args.includes("--port"), false)
})

test("releases before 1.20 keep --server and --port", () => {
  assert.equal(supportsQuickPlay("1.19.4"), false)
  assert.equal(supportsQuickPlay("1.16.5"), false)
  assert.equal(supportsQuickPlay("1.12.2"), false)
  assert.deepEqual(
    directJoinGameArgs({ host: "10.0.0.8", port: 25570, minecraftVersion: "1.16.5" }),
    ["--server", "10.0.0.8", "--port", "25570"],
  )
})

test("1.20 and newer use quick play, including a non-default port", () => {
  assert.equal(supportsQuickPlay("1.20"), true)
  assert.equal(supportsQuickPlay("1.21.8"), true)
  assert.deepEqual(
    directJoinGameArgs({ host: "sandbox.example", port: 25610, minecraftVersion: "1.21.1" }),
    ["--quickPlayMultiplayer", "sandbox.example:25610"],
  )
})

test("no host means no join arguments", () => {
  assert.deepEqual(directJoinGameArgs({ host: "  ", port: 25565, minecraftVersion: "1.21.1" }), [])
  assert.deepEqual(directJoinGameArgs({ minecraftVersion: "1.21.1" }), [])
})

test("unparsed versions stay on the legacy flags", () => {
  assert.equal(supportsQuickPlay("24w14a"), false)
  assert.deepEqual(
    directJoinGameArgs({ host: "play.example", port: 25565, minecraftVersion: "" }),
    ["--server", "play.example", "--port", "25565"],
  )
})

test("described join args pull the pair out of a longer game argument list", () => {
  assert.deepEqual(
    describedJoinArgs(["--username", "Sam", "--quickPlayMultiplayer", "play.donnernet.de:25565", "--fullscreen"]),
    ["--quickPlayMultiplayer", "play.donnernet.de:25565"],
  )
})
