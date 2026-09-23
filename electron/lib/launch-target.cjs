/**
 * 1.21.1 stays on the existing instance directory.
 * Any other Minecraft version gets a sibling folder so the pack, saves, and
 * mods are not mixed into that default path.
 */

const path = require("node:path")

const PACK_MINECRAFT = "1.21.1"

function sanitizeVersion(value) {
  const version = String(value || "").trim()
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(version)) return ""
  return version
}

function resolveLaunchTarget({
  requestedVersion,
  packVersion = PACK_MINECRAFT,
  gameDirectory,
  packInstanceId = "aetherion-client",
  instancesRoot,
}) {
  const version = sanitizeVersion(requestedVersion) || packVersion
  const usePack = version === packVersion
  const packRoot =
    gameDirectory ||
    path.join(instancesRoot || "", sanitizeSegment(packInstanceId || "aetherion-client"))
  const root = usePack
    ? packRoot
    : path.join(path.dirname(packRoot), `mc-${sanitizeSegment(version)}`)
  return {
    version,
    usePack,
    packVersion,
    root,
    packRoot,
    autoJoinRealm: usePack,
  }
}

function sanitizeSegment(value) {
  return String(value || "default").replace(/[^a-zA-Z0-9_.-]/g, "_")
}

const FALLBACK_VERSIONS = [
  "1.21.1",
  "1.21.8",
  "1.21.4",
  "1.21",
  "1.20.6",
  "1.20.4",
  "1.20.1",
  "1.19.4",
  "1.19.2",
  "1.18.2",
  "1.16.5",
  "1.12.2",
]

function versionChoices(releaseIds, packVersion = PACK_MINECRAFT) {
  const releases = Array.isArray(releaseIds) ? releaseIds.filter((id) => sanitizeVersion(id)) : []
  const ids = []
  const seen = new Set()
  for (const id of [packVersion, ...releases, ...FALLBACK_VERSIONS]) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids.map((id) => ({
    id,
    label: id === packVersion ? `${id} · Aetherion` : id,
    pack: id === packVersion,
  }))
}

module.exports = {
  PACK_MINECRAFT,
  FALLBACK_VERSIONS,
  sanitizeVersion,
  resolveLaunchTarget,
  versionChoices,
}
