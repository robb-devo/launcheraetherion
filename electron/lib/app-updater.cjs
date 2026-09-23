/**
 * In-app updates from GitHub Releases on robb-devo/launcheraetherion.
 * electron-builder writes app-update.yml and dist/latest.yml for this feed.
 * A release only updates installed copies when it is the latest non-draft
 * release and it contains latest.yml, the Setup.exe, and the .blockmap.
 */

const { app, BrowserWindow, ipcMain } = require("electron")
const { FEED, classifyUpdaterError, reduceUpdate } = require("./update-feed.cjs")

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

function publish(next) {
  state = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("updater:state", state)
    }
  }
}

function publishEvent(event) {
  publish(reduceUpdate(state, event))
}

function startAppUpdater() {
  if (started) return state
  started = true

  if (!app.isPackaged) {
    publishEvent({
      type: "none",
      message: "In-app updates install from an installed build. This unpackaged run can still launch Minecraft.",
    })
    return state
  }

  try {
    autoUpdater = require("electron-updater").autoUpdater
  } catch (error) {
    console.warn("[aetherion] updater missing", error)
    publishEvent({ type: "error", message: "The updater could not start." })
    return state
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.disableWebInstaller = true
  autoUpdater.logger = console
  autoUpdater.setFeedURL(FEED)

  autoUpdater.on("checking-for-update", () => {
    publishEvent({ type: "checking" })
  })
  autoUpdater.on("update-available", (info) => {
    publishEvent({ type: "available", version: info?.version || null })
  })
  autoUpdater.on("update-not-available", () => {
    publishEvent({ type: "none" })
  })
  autoUpdater.on("download-progress", (progress) => {
    publishEvent({ type: "progress", percent: progress?.percent || 0 })
  })
  autoUpdater.on("update-downloaded", (info) => {
    publishEvent({ type: "ready", version: info?.version || state.version })
  })
  autoUpdater.on("error", (error) => {
    const text = error instanceof Error ? error.message : String(error)
    console.warn("[aetherion] updater", text)
    publishEvent({ type: "error", detail: text, message: classifyUpdaterError(text) })
  })

  setTimeout(() => {
    checkForUpdate()
  }, 2500)

  return state
}

function checkForUpdate() {
  if (!autoUpdater) return state
  publishEvent({ type: "checking" })
  autoUpdater.checkForUpdates().catch((error) => {
    const text = error instanceof Error ? error.message : String(error)
    console.warn("[aetherion] updater check", text)
    publishEvent({ type: "error", detail: text, message: classifyUpdaterError(text) })
  })
  return state
}

function installUpdate() {
  if (!autoUpdater || state.status !== "ready") return { ok: false }
  // isSilent adds NSIS /S. isForceRunAfter restarts the app. windowsHide is set by electron-updater.
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
