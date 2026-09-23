/**
 * Friend-tier client for the Aetherion control sandbox API.
 * The credential stays in the main process. The window never sees it.
 * Creates and lists isolated sandbox-* servers only.
 */

const { PRODUCTION_PORT, assertSandboxJoin, isProductionHost } = require("./production-guard.cjs")

const DEFAULT_API_BASE = "http://135.181.18.162:5055"
const BAKED_SERVICE_KEY = "aetherion-launcher-friend-v1"
const UNAVAILABLE = "Sandbox API is temporarily unavailable."
const SIGN_IN = "Sign in with Microsoft before using sandboxes."
const SERVER_TYPES = new Set(["vanilla", "paper", "fabric", "purpur"])

function apiBase() {
  const fromEnv = String(process.env.AETHERION_API_BASE || "").trim()
  return (fromEnv || DEFAULT_API_BASE).replace(/\/+$/, "")
}

function serviceKey() {
  return (
    String(process.env.AETHERION_CONTROL_KEY || process.env.LAUNCHER_SERVICE_KEY || "").trim() ||
    BAKED_SERVICE_KEY
  )
}

function playerHeader(playerId) {
  const id = String(playerId || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "")
  if (!/^[0-9a-f]{32}$/.test(id)) {
    throw new Error(SIGN_IN)
  }
  return id
}

function apiUrl(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${apiBase()}/api${path}`
}

function failureMessage(status, data) {
  const raw = typeof data?.error === "string" ? data.error.trim() : ""
  if (status === 401 && /sign in with microsoft/i.test(raw)) return SIGN_IN
  if (status === 401 || status === 403 || status >= 500) return UNAVAILABLE
  if (/bearer|credential|service key|friend key|access code/i.test(raw)) return UNAVAILABLE
  return raw || `Request failed (HTTP ${status}).`
}

function cleanName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeCreate(input) {
  const source = input && typeof input === "object" ? input : {}
  const name = cleanName(source.name)
  const version = String(source.version || "").trim()
  const ramGb = Number(source.ramGb) === 24 ? 24 : 16
  const serverType = SERVER_TYPES.has(source.serverType) ? source.serverType : "paper"
  if (name.length < 2 || name.length > 24) {
    throw new Error("Name must be 2–24 chars (letters, numbers, hyphens).")
  }
  if (!version) throw new Error("Version is required.")
  return {
    name,
    serverType,
    version,
    ramGb,
    cpuCores: 4,
    preset: ramGb === 24 ? "large" : "balanced",
    onlineMode: true,
    startAfterCreate: source.startAfterCreate !== false,
  }
}

function isIsolatedAddress(address) {
  const value = String(address || "").trim()
  if (!value) return true
  const colon = value.lastIndexOf(":")
  const host = colon > 0 ? value.slice(0, colon) : value
  const port = colon > 0 ? Number(value.slice(colon + 1)) : null
  if (isProductionHost(host) || port === PRODUCTION_PORT) return false
  if (port == null) return true
  try {
    assertSandboxJoin(host, port)
    return true
  } catch {
    return false
  }
}

function isolatedServers(data) {
  const servers = Array.isArray(data?.servers) ? data.servers : []
  return servers.filter((server) => {
    const name = String(server?.name || "")
    return name.startsWith("sandbox-") && isIsolatedAddress(server?.address)
  })
}

async function readBody(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 280) }
  }
}

async function api(pathname, { method = "GET", body, playerId } = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${serviceKey()}`,
    "X-Aetherion-Player": playerHeader(playerId),
  }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  let response
  try {
    response = await fetch(apiUrl(pathname), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(UNAVAILABLE)
  }
  const data = await readBody(response)
  if (!response.ok) {
    throw new Error(failureMessage(response.status, data))
  }
  return data
}

function sandboxOptions(playerId) {
  return api("/sandbox/options", { playerId })
}

async function sandboxList(playerId) {
  const data = await api("/sandbox/servers", { playerId })
  return { servers: isolatedServers(data) }
}

async function sandboxCreate(playerId, input) {
  const body = normalizeCreate(input)
  const created = await api("/sandbox/servers", { method: "POST", body, playerId })
  const name = String(created?.name || "")
  if (name && !name.startsWith("sandbox-")) {
    throw new Error(UNAVAILABLE)
  }
  if (created?.address && !isIsolatedAddress(created.address)) {
    throw new Error("Sandboxes stay off the live Aetherion realm.")
  }
  return created
}

function sandboxTarget(id) {
  const value = String(id || "").trim()
  if (!value || value.includes("/") || value.includes("..") || value.length > 128) {
    throw new Error("Sandbox not found.")
  }
  return value
}

function sandboxStart(playerId, id) {
  return api(`/sandbox/servers/${encodeURIComponent(sandboxTarget(id))}/start`, {
    method: "POST",
    playerId,
  })
}

function sandboxStop(playerId, id) {
  return api(`/sandbox/servers/${encodeURIComponent(sandboxTarget(id))}/stop`, {
    method: "POST",
    playerId,
  })
}

function sandboxDelete(playerId, id) {
  return api(`/sandbox/servers/${encodeURIComponent(sandboxTarget(id))}`, {
    method: "DELETE",
    playerId,
  })
}

module.exports = {
  DEFAULT_API_BASE,
  BAKED_SERVICE_KEY,
  UNAVAILABLE,
  apiBase,
  serviceKey,
  playerHeader,
  apiUrl,
  failureMessage,
  normalizeCreate,
  isIsolatedAddress,
  isolatedServers,
  sandboxOptions,
  sandboxList,
  sandboxCreate,
  sandboxStart,
  sandboxStop,
  sandboxDelete,
}
