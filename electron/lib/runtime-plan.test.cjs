const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const {
  collectLibraries,
  javaMajorForMinecraft,
  loggingConfigArtifact,
  preferredNativeClassifier,
} = require("./runtime-plan.cjs")

const windows = { os: "windows", arch: "x64" }

test("Windows x64 keeps the 64-bit LWJGL native jar on the classpath", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aetherion-runtime-"))
  const plan = collectLibraries(
    root,
    [
      {
        name: "org.lwjgl:lwjgl:3.3.3:natives-windows",
        downloads: {
          artifact: {
            path: "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar",
            url: "https://libraries.minecraft.net/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar",
            sha1: "abc",
            size: 10,
          },
        },
      },
      {
        name: "org.lwjgl:lwjgl:3.3.3:natives-windows-x86",
        downloads: {
          artifact: {
            path: "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-x86.jar",
            url: "https://libraries.minecraft.net/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-x86.jar",
            sha1: "def",
            size: 10,
          },
        },
      },
      {
        name: "org.lwjgl:lwjgl:3.3.3",
        downloads: {
          artifact: {
            path: "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar",
            url: "https://libraries.minecraft.net/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar",
            sha1: "aaa",
            size: 10,
          },
        },
      },
    ],
    windows,
  )

  assert.equal(preferredNativeClassifier(windows), "natives-windows")
  assert.deepEqual(
    plan.classpath.map((file) => path.basename(file)),
    ["lwjgl-3.3.3-natives-windows.jar", "lwjgl-3.3.3.jar"],
  )
  assert.deepEqual(plan.nativeArtifacts, [])
  assert.deepEqual(plan.missing, [
    "libraries/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar",
    "libraries/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar",
  ])
  assert.equal(plan.missing.some((file) => file.includes("x86")), false)
})

test("legacy natives stay extract-only and the main jar stays on the classpath", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aetherion-legacy-"))
  const plan = collectLibraries(
    root,
    [
      {
        name: "org.lwjgl.lwjgl:lwjgl-platform:2.9.4-nightly-20150209",
        natives: { windows: "natives-windows" },
        downloads: {
          artifact: {
            path: "org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209.jar",
            url: "https://libraries.minecraft.net/lwjgl-platform.jar",
            sha1: "111",
            size: 4,
          },
          classifiers: {
            "natives-windows": {
              path: "org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-windows.jar",
              url: "https://libraries.minecraft.net/lwjgl-natives.jar",
              sha1: "222",
              size: 4,
            },
          },
        },
      },
    ],
    windows,
  )
  assert.equal(plan.classpath.length, 1)
  assert.equal(path.basename(plan.classpath[0]).includes("natives"), false)
  assert.equal(plan.nativeArtifacts.length, 1)
  assert.match(plan.nativeArtifacts[0].relativePath, /natives-windows\.jar$/)
})

test("log4j config is a cached runtime file and Java follows the Minecraft version", () => {
  const artifact = loggingConfigArtifact("/instance", {
    logging: {
      client: {
        file: {
          id: "client-1.12.xml",
          sha1: "BD65E7D2E3C237BE76CFBEF4C2405033D7F91521",
          size: 888,
          url: "https://piston-data.mojang.com/v1/objects/bd65e7d2e3c237be76cfbef4c2405033d7f91521/client-1.12.xml",
        },
      },
    },
  })
  assert.equal(artifact.relativePath, "assets/log_configs/client-1.12.xml")
  assert.equal(artifact.sha1, "bd65e7d2e3c237be76cfbef4c2405033d7f91521")
  assert.equal(javaMajorForMinecraft("1.21.1"), 21)
  assert.equal(javaMajorForMinecraft("1.20.4"), 17)
  assert.equal(javaMajorForMinecraft("1.16.5"), 8)
})
