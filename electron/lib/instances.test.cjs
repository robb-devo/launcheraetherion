const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  directoryNameForSlug,
  normalizeRegistry,
  upsertInstance,
  removeInstance,
  selectInstance,
  serverPackRequest,
  launchChoice,
} = require("./instances.cjs")

const pack = {
  id: "modpack-example",
  kind: "modrinth",
  name: "Example Pack",
  minecraftVersion: "1.21.1",
  loader: { type: "fabric", version: "0.16.9" },
  projectId: "aabb",
  versionId: "ccdd",
  directoryName: "modpack-example",
}

test("modpack folders stay off the Aetherion and vanilla instance names", () => {
  assert.equal(directoryNameForSlug("Example Pack"), "modpack-example-pack")
  assert.equal(directoryNameForSlug("aetherion-client").startsWith("modpack-"), true)
  assert.equal(directoryNameForSlug("mc-1.21.1").startsWith("modpack-"), true)
  assert.notEqual(directoryNameForSlug("example"), "aetherion-client")
})

test("selecting a 1.21.1 pack does not join the realm or reuse the Aetherion folder", () => {
  const registry = upsertInstance({ selectedId: "aetherion", instances: [] }, pack)
  const choice = launchChoice({
    selectedId: registry.selectedId,
    minecraftVersion: "1.21.1",
    instances: registry.instances,
  })
  assert.equal(choice.kind, "modrinth")
  assert.equal(choice.autoJoinRealm, false)
  assert.equal(choice.directoryName, "modpack-example")
  assert.notEqual(choice.directoryName, "aetherion-client")
})

test("clearing the pack selection returns to the Aetherion realm instance", () => {
  const installed = upsertInstance(null, pack)
  const selected = selectInstance(installed, "aetherion")
  const choice = launchChoice({
    selectedId: selected.selectedId,
    minecraftVersion: "1.21.1",
    instances: selected.instances,
  })
  assert.equal(choice.kind, "aetherion")
  assert.equal(choice.autoJoinRealm, true)
  assert.equal(choice.directoryName, "aetherion-client")
  const vanilla = launchChoice({
    selectedId: "aetherion",
    minecraftVersion: "1.20.1",
    instances: selected.instances,
  })
  assert.equal(vanilla.kind, "vanilla")
  assert.equal(vanilla.autoJoinRealm, false)
  assert.equal(vanilla.directoryName, "mc-1.20.1")
})

test("removing a pack cannot delete the built-in instance", () => {
  const installed = upsertInstance(null, pack)
  assert.throws(() => removeInstance(installed, "aetherion-client"), /stays installed/)
  const next = removeInstance(installed, "modpack-example")
  assert.equal(next.instances.length, 0)
  assert.equal(next.selectedId, "aetherion")
})

test("a broken registry drops unknown entries instead of crashing", () => {
  const registry = normalizeRegistry({
    selectedId: "modpack-missing",
    instances: [{ kind: "modrinth", name: "Nope" }, pack, { kind: "vanilla" }],
  })
  assert.equal(registry.instances.length, 1)
  assert.equal(registry.selectedId, "aetherion")
})

test("sandbox pack sync only starts for a Modrinth version id", () => {
  assert.equal(serverPackRequest({ version: "1.21.1" }), null)
  assert.equal(serverPackRequest({ modpack: { source: "curseforge", versionId: "abc" } }), null)
  assert.deepEqual(
    serverPackRequest({
      modpack: { source: "modrinth", projectId: "aabb", versionId: "ccdd", name: "Example" },
    }),
    {
      source: "modrinth",
      projectId: "aabb",
      versionId: "ccdd",
      name: "Example",
      slug: "",
    },
  )
})
