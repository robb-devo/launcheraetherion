/**
 * Playtime display for a future Control payload.
 * There is no HTTP route yet. AetherionCore reads the total with
 * AetherServices.playtime().seconds(uuid) (aetherion-plugins #50).
 * When Control forwards that integer, the body should be:
 *   { "totalSeconds": 12345 }
 * The same field may be nested as playtime.totalSeconds or player.totalSeconds.
 * A missing body or a bad value stays empty. The launcher never invents a number,
 * and the window omits the row until totalSeconds is present.
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
