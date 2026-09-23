/**
 * Modrinth client for browsing and reading .mrpack indexes.
 * Server-only files are skipped. Client files are downloaded later by install.
 */

const { readZip } = require("./zip-entries.cjs")
const { directoryNameForSlug } = require("./instances.cjs")

const API_BASE = "https://api.modrinth.com/v2"
const LOADERS = ["fabric", "forge", "neoforge", "quilt"]

function userAgent(version) {
  return `AetherionLauncher/${version || "0.4.0"} (github.com/robb-devo/launcheraetherion)`
}

function mapSearchHit(hit) {
  if (!hit || typeof hit !== "object") return null
  const projectId = String(hit.project_id || hit.projectId || "").trim()
  const slug = String(hit.slug || "").trim()
  if (!projectId && !slug) return null
  const categories = Array.isArray(hit.display_categories) ? hit.display_categories : []
  const loaders = Array.isArray(hit.loaders) ? hit.loaders : categories.filter((item) => LOADERS.includes(item))
  return {
    projectId,
    slug,
    title: String(hit.title || slug || projectId),
    description: String(hit.description || "").slice(0, 240),
    iconUrl: typeof hit.icon_url === "string" ? hit.icon_url : "",
    downloads: Number(hit.downloads) || 0,
    minecraftVersions: Array.isArray(hit.versions) ? hit.versions.map(String).slice(0, 8) : [],
    loaders: loaders.map(String),
  }
}

function mapVersion(version) {
  if (!version || typeof version !== "object") return null
  const id = String(version.id || "").trim()
  if (!/^[A-Za-z0-9]{1,32}$/.test(id)) return null
  return {
    id,
    projectId: String(version.project_id || "").trim(),
    name: String(version.name || version.version_number || id),
    versionNumber: String(version.version_number || ""),
    gameVersions: Array.isArray(version.game_versions) ? version.game_versions.map(String) : [],
    loaders: Array.isArray(version.loaders) ? version.loaders.map(String) : [],
    datePublished: String(version.date_published || ""),
  }
}

