/**
 * Launcher self-update. Separate from the modpack updater in runUpdater().
 * electron-builder writes app-update.yml from package.json "build.publish".
 * Packaged builds resolve electron-updater from electron/vendor (staged before packaging).
 */

const fs = require("node:fs")
const path = require("node:path")

const CHECK_COOLDOWN_MS = 10 * 60 * 1000

function createLauncherUpdater({ getWindow, isDev, shouldDeferRestart }) {
  const state = {
    status: "idle",
    version: null,
    percent: null,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    error: null,
  }
  let lastCheckAt = 0
  let checking = false
  let installQueued = false
  let autoUpdater = null

  function publish(patch) {
    Object.assign(state, patch)
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:status", snapshot())
    }
  }

  function snapshot() {
    return { ...state }
  }

  function install() {
    if (!autoUpdater || installQueued) return { ok: Boolean(autoUpdater), queued: installQueued }
    if (state.status !== "downloaded") return { ok: false, reason: "not-downloaded" }
    installQueued = true
    publish({ status: "downloaded" })
    setImmediate(() => {
      autoUpdater.quitAndInstall(true, true)
    })
    return { ok: true }
  }

  if (isDev) {
    return {
      snapshot,
      check: async () => snapshot(),
      install: async () => ({ ok: false, reason: "dev" }),
    }
  }

  const vendorModules = path.join(__dirname, "vendor", "node_modules")
  if (fs.existsSync(vendorModules)) {
    module.paths.unshift(vendorModules)
  }

  try {
    autoUpdater = require("electron-updater").autoUpdater
  } catch (error) {
    console.error("[aetherion] electron-updater unavailable", error)
    publish({
      status: "error",
      error: "The update module is not included in this build.",
    })
    return {
      snapshot,
      check: async () => snapshot(),
      install: async () => ({ ok: false }),
    }
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.logger = console

  autoUpdater.on("checking-for-update", () => {
    if (state.status === "downloading" || state.status === "downloaded") return
    publish({ status: "checking", error: null })
  })

  autoUpdater.on("update-available", (info) => {
    publish({
      status: "available",
      version: info?.version || null,
      percent: null,
      transferred: 0,
      total: null,
      bytesPerSecond: null,
      error: null,
    })
  })

  autoUpdater.on("update-not-available", () => {
    publish({
      status: "idle",
      version: null,
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      error: null,
    })
  })

  autoUpdater.on("download-progress", (progress) => {
    const total = Number(progress?.total) || 0
    const transferred = Number(progress?.transferred) || 0
    publish({
      status: "downloading",
      percent: total > 0 ? (transferred / total) * 100 : null,
      transferred,
      total: total > 0 ? total : null,
      bytesPerSecond: Number(progress?.bytesPerSecond) || null,
      error: null,
    })
  })

  autoUpdater.on("update-downloaded", (info) => {
    publish({
      status: "downloaded",
      version: info?.version || state.version,
      percent: 100,
      transferred: state.total ?? state.transferred,
      total: state.total,
      error: null,
    })
    if (typeof shouldDeferRestart === "function" && shouldDeferRestart()) return
    setTimeout(() => install(), 1200)
  })

  autoUpdater.on("error", (error) => {
    if (state.status === "downloaded") return
    console.error("[aetherion] updater error", error)
    publish({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    })
  })

  async function check(force = false) {
    if (!autoUpdater) return snapshot()
    if (
      state.status === "available" ||
      state.status === "downloading" ||
      state.status === "downloaded"
    ) {
      return snapshot()
    }
    const now = Date.now()
    if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) return snapshot()
    if (checking) return snapshot()
    checking = true
    lastCheckAt = now
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      publish({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      checking = false
    }
    return snapshot()
  }

  return { snapshot, check, install }
}

module.exports = { createLauncherUpdater }
