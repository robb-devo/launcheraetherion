/**
 * GitHub Release feed for electron-updater.
 * Installed clients read latest.yml from the latest non-draft release.
 * v0.3.4 published the Setup.exe and blockmap only, so that URL 404s until a
 * release includes latest.yml.
 */

const FEED = {
  provider: "github",
  owner: "robb-devo",
  repo: "launcheraetherion",
  updaterCacheDirName: "aetherion-launcher-updater",
}

function feedUrl(feed = FEED) {
  return `https://github.com/${feed.owner}/${feed.repo}/releases/latest/download/latest.yml`
}

function installerName(version) {
  return `Aetherion.Launcher.Setup.${version}.exe`
}

function compareVersions(left, right) {
  const parse = (value) =>
    String(value || "")
      .trim()
      .replace(/^v/i, "")
      .split(".")
      .map((part) => {
        const match = /^(\d+)/.exec(part)
        return match ? Number(match[1]) : 0
      })
  const a = parse(left)
  const b = parse(right)
  const length = Math.max(a.length, b.length, 3)
  for (let index = 0; index < length; index += 1) {
    const av = a[index] || 0
    const bv = b[index] || 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

function isNewerVersion(remote, current) {
  return compareVersions(remote, current) > 0
}

function parseLatestYml(text) {
  const source = String(text || "")
  const version = /^version:\s*['"]?([0-9][^'"\s]*)['"]?\s*$/m.exec(source)?.[1] || null
  const filePath = /^path:\s*['"]?(.+?)['"]?\s*$/m.exec(source)?.[1] || null
  const sha512 = /^sha512:\s*['"]?(.+?)['"]?\s*$/m.exec(source)?.[1] || null
  const url = /^\s*-\s*url:\s*['"]?(.+?)['"]?\s*$/m.exec(source)?.[1] || null
  return { version, path: filePath, sha512, url }
}

function validateLatestYml(text, version) {
  const parsed = parseLatestYml(text)
  const installer = installerName(version)
  const errors = []
  if (parsed.version !== version) {
    errors.push(`latest.yml version is ${parsed.version || "missing"}, expected ${version}.`)
  }
  if (parsed.path !== installer) {
    errors.push(`latest.yml path is ${parsed.path || "missing"}, expected ${installer}.`)
  }
  if (parsed.url && parsed.url !== installer && !parsed.url.endsWith(`/${installer}`)) {
    errors.push(`latest.yml url is ${parsed.url}, expected ${installer}.`)
  }
  if (!parsed.sha512) errors.push("latest.yml is missing sha512.")
  return { ok: errors.length === 0, errors, parsed, installer }
}

function classifyUpdaterError(text) {
  const message = String(text || "")
  if (/404|latest\.yml|No published versions|HttpError:\s*404/i.test(message)) {
    return "GitHub's latest release has no latest.yml. In-app update stays off until that release includes latest.yml, Aetherion.Launcher.Setup.<version>.exe, and the .blockmap."
  }
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::ERR/i.test(message)) {
    return "Could not reach GitHub Releases to check for an update."
  }
  return "Could not check for a launcher update."
}

function reduceUpdate(state, event) {
  const current = state || { status: "idle", version: null, percent: 0, message: "" }
  switch (event?.type) {
    case "checking":
      return { ...current, status: "checking", percent: 0, message: "Checking GitHub Releases..." }
    case "available":
      return {
        status: "available",
        version: event.version || null,
        percent: 0,
        message: event.version
          ? `Downloading launcher ${event.version}...`
          : "Downloading the launcher update...",
      }
    case "none":
      return {
        status: "none",
        version: null,
        percent: 0,
        message: event.message || "This launcher is up to date.",
      }
    case "progress": {
      const percent = Math.max(0, Math.min(100, Math.round(Number(event.percent) || 0)))
      return {
        ...current,
        status: "downloading",
        version: event.version || current.version,
        percent,
        message: `Downloading update... ${percent}%`,
      }
    }
    case "ready": {
      const version = event.version || current.version
      return {
        status: "ready",
        version,
        percent: 100,
        message: version
          ? `Launcher ${version} is ready. Restart to install it.`
          : "A launcher update is ready. Restart to install it.",
      }
    }
    case "error":
      return {
        status: "error",
        version: current.version,
        percent: current.percent || 0,
        message: event.message || classifyUpdaterError(event.detail),
      }
    default:
      return current
  }
}

module.exports = {
  FEED,
  feedUrl,
  installerName,
  compareVersions,
  isNewerVersion,
  parseLatestYml,
  validateLatestYml,
  classifyUpdaterError,
  reduceUpdate,
}
