/**
 * Aetherion pack mods install into the normal mods/ folder.
 * They start enabled and can be turned off. Turning one off renames the jar
 * to .jar.disabled so Fabric ignores it, and the next launch does not put it back.
 * Other Minecraft versions do not receive this pack.
 */

const PACK_MINECRAFT = "1.21.1"

function emptyPlan(manifestVersion, fromVersion) {
  return {
    manifestVersion: manifestVersion || null,
    fromVersion: fromVersion || null,
    actions: [],
    totalBytes: 0,
    downloadCount: 0,
    removeCount: 0,
    needsForgeInstall: false,
    applyPack: false,
  }
}

function isAetherionPackVersion(minecraftVersion, packVersion = PACK_MINECRAFT) {
  return String(minecraftVersion || "") === PACK_MINECRAFT && String(packVersion || "") === PACK_MINECRAFT
}

function planForMinecraftVersion({
  minecraftVersion,
  packVersion = PACK_MINECRAFT,
  files,
  local,
  installedHashes,
  manifestVersion,
  fromVersion,
  protectedPatterns,
  isProtected,
}) {
  if (!isAetherionPackVersion(minecraftVersion, packVersion)) {
    return emptyPlan(manifestVersion, fromVersion)
  }
  const managed = planManagedFiles(files, local, installedHashes)
  const actions = [...managed.actions]
  const dropinSet = new Set((local?.dropinMods || []).map((mod) => `mods/${mod.filename}`))
  const guard = typeof isProtected === "function" ? isProtected : () => false
  for (const filePath of Object.keys(installedHashes || {})) {
    if (isKeptInstalledFile(filePath, managed.validPaths, protectedPatterns, dropinSet, guard)) continue
    actions.push({ kind: "remove", path: filePath, reason: "orphan" })
  }
  const downloads = actions.filter((action) => action.kind === "download")
  return {
    manifestVersion: manifestVersion || null,
    fromVersion: fromVersion || null,
    actions,
    totalBytes: downloads.reduce((total, action) => total + (action.size || 0), 0),
    downloadCount: downloads.length,
    removeCount: actions.filter((action) => action.kind === "remove").length,
    needsForgeInstall: false,
    applyPack: true,
  }
}

function packInstalledRelPaths(files) {
  const paths = []
  for (const file of files || []) {
    const filePath = String(file?.path || "").replace(/\\/g, "/")
    if (!filePath || filePath.includes("..")) continue
    const managed =
      filePath.startsWith("mods/") || filePath.startsWith("shaderpacks/") || filePath.startsWith("config/")
    if (!managed || filePath.startsWith("mods/dropin/")) continue
    paths.push(filePath)
    if (filePath.endsWith(".jar") || filePath.endsWith(".zip")) paths.push(`${filePath}.disabled`)
  }
  return paths
}

function planManagedFiles(files, local, installedHashes) {
  const actions = []
  const validPaths = new Set()
  const enabledOptionalMods = local?.enabledOptionalMods || {}

  for (const file of files || []) {
    if (!file?.path) continue
    validPaths.add(file.path)
    const disableable = file.path.startsWith("mods/") && file.path.endsWith(".jar")
    if (disableable) {
      const disabledPath = `${file.path}.disabled`
      validPaths.add(disabledPath)
      const enabled =
        enabledOptionalMods[file.path] !== undefined
          ? Boolean(enabledOptionalMods[file.path])
          : file.defaultEnabled !== false
      if (!enabled) {
        if (installedHashes?.[file.path]) {
          actions.push({ kind: "disable", path: file.path })
        }
        continue
      }
      if (!installedHashes?.[file.path] && installedHashes?.[disabledPath]) {
        actions.push({ kind: "enable", path: file.path })
        continue
      }
    } else if (file.type === "optional") {
      const enabled =
        enabledOptionalMods[file.path] !== undefined
          ? Boolean(enabledOptionalMods[file.path])
          : file.defaultEnabled !== false
      if (!enabled) {
        if (installedHashes?.[file.path]) {
          actions.push({ kind: "remove", path: file.path, reason: "optional-disabled" })
        }
        continue
      }
    }

    const installed = installedHashes?.[file.path]
    const expected = String(file.sha256 || "")
    if (installed && (!expected || installed.toLowerCase() === expected.toLowerCase())) {
      actions.push({ kind: "skip", path: file.path, reason: "hash-match" })
    } else {
      actions.push({
        kind: "download",
        path: file.path,
        url: file.url,
        sha256: expected,
        size: file.size || 0,
        category: file.type,
      })
    }
  }

  return { actions, validPaths }
}

function isKeptInstalledFile(filePath, validPaths, protectedPatterns, dropinSet, isProtected) {
  if (validPaths.has(filePath)) return true
  if (filePath.startsWith("forge/")) return true
  if (filePath.startsWith("mods/dropin/")) return true
  if (filePath.startsWith("shaderpacks/")) return true
  if (filePath.endsWith(".disabled")) return true
  if (dropinSet.has(filePath)) return true
  if (isProtected(filePath, protectedPatterns || [])) return true
  return false
}

module.exports = {
  PACK_MINECRAFT,
  emptyPlan,
  isAetherionPackVersion,
  planForMinecraftVersion,
  packInstalledRelPaths,
  planManagedFiles,
  isKeptInstalledFile,
}
