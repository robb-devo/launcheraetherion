/**
 * Realm playtime comes from Control:
 *   GET /api/player/playtime
 *   { "totalSeconds": 12345 }
 *
 * totalSeconds may also be nested as playtime.totalSeconds or player.totalSeconds.
 * A missing route, a missing field, or a bad value stays empty.
 * The launcher never substitutes a fake number.
 */

function readTotalSeconds(payload) {
  if (!payload || typeof payload !== "object") return null
  const candidates = [payload.totalSeconds, payload.playtime?.totalSeconds, payload.player?.totalSeconds]
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue
    const seconds = typeof candidate === "number" ? candidate : Number(String(candidate).trim())
    if (!Number.isFinite(seconds) || seconds < 0) continue
    return Math.floor(seconds)
  }
  return null
}

function formatPlaytime(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return null
  const seconds = Math.floor(totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

function presentPlaytime(payload) {
  const totalSeconds = readTotalSeconds(payload)
  if (totalSeconds == null) {
    return { totalSeconds: null, available: false, label: null }
  }
  return {
    totalSeconds,
    available: true,
    label: formatPlaytime(totalSeconds),
  }
}

const PLAYTIME_UNAVAILABLE = Object.freeze({
  totalSeconds: null,
  available: false,
  label: null,
})

module.exports = {
  readTotalSeconds,
  formatPlaytime,
  presentPlaytime,
  PLAYTIME_UNAVAILABLE,
}