function mrpackFile(version) {
  const files = Array.isArray(version?.files) ? version.files : []
  const packs = files.filter((file) => String(file?.filename || "").toLowerCase().endsWith(".mrpack") && file.url)
  const primary = packs.find((file) => file.primary) || packs[0]
  if (!primary) return null
  const url = String(primary.url)
  if (!/^https:\/\//i.test(url)) return null
  return { url, filename: String(primary.filename) }
}

function safePackPath(relative) {
  const normalized = String(relative || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
  if (!normalized || normalized.includes("\0")) return null
  const parts = normalized.split("/")
  if (parts.some((part) => !part || part === "." || part === "..")) return null
  return parts.join("/")
}

function clientFileIncluded(file) {
  const client = file?.env?.client
  if (client === "unsupported") return false
  return true
}

function planFromIndex(index, { projectId, versionId, slug, title } = {}) {
  if (!index || index.game !== "minecraft" || !index.dependencies?.minecraft) {
    throw new Error("This pack does not say which Minecraft version it uses.")
  }
  const dependencies = index.dependencies
  const loader = loaderFromDependencies(dependencies)
  const files = []
  for (const file of Array.isArray(index.files) ? index.files : []) {
    if (!clientFileIncluded(file)) continue
    const relative = safePackPath(file.path)
    const url = Array.isArray(file.downloads) ? file.downloads.find((item) => /^https:\/\//i.test(String(item || ""))) : ""
    const sha1 = String(file.hashes?.sha1 || "").trim().toLowerCase()
    if (!relative || !url || !/^[a-f0-9]{40}$/.test(sha1)) {
      throw new Error(`Pack file '${file.path || "(missing)"}' is incomplete.`)
    }
    files.push({ path: relative, url: String(url), sha1 })
  }
  const directoryName = directoryNameForSlug(slug || projectId || index.name || "pack")
  return {
    instance: {
      id: directoryName,
      kind: "modrinth",
      name: String(title || index.name || directoryName).slice(0, 80),
      minecraftVersion: String(dependencies.minecraft),
      loader,
      projectId: String(projectId || ""),
      versionId: String(versionId || index.versionId || ""),
      directoryName,
    },
    files,
  }
}

function loaderFromDependencies(dependencies) {
  const deps = dependencies || {}
  if (deps["fabric-loader"]) return { type: "fabric", version: String(deps["fabric-loader"]) }
  if (deps["quilt-loader"]) return { type: "quilt", version: String(deps["quilt-loader"]) }
  if (deps.neoforge) return { type: "neoforge", version: String(deps.neoforge) }
  if (deps.forge) return { type: "forge", version: String(deps.forge) }
  return { type: "vanilla", version: "" }
}

function readMrpack(buffer, meta) {
  const entries = readZip(buffer)
  const indexEntry = entries.find((entry) => entry.name === "modrinth.index.json")
  if (!indexEntry) throw new Error("This file is not a Modrinth modpack.")
  let index
  try {
    index = JSON.parse(indexEntry.data.toString("utf8"))
  } catch {
    throw new Error("The pack index is not valid JSON.")
  }
  const plan = planFromIndex(index, meta)
  const overrides = []
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, "/")
    if (name.endsWith("/")) continue
    const stripped = name.startsWith("client-overrides/")
      ? name.slice("client-overrides/".length)
      : name.startsWith("overrides/")
        ? name.slice("overrides/".length)
        : ""
    if (!stripped) continue
    const relative = safePackPath(stripped)
    if (!relative) continue
    overrides.push({ path: relative, data: entry.data })
  }
  return { ...plan, overrides }
}

async function searchModpacks(query, { fetchImpl, version } = {}) {
  const text = String(query || "").trim()
  const facets = encodeURIComponent(JSON.stringify([["project_type:modpack"]]))
  const suffix = `limit=12&index=${text ? "relevance" : "downloads"}&facets=${facets}${
    text ? `&query=${encodeURIComponent(text)}` : ""
  }`
  const payload = await modrinthJson(`/search?${suffix}`, { fetchImpl, version })
  const hits = Array.isArray(payload?.hits) ? payload.hits : []
  return hits.map(mapSearchHit).filter(Boolean)
}

async function listProjectVersions(projectId, { fetchImpl, version } = {}) {
  const id = String(projectId || "").trim()
  if (!/^[A-Za-z0-9]{1,32}$/.test(id)) throw new Error("Choose a Modrinth project.")
  const payload = await modrinthJson(`/project/${encodeURIComponent(id)}/version`, { fetchImpl, version })
  const versions = Array.isArray(payload) ? payload : []
  return versions.map(mapVersion).filter(Boolean).slice(0, 12)
}

async function getVersion(versionId, { fetchImpl, version } = {}) {
  const id = String(versionId || "").trim()
  if (!/^[A-Za-z0-9]{1,32}$/.test(id)) throw new Error("Choose a Modrinth version.")
  return modrinthJson(`/version/${encodeURIComponent(id)}`, { fetchImpl, version })
}

async function modrinthJson(pathname, { fetchImpl, version } = {}) {
  const request = fetchImpl || fetch
  let response
  try {
    response = await request(`${API_BASE}${pathname}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(version),
      },
    })
  } catch {
    throw new Error("Modrinth is temporarily unavailable.")
  }
  if (!response?.ok) {
    throw new Error(`Modrinth request failed (${response?.status || "network"}).`)
  }
  return response.json()
}

module.exports = {
  API_BASE,
  userAgent,
  mapSearchHit,
  mapVersion,
  mrpackFile,
  safePackPath,
  clientFileIncluded,
  planFromIndex,
  loaderFromDependencies,
  readMrpack,
  searchModpacks,
  listProjectVersions,
  getVersion,
}
