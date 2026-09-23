/**
 * Minecraft 1.20+ (snapshot 23w14a) ignores --server and --port.
 * The client logs them as completely ignored and stays on the title screen.
 * Quick Play is the argument that actually joins.
 *
 * Older releases still use --server and --port. Passing Quick Play to those
 * builds does not connect.
 */

function minecraftReleaseParts(version) {
  const match = String(version || "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : 0]
}

function supportsQuickPlay(version) {
  const parts = minecraftReleaseParts(version)
  if (!parts) return false
  if (parts[0] > 1) return true
  if (parts[0] < 1) return false
  return parts[1] >= 20
}

function normalizeJoinHost(host) {
  const name = String(host || "").trim().replace(/\.$/, "")
  if (!name || /[\s"'\\]/.test(name)) return ""
  return name
}

function normalizeJoinPort(port) {
  const parsed = Number(port)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return 25565
  return parsed
}

/**
 * Game arguments placed after the main class.
 * Empty when there is no host — callers decide whether a join is wanted.
 */
function directJoinGameArgs({ host, port, minecraftVersion }) {
  const name = normalizeJoinHost(host)
  if (!name) return []
  const joinPort = normalizeJoinPort(port)
  if (supportsQuickPlay(minecraftVersion)) {
    const address = name.includes(":") && !name.startsWith("[") ? `[${name}]` : name
    return ["--quickPlayMultiplayer", `${address}:${joinPort}`]
  }
  return ["--server", name, "--port", String(joinPort)]
}

function describedJoinArgs(gameArgs) {
  const args = Array.isArray(gameArgs) ? gameArgs : []
  const flags = new Set(["--quickPlayMultiplayer", "--quickPlaySingleplayer", "--quickPlayRealms", "--server", "--port"])
  const picked = []
  for (let index = 0; index < args.length; index += 1) {
    if (!flags.has(args[index])) continue
    picked.push(args[index])
    const next = args[index + 1]
    if (next != null && !String(next).startsWith("--")) picked.push(next)
  }
  return picked
}

module.exports = {
  supportsQuickPlay,
  directJoinGameArgs,
  describedJoinArgs,
}
