/**
 * In-app updates from GitHub Releases on robb-devo/launcheraetherion.
 * electron-builder writes app-update.yml and dist/latest.yml for this feed.
 */

const { app, BrowserWindow, ipcMain } = require("electron")

const FEED = {
  provider: "github",
  owner: "robb-devo",
  repo: "launcheraetherion",
}

let state = {
  status: "idle",
  version: null,
  percent: 0,
  message: "Install this version once. Later versions arrive through this app.",
}
let autoUpdater = null
let started = false

function currentState() {
  return state
}

function publish(patch) {
  state = { ...state, ...patch }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("updater:state", state)
    }
  }
}

function quietFailure(text) {
  return /404|ENOTFOUND|ECONNRESET|latest\.yml|No published versions|HttpError: 404|net::ERR/i.test(text)
}

function startAppUpdater() {
  if (started) return state
  started = true

  if (!app.isPackaged) {
    publish({
      status: "none",
      message: "In-app updates run after the launcher is installed.",
    })
    return state
  }

  try {
    autoUpdater = require("electron-updater").autoUpdater
  } catch (error) {
    console.warn("[aetherion] updater missing", error)
    publish({ status: "error", message: "The updater could not start." })
    return state
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.logger = console
  autoUpdater.setFeedURL(FEED)

  autoUpdater.on("checking-for-update", () => {
    publish({ status: "checking", message: "Checking GitHub Releases..." })
  })
  autoUpdater.on("update-available", (info) => {
    publish({
      status: "available",
      version: info?.version || null,
      percent: 0,
      message: info?.version ? `Downloading launcher ${info.version}...` : "Downloading the launcher update...",
    })
  })
  autoUpdater.on("update-not-available", () => {
    publish({ status: "none", version: null, message: "This launcher is up to date." })
  })
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress?.percent || 0)))
    publish({ status: "downloading", percent, message: `Downloading update... ${percent}%` })
  })
  autoUpdater.on("update-downloaded", (info) => {
    const version = info?.version || state.version
    publish({
      status: "ready",
      version,
      message: version
        ? `Launcher ${version} is ready. Restart to install it.`
        : "A launcher update is ready. Restart to install it.",
    })
  })
  autoUpdater.on("error", (error) => {
    const text = error instanceof Error ? error.message : String(error)
    console.warn("[aetherion] updater", text)
    if (quietFailure(text)) {
      publish({ status: "none", message: "No newer launcher release is published yet." })
      return
    }
    publish({ status: "error", message: "Could not check for a launcher update." })
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn("[aetherion] updater check", error)
    })
  }, 4000)

  return state
}

function checkForUpdate() {
  if (!autoUpdater) return state
  autoUpdater.checkForUpdates().catch((error) => {
    console.warn("[aetherion] updater check", error)
  })
  return state
}

function installUpdate() {
  if (!autoUpdater || state.status !== "ready") return { ok: false }
  // Silent NSIS (/S) plus windowsHide inside electron-updater. No cmd or PowerShell window.
  setImmediate(() => {
    autoUpdater.quitAndInstall(true, true)
  })
  return { ok: true }
}

ipcMain.handle("updater:get", () => currentState())
ipcMain.handle("updater:check", () => {
  checkForUpdate()
  return currentState()
})
ipcMain.handle("updater:install", () => installUpdate())

module.exports = {
  FEED,
  startAppUpdater,
  currentState,
}
