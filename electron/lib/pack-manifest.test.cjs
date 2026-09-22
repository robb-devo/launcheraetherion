const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  normalizePackManifest,
  fabricProfileId,
  packServer,
  assertClientPack,
} = require("./pack-manifest.cjs")
const pack = require("../../public/manifest.json")

test("the bundled pack is Minecraft 1.21.1 Fabric", () => {
  const manifest = normalizePackManifest(pack)
  assertClientPack(manifest)
  assert.equal(manifest.minecraft, "1.21.1")
  assert.equal(manifest.loader.version, "0.19.5")
  assert.equal(fabricProfileId(manifest), "fabric-loader-0.19.5-1.21.1")
  assert.deepEqual(packServer(manifest), {
    name: "AETHERION",
    host: "play.donnernet.de",
    port: 25565,
  })
  assert.equal(manifest.java.minMajor, 21)
  const slugs = manifest.files.filter((file) => file.type === "required").map((file) => file.id)
  assert.deepEqual(slugs, [
    "fabric-api",
    "sodium",
    "iris",
    "scalablelux",
    "lithium",
    "entityculling",
    "immediatelyfast",
    "ferrite-core",
    "modmenu",
    "cloth-config",
    "xaeros-minimap",
    "cit-resewn",
    "iceberg",
    "prism-lib",
    "legendary-tooltips",
  ])
  assert.equal(manifest.shaderpacks[0].filename, "ComplementaryReimagined_r5.9.3.zip")
  assert.equal(manifest.files.some((file) => file.path.startsWith("forge/")), false)
  assert.equal(JSON.stringify(pack).includes("1.19.2"), false)
})
