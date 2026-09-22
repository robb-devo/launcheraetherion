/**
 * Friend-tier client for the Aetherion control sandbox API.
 * The credential stays in the main process. The window never sees it.
 */

const DEFAULT_API_BASE = "http://135.181.18.162:5055"
const BAKED_SERVICE_KEY = "aetherion-launcher-friend-v1"

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
    throw new Error("Sign in with Microsoft before using sandboxes.")
  }
  return id
}

function apiUrl(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${apiBase()}/api${path}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Control API is unreachable (${message}).`)
  }
  const data = await readBody(response)
  if (!response.ok) {
    const raw = data?.error || `Request failed (HTTP ${response.status}).`
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "The control API refused this launcher. Sandbox access needs the friend credential accepted on the server.",
      )
    }
    throw new Error(raw)
  }
  return data
}

function sandboxOptions(playerId) {
  return api("/sandbox/options", { playerId })
}

function sandboxList(playerId) {
  return api("/sandbox/servers", { playerId })
}

function sandboxCreate(playerId, input) {
  return api("/sandbox/servers", { method: "POST", body: input || {}, playerId })
}

function sandboxStart(playerId, id) {
  return api(`/sandbox/servers/${encodeURIComponent(id)}/start`, { method: "POST", playerId })
}

function sandboxStop(playerId, id) {
  return api(`/sandbox/servers/${encodeURIComponent(id)}/stop`, { method: "POST", playerId })
}

function sandboxDelete(playerId, id) {
  return api(`/sandbox/servers/${encodeURIComponent(id)}`, { method: "DELETE", playerId })
}

module.exports = {
  DEFAULT_API_BASE,
  apiBase,
  playerHeader,
  apiUrl,
  sandboxOptions,
  sandboxList,
  sandboxCreate,
  sandboxStart,
  sandboxStop,
  sandboxDelete,
}
