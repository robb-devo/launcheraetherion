/**
 * The client pack is the lean Fabric manifest from aetherion-control.
 * Forge installer fields are not part of this pack.
 */

const PACK_MINECRAFT = "1.21.1"

function normalizePackManifest(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid manifest.")
  }

  const loader = raw.loader
  if (loader?.type === "fabric") {
    const mods = Array.isArray(raw.mods) ? raw.mods : []
    const shaderpacks = Array.isArray(raw.shaderpacks) ? raw.shaderpacks : []
    const files = [
      ...mods.map((mod) => fileFromPackEntry(mod, "mods", "required")),
      ...shaderpacks.map((shader) => fileFromPackEntry(shader, "shaderpacks", "shaderpack")),
    ]
    const javaMajor = Number(raw.java?.major) || 21
    return {
      version: String(raw.version || ""),
      minecraft: String(raw.minecraft || ""),
      name: raw.name || "AETHERION",
      instanceId: raw.instanceId || raw.id || "aetherion-client",
      loader: { type: "fabric", version: String(loader.version || "") },
      server: {
        name: raw.server?.name || "AETHERION",
        address: raw.server?.address || "play.donnernet.de",
        port: Number(raw.server?.port) || 25565,
      },
      java: {
        recommendedMajor: javaMajor,
        minMajor: javaMajor,
      },
      files,
      shaderpacks,
      protectedPatterns: ["mods/dropin/*"],
    }
  }

  return raw
}

function fileFromPackEntry(entry, folder, type) {
  const filename = String(entry?.filename || "").trim()
  const presetMod = folder === "mods"
  return {
    path: `${folder}/${filename}`,
    url: String(entry?.url || ""),
    sha256: "",
    size: 0,
    type: presetMod ? "optional" : type,
    id: entry?.slug || filename,
    name: entry?.slug || filename,
    version: filename,
    defaultEnabled: presetMod ? true : undefined,
  }
}

function fabricProfileId(manifest) {
  const version = manifest?.loader?.version
  if (manifest?.loader?.type !== "fabric" || !version || !manifest.minecraft) {
    throw new Error("This launcher only starts the Fabric pack.")
  }
  return `fabric-loader-${version}-${manifest.minecraft}`
}

function packServer(manifest) {
  return {
    name: manifest?.server?.name || "AETHERION",
    host: manifest?.server?.address || "play.donnernet.de",
    port: Number(manifest?.server?.port) || 25565,
  }
}

function assertClientPack(manifest) {
  if (manifest?.minecraft !== PACK_MINECRAFT) {
    throw new Error("This launcher installs Minecraft 1.21.1 only.")
  }
  if (manifest?.loader?.type !== "fabric" || !manifest.loader.version) {
    throw new Error("This launcher installs the Fabric pack only.")
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("Invalid manifest: the Fabric pack has no files.")
  }
  for (const file of manifest.files) {
    if (!file.path || !file.url) {
      throw new Error(`Invalid manifest: file '${file.path || "(no path)"}' is incomplete.`)
    }
  }
}

module.exports = {
  PACK_MINECRAFT,
  normalizePackManifest,
  fabricProfileId,
  packServer,
  assertClientPack,
}
