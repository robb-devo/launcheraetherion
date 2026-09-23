/**
 * Minecraft runtime files for Play.
 *
 * Minecraft 1.19+ ships LWJGL natives as normal classpath jars
 * (`*-natives-windows.jar`). They must stay on `-cp`. Extracting every
 * Windows native jar into one folder lets the 32-bit lwjgl.dll replace the
 * 64-bit one, and the game then fails looking for that library.
 */

const path = require("node:path")

const MINECRAFT_RESOURCES_BASE = "https://resources.download.minecraft.net"

function currentPlatform() {
  return {
    os: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux",
    arch: process.arch,
  }
}

function preferredNativeClassifier(platform = currentPlatform()) {
  const arch = platform.arch
  if (platform.os === "windows") {
    if (arch === "arm64") return "natives-windows-arm64"
    if (arch === "ia32" || arch === "x86") return "natives-windows-x86"
    return "natives-windows"
  }
  if (platform.os === "osx") {
    return arch === "arm64" ? "natives-macos-arm64" : "natives-macos"
  }
  if (arch === "arm64") return "natives-linux-arm64"
  if (arch === "ia32" || arch === "x86") return "natives-linux-arm32"
  return "natives-linux"
}

function javaMajorForMinecraft(version) {
  if (compareMinecraft(version, "1.20.5") >= 0) return 21
  if (compareMinecraft(version, "1.17") >= 0) return 17
  return 8
}

function compareMinecraft(left, right) {
  const a = minecraftReleaseParts(left)
  const b = minecraftReleaseParts(right)
  if (!a || !b) return 0
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function minecraftReleaseParts(version) {
  const match = String(version || "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : 0]
}

function collectLibraries(root, libraries, platform = currentPlatform()) {
  const artifacts = []
  const classpath = []
  const nativeArtifacts = []
  const missing = []
  const missingNatives = []
  const wantedNative = preferredNativeClassifier(platform)

  for (const library of libraries || []) {
    if (!isAllowedByRules(library.rules, platform)) continue

    const artifact = libraryArtifactFromDownload(root, library, library.downloads?.artifact)
    if (artifact) {
      const classifier = mavenNativeClassifier(library, artifact.relativePath)
      if (classifier) {
        if (classifier === wantedNative) {
          artifacts.push(artifact)
          classpath.push(artifact.path)
          if (!exists(artifact.path)) missing.push(artifact.relativePath)
        }
      } else {
        artifacts.push(artifact)
        classpath.push(artifact.path)
        if (!exists(artifact.path)) missing.push(artifact.relativePath)
      }
    }

    const legacyClassifier = legacyNativeClassifier(library, platform)
    const legacyDownload = legacyClassifier ? library.downloads?.classifiers?.[legacyClassifier] : null
    if (legacyDownload) {
      const nativeArtifact = libraryArtifactFromDownload(root, library, legacyDownload)
      if (nativeArtifact) {
        nativeArtifacts.push({
          ...nativeArtifact,
          exclude: library.extract?.exclude || [],
        })
        if (!exists(nativeArtifact.path)) missingNatives.push(nativeArtifact.relativePath)
      }
    }
  }

  return { artifacts, classpath, nativeArtifacts, missing, missingNatives }
}

function loggingConfigArtifact(root, versionJson) {
  const file = versionJson?.logging?.client?.file
  const url = String(file?.url || "").trim()
  const id = String(file?.id || "").trim()
  if (!url || !id || id.includes("/") || id.includes("\\")) return null
  const relativePath = `assets/log_configs/${id}`
  return {
    path: path.join(root, "assets", "log_configs", id),
    relativePath,
    url,
    sha1: String(file.sha1 || "").trim().toLowerCase() || null,
    size: Number(file.size) || 0,
    label: id,
  }
}

function libraryArtifactFromDownload(root, library, download) {
  const artifactPath = download?.path || mavenPathFromName(library?.name)
  if (!artifactPath) return null
  const explicitUrl = String(download?.url || "").trim()
  const absolute = path.join(root, "libraries", ...String(artifactPath).split("/"))
  return {
    path: absolute,
    relativePath: toPosix(path.relative(root, absolute)),
    url: explicitUrl || libraryUrlFor(library, artifactPath),
    sha1: String(download?.sha1 || library?.sha1 || "").trim().toLowerCase() || null,
    size: Number(download?.size || library?.size) || 0,
    label: library?.name || artifactPath,
  }
}

function mavenNativeClassifier(library, artifactPath) {
  const parts = String(library?.name || "").split(":")
  const named = parts[3] ? parts[3].replace(/^@/, "") : ""
  if (named.startsWith("natives-")) return named
  const base = String(artifactPath || "").split("/").pop() || ""
  const match = base.match(/-(natives-[a-z0-9-]+)\.jar$/i)
  return match ? match[1].toLowerCase() : null
}

function legacyNativeClassifier(library, platform) {
  const classifier = library?.natives?.[platform.os]
  if (!classifier) return null
  const arch = platform.arch === "x64" || platform.arch === "arm64" ? "64" : "32"
  return String(classifier).replace("${arch}", arch)
}

function libraryUrlFor(library, artifactPath) {
  const base = library?.url || "https://libraries.minecraft.net/"
  return `${String(base).replace(/\/?$/, "/")}${artifactPath}`
}

function mavenPathFromName(name) {
  if (!name || typeof name !== "string") return null
  const [group, artifact, version, classifierPart] = name.split(":")
  if (!group || !artifact || !version) return null
  const classifier = classifierPart ? `-${classifierPart.replace(/^@/, "")}` : ""
  const extension = classifierPart?.startsWith("@") ? classifierPart.slice(1) : "jar"
  return `${group.replace(/\./g, "/")}/${artifact}/${version}/${artifact}-${version}${classifier}.${extension}`
}

function isAllowedByRules(rules, platform) {
  if (!Array.isArray(rules) || rules.length === 0) return true
  let allowed = false
  for (const rule of rules) {
    if (!ruleMatches(rule, platform)) continue
    allowed = rule.action === "allow"
  }
  return allowed
}

function ruleMatches(rule, platform) {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== platform.os) return false
    if (rule.os.arch && !archMatches(rule.os.arch, platform.arch)) return false
  }
  return true
}

function archMatches(ruleArch, processArch) {
  const rule = String(ruleArch || "").toLowerCase()
  const current = String(processArch || "").toLowerCase()
  if (rule === current) return true
  if ((rule === "x64" || rule === "amd64") && current === "x64") return true
  if ((rule === "x86" || rule === "ia32") && (current === "ia32" || current === "x86")) return true
  if (rule === "arm64" && current === "arm64") return true
  return false
}

function exists(filePath) {
  return require("node:fs").existsSync(filePath)
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/")
}

function assetObjectUrl(hash) {
  const shard = String(hash || "").slice(0, 2)
  return `${MINECRAFT_RESOURCES_BASE}/${shard}/${hash}`
}

module.exports = {
  currentPlatform,
  preferredNativeClassifier,
  javaMajorForMinecraft,
  collectLibraries,
  loggingConfigArtifact,
  libraryArtifactFromDownload,
  mavenNativeClassifier,
  assetObjectUrl,
}
