const { test } = require("node:test")
const assert = require("node:assert/strict")
const zlib = require("node:zlib")
const { readZip } = require("./zip-entries.cjs")
const {
  mapSearchHit,
  mrpackFile,
  planFromIndex,
  readMrpack,
  safePackPath,
  clientFileIncluded,
} = require("./modrinth.cjs")

test("zip reader returns stored and deflate entries", () => {
  const hello = Buffer.from("hello pack")
  const archive = makeZip([
    { name: "modrinth.index.json", data: hello, method: 0 },
    { name: "overrides/config/test.txt", data: Buffer.from("iris"), method: 8 },
  ])
  const entries = readZip(archive)
  assert.equal(entries[0].data.toString(), "hello pack")
  assert.equal(entries[1].data.toString(), "iris")
})

test("pack paths reject traversal", () => {
  assert.equal(safePackPath("mods/foo.jar"), "mods/foo.jar")
  assert.equal(safePackPath("../secrets.txt"), null)
  assert.equal(safePackPath("mods/../../outside.jar"), null)
  assert.equal(safePackPath("/etc/passwd"), "etc/passwd")
})

test("client files are kept and server-only files are skipped", () => {
  assert.equal(clientFileIncluded({ path: "mods/a.jar" }), true)
  assert.equal(clientFileIncluded({ env: { client: "required", server: "required" } }), true)
  assert.equal(clientFileIncluded({ env: { client: "optional", server: "unsupported" } }), true)
  assert.equal(clientFileIncluded({ env: { client: "unsupported", server: "required" } }), false)
})

test("index plan keeps the pack out of the Aetherion instance", () => {
  const plan = planFromIndex(
    {
      game: "minecraft",
      name: "Example Pack",
      dependencies: { minecraft: "1.21.1", "fabric-loader": "0.16.9" },
      files: [
        {
          path: "mods/example.jar",
          hashes: { sha1: "a".repeat(40) },
          downloads: ["https://cdn.modrinth.com/data/example.jar"],
          env: { client: "required", server: "required" },
        },
        {
          path: "mods/server-only.jar",
          hashes: { sha1: "b".repeat(40) },
          downloads: ["https://cdn.modrinth.com/data/server.jar"],
          env: { client: "unsupported", server: "required" },
        },
      ],
    },
    { projectId: "aabbccdd", versionId: "11223344", slug: "example-pack", title: "Example Pack" },
  )
  assert.equal(plan.instance.directoryName, "modpack-example-pack")
  assert.equal(plan.instance.directoryName === "aetherion-client", false)
  assert.equal(plan.instance.loader.type, "fabric")
  assert.equal(plan.instance.loader.version, "0.16.9")
  assert.equal(plan.instance.minecraftVersion, "1.21.1")
  assert.deepEqual(
    plan.files.map((file) => file.path),
    ["mods/example.jar"],
  )
})

test("mrpack overrides are copied and traversal entries are dropped", () => {
  const index = {
    formatVersion: 1,
    game: "minecraft",
    name: "Example",
    dependencies: { minecraft: "1.20.1" },
    files: [],
  }
  const archive = makeZip([
    { name: "modrinth.index.json", data: Buffer.from(JSON.stringify(index)), method: 0 },
    { name: "overrides/config/hello.txt", data: Buffer.from("ok"), method: 0 },
    { name: "overrides/../../outside.txt", data: Buffer.from("no"), method: 0 },
    { name: "client-overrides/options.txt", data: Buffer.from("lang:en"), method: 0 },
  ])
  const parsed = readMrpack(archive, { slug: "example", versionId: "abc", title: "Example" })
  assert.equal(parsed.instance.loader.type, "vanilla")
  assert.deepEqual(
    parsed.overrides.map((entry) => [entry.path, entry.data.toString()]),
    [
      ["config/hello.txt", "ok"],
      ["options.txt", "lang:en"],
    ],
  )
})

test("search hits and mrpack files map the public Modrinth shape", () => {
  const hit = mapSearchHit({
    project_id: "aabb",
    slug: "example-pack",
    title: "Example",
    description: "A pack",
    icon_url: "https://cdn.modrinth.com/icon.png",
    downloads: 12,
    versions: ["1.21.1"],
    display_categories: ["fabric", "adventure"],
  })
  assert.equal(hit.slug, "example-pack")
  assert.deepEqual(hit.loaders, ["fabric"])
  assert.deepEqual(
    mrpackFile({
      files: [
        { filename: "readme.md", url: "https://cdn.modrinth.com/readme.md", primary: true },
        { filename: "pack.mrpack", url: "https://cdn.modrinth.com/pack.mrpack", primary: false },
      ],
    }),
    { url: "https://cdn.modrinth.com/pack.mrpack", filename: "pack.mrpack" },
  )
})

function makeZip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name)
    const stored = file.method === 8 ? zlib.deflateRawSync(file.data) : file.data
    const crc = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(file.method, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(stored.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    const localBuf = Buffer.concat([local, name, stored])
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(file.method, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(stored.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([central, name]))
    locals.push(localBuf)
    offset += localBuf.length
  }
  const directory = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(directory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, eocd])
}

function crc32(buffer) {
  if (typeof zlib.crc32 === "function") {
    const value = zlib.crc32(buffer)
    return typeof value === "number" ? value >>> 0 : Number(value)
  }
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
