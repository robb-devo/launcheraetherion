/**
 * Friend-tier client for the Aetherion control sandbox API.
 * The credential stays in the main process. The window never sees it.
 */

const DEFAULT_API_BASE = "http://135.181.18.162:5055"
const BAKED_SERVICE_KEY = "aetherion-launcher-friend-v1"
const UNAVAILABLE = "Sandbox API is temporarily unavailable."
const SIGN_IN = "Sign in with Microsoft before using sandboxes."

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

function failureMessage(status, data) {
  const raw = typeof data?.error === "string" ? data.error.trim() : ""
  if (status === 401 && /sign in with microsoft/i.test(raw)) return SIGN_IN
  if (status === 401 || status === 403 || status >= 500) return UNAVAILABLE
  if (/bearer|credential|service key|friend key|access code/i.test(raw)) return UNAVAILABLE
  return raw || `Request failed (HTTP ${status}).`
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
    throw new Error("Sandbox API is temporarily unavailable.")
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

async function sandboxRestart(playerId, id) {
  await sandboxStop(playerId, id)
  return sandboxStart(playerId, id)
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
  sandboxOptions,
  sandboxList,
  sandboxCreate,
  sandboxStart,
  sandboxStop,
  sandboxDelete,
  sandboxRestart,
}
