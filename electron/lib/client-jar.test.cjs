const { test } = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { clientJarArtifact, clientJarRelative } = require("./client-jar.cjs")

test("vanilla client jar comes from the Mojang version JSON", () => {
  const artifact = clientJarArtifact("/instances/aetherion-client", "1.21.1", {
    downloads: {
      client: {
        url: "https://piston-data.mojang.com/v1/objects/abc/client.jar",
        sha1: "ABCDEF",
        size: 42,
      },
    },
  })
  assert.equal(artifact.relativePath, "versions/1.21.1/1.21.1.jar")
  assert.equal(artifact.relativePath, clientJarRelative("1.21.1"))
  assert.equal(artifact.path, path.join("/instances/aetherion-client", "versions", "1.21.1", "1.21.1.jar"))
  assert.equal(artifact.sha1, "abcdef")
  assert.equal(artifact.size, 42)
  assert.equal(artifact.url, "https://piston-data.mojang.com/v1/objects/abc/client.jar")
})

test("a version JSON without a client jar is not ready", () => {
  assert.throws(() => clientJarArtifact("/tmp", "1.21.1", {}), /vanilla client jar/)
})
