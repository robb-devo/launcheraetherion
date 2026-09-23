/**
 * Installed Modrinth instances live beside the Aetherion client.
 * They never reuse aetherion-client or the vanilla mc-<version> folders.
 */

const AETHERION_SELECTION = "aetherion"
const LOADERS = new Set(["fabric", "forge", "neoforge", "quilt", "vanilla"])

function sanitizeVersion(value) {
  const version = String(value || "").trim()
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(version)) return ""
  return version
}

function directoryNameForSlug(slug) {
  const clean = String(slug || "pack")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const name = `modpack-${clean || "pack"}`
  if (name === "aetherion-client" || name.startsWith("mc-")) {
    throw new Error("Refusing to reuse a built-in instance folder.")
  }
  return name
}

function isModpackId(id) {
  return typeof id === "string" && id.startsWith("modpack-") && id !== "aetherion-client"
}

function normalizeInstance(raw) {
  if (!raw || raw.kind !== "modrinth") return null
  const id = directoryNameForSlug(String(raw.id || "").replace(/^modpack-/, "") || raw.slug || raw.name)
  if (!isModpackId(id)) return null
  const loaderType = LOADERS.has(raw.loader?.type) ? raw.loader.type : "vanilla"
  const minecraftVersion = sanitizeVersion(raw.minecraftVersion)
  if (!minecraftVersion) return null
  return {
    id,
    kind: "modrinth",
    name: String(raw.name || id).trim().slice(0, 80) || id,
    minecraftVersion,
    loader: {
      type: loaderType,
      version: String(raw.loader?.version || "").trim().slice(0, 32),
    },
    projectId: String(raw.projectId || "").trim(),
    versionId: String(raw.versionId || "").trim(),
    directoryName: id,
  }
}

function normalizeRegistry(raw) {
  const instances = []
  const seen = new Set()
  for (const entry of Array.isArray(raw?.instances) ? raw.instances : []) {
    const instance = normalizeInstance(entry)
    if (!instance || seen.has(instance.id)) continue
    seen.add(instance.id)
    instances.push(instance)
  }
  const requested = String(raw?.selectedId || AETHERION_SELECTION)
  const selectedId = instances.some((instance) => instance.id === requested) ? requested : AETHERION_SELECTION
  return { selectedId, instances }
}

function upsertInstance(registry, instance, options = {}) {
  const next = normalizeInstance(instance)
  if (!next) throw new Error("That pack could not be saved.")
  const current = normalizeRegistry(registry)
  const select = options.select !== false
  return normalizeRegistry({
    selectedId: select ? next.id : current.selectedId,
    instances: [...current.instances.filter((item) => item.id !== next.id), next],
  })
}

function removeInstance(registry, id) {
  if (!isModpackId(id)) throw new Error("The Aetherion instance stays installed.")
  const current = normalizeRegistry(registry)
  if (!current.instances.some((instance) => instance.id === id)) {
    throw new Error("That pack is not installed.")
  }
  return normalizeRegistry({
    selectedId: current.selectedId === id ? AETHERION_SELECTION : current.selectedId,
    instances: current.instances.filter((instance) => instance.id !== id),
  })
}

function selectInstance(registry, id) {
  const current = normalizeRegistry(registry)
  if (!id || id === AETHERION_SELECTION) {
    return { ...current, selectedId: AETHERION_SELECTION }
  }
  if (!current.instances.some((instance) => instance.id === id)) {
    throw new Error("That pack is not installed.")
  }
  return { ...current, selectedId: id }
}

function findInstance(registry, id) {
  return normalizeRegistry(registry).instances.find((instance) => instance.id === id) || null
}

/**
 * Optional fields on a Control sandbox. Absent means "do not sync a pack".
 * { modpack: { source: "modrinth", projectId, versionId, name } }
 */
function serverPackRequest(server) {
  const pack = server?.modpack
  if (!pack || typeof pack !== "object") return null
  if (pack.source && pack.source !== "modrinth") return null
  const versionId = String(pack.versionId || "").trim()
  if (!/^[A-Za-z0-9]{1,32}$/.test(versionId)) return null
  const projectId = String(pack.projectId || "").trim()
  return {
    source: "modrinth",
    projectId: /^[A-Za-z0-9]{0,32}$/.test(projectId) ? projectId : "",
    versionId,
    name: String(pack.name || "").trim().slice(0, 80),
    slug: String(pack.slug || "").trim().slice(0, 64),
  }
}

function launchChoice({ selectedId, minecraftVersion, instances, packVersion = "1.21.1" }) {
  const registry = normalizeRegistry({ selectedId, instances })
  const selected = findInstance(registry, registry.selectedId)
  if (selected) {
    return {
      kind: "modrinth",
      instanceId: selected.id,
      minecraftVersion: selected.minecraftVersion,
      autoJoinRealm: false,
      directoryName: selected.directoryName,
    }
  }
  const version = sanitizeVersion(minecraftVersion) || packVersion
  const aetherion = version === packVersion
  return {
    kind: aetherion ? "aetherion" : "vanilla",
    instanceId: aetherion ? "aetherion-client" : `mc-${version}`,
    minecraftVersion: version,
    autoJoinRealm: aetherion,
    directoryName: aetherion ? "aetherion-client" : `mc-${version}`,
  }
}

module.exports = {
  AETHERION_SELECTION,
  directoryNameForSlug,
  isModpackId,
  normalizeInstance,
  normalizeRegistry,
  upsertInstance,
  removeInstance,
  selectInstance,
  findInstance,
  serverPackRequest,
  launchChoice,
}
