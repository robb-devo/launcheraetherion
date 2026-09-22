const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = require("electron")
const controlApi = require("./lib/control.cjs")
const microsoftAuth = require("./lib/microsoft.cjs")
const { probeRealm } = require("./lib/realm-status.cjs")
const { startAppUpdater } = require("./lib/app-updater.cjs")
const {
  normalizePackManifest,
  fabricProfileId,
  packServer,
  assertClientPack,
} = require("./lib/pack-manifest.cjs")
const { spawn } = require("node:child_process")
const crypto = require("node:crypto")
const fsSync = require("node:fs")
const fs = require("node:fs/promises")
const { once } = require("node:events")
const os = require("node:os")
const path = require("node:path")
const zlib = require("node:zlib")

const isDev = !app.isPackaged
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/
const LAUNCHER_NAME = "AetherionLauncher"
const LAUNCHER_VERSION = require("../package.json").version
const MOJANG_VERSION_MANIFEST =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
const MINECRAFT_RESOURCES_BASE = "https://resources.download.minecraft.net"
const APP_PROTOCOL = "aetherion"
const DEFAULT_MANIFEST = {
  version: "1.2.3",
  minecraft: "1.21.1",
  name: "AETHERION",
  instanceId: "aetherion-client",
  loader: { type: "fabric", version: "0.19.5" },
  server: { name: "AETHERION", address: "play.donnernet.de", port: 25565 },
  java: { recommendedMajor: 21, minMajor: 21 },
  files: [],
  shaderpacks: [],
}
const AETHERION_SERVER_HOST = "play.donnernet.de"
const AETHERION_SERVER_PORT = 25565
const AETHERION_SERVER_NAME = "AETHERION"
const DEFAULT_SETTINGS = {
  minecraft: {
    resolution: { width: 1280, height: 720 },
    fullscreen: false,
    autoConnectServer: true,
    detachProcess: true,
    closeOnLaunch: false,
  },
  java: {
    minRamMb: 4096,
    maxRamMb: 8192,
    executablePath: "",
    jvmArgs: "",
    autoDownloadRuntime: true,
  },
  launcher: {
    updateChannel: "stable",
    manifestUrl: process.env.AETHERION_MANIFEST_URL || "",
    minimizeToTray: false,
    telemetry: false,
  },
}

let mainWindow = null
let activeLaunchAbort = null
let activeMinecraftProcess = null
let activeMinecraftDetached = true

app.setName("Aetherion Launcher")
if (process.platform === "win32") {
  app.setAppUserModelId("gg.aetherion.launcher")
}
microsoftAuth.configure({
  getMainWindow: () => mainWindow,
  userDataPath: () => app.getPath("userData"),
  iconPath: () => appIconPath(),
})
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#121018",
    icon: appIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once("ready-to-show", () => mainWindow?.show())

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000/launcher")
    if (process.env.AETHERION_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" })
    }
  } else {
    mainWindow.loadURL(`${APP_PROTOCOL}://app/launcher/`)
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })
}

function registerStaticAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const outRoot = path.join(app.getAppPath(), "out")
    const url = new URL(request.url)
    let pathname = decodeURIComponent(url.pathname)

    if (!pathname || pathname === "/") pathname = "/launcher/"
    const filePath = resolveStaticAppPath(outRoot, pathname)
    if (!filePath || !fsSync.existsSync(filePath)) {
      return new Response("File not found.", { status: 404 })
    }

    const data = await fs.readFile(filePath)
    return new Response(data, {
      headers: { "content-type": contentTypeFor(filePath) },
    })
  })
}

function resolveStaticAppPath(root, requestPath) {
  const normalized = requestPath && requestPath !== "/" ? requestPath : "/launcher/"
  const directPath = normalized.endsWith("/") ? `${normalized}index.html` : normalized
  const directFile = safeStaticPath(root, directPath)

  if (directFile && fsSync.existsSync(directFile)) {
    const stat = fsSync.statSync(directFile)
    if (stat.isFile()) return directFile
    if (stat.isDirectory()) {
      const indexFile = path.join(directFile, "index.html")
      if (fsSync.existsSync(indexFile)) return indexFile
    }
  }

  const directoryIndex = safeStaticPath(root, `${normalized}/index.html`)
  if (directoryIndex && fsSync.existsSync(directoryIndex)) return directoryIndex

  return directFile
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".js":
      return "text/javascript; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".svg":
      return "image/svg+xml"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".ico":
      return "image/x-icon"
    case ".woff2":
      return "font/woff2"
    default:
      return "application/octet-stream"
  }
}

function safeStaticPath(root, requestPath) {
  const relativePath = toPosix(requestPath).replace(/^\/+/, "")
  const resolved = path.resolve(root, ...relativePath.split("/"))
  const normalizedRoot = path.resolve(root)

  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    return null
  }

  return resolved
}

function appIconPath() {
  const iconPath = path.join(app.getAppPath(), "build", "icon.ico")
  return fsSync.existsSync(iconPath) ? iconPath : undefined
}

app.whenReady().then(async () => {
  if (!isDev) registerStaticAppProtocol()
  createWindow()
  startAppUpdater()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on("before-quit", () => {
  if (activeMinecraftProcess && !activeMinecraftDetached && !activeMinecraftProcess.killed) {
    activeMinecraftProcess.kill()
  }
})

ipcMain.on("window:minimize", () => mainWindow?.minimize())
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on("window:close", () => mainWindow?.close())

ipcMain.handle("accounts:list", async () => visibleAccountsState(await readAccountsState()))
ipcMain.handle("accounts:addOffline", async (_event, username) => {
  const state = await readAccountsState()
  const account = createOfflineAccount(username)
  const existing = state.accounts.find(
    (candidate) =>
      candidate.type === "offline" &&
      candidate.username.toLowerCase() === account.username.toLowerCase(),
  )

  if (existing) throw new Error("That name is already added.")

  const next = {
    activeId: state.activeId ?? account.id,
    accounts: [...state.accounts, account],
  }
  await writeAccountsState(next)
  return visibleAccountsState(next)
})
ipcMain.handle("accounts:remove", async (_event, id) => {
  const state = await readAccountsState()
  const accounts = state.accounts.filter((account) => account.id !== id)
  const activeId = state.activeId === id ? accounts[0]?.id ?? null : state.activeId
  const next = { activeId, accounts }
  await writeAccountsState(next)
  await microsoftAuth.deleteSecret(id)
  return visibleAccountsState(next)
})
ipcMain.handle("accounts:setActive", async (_event, id) => {
  const state = await readAccountsState()
  if (!state.accounts.some((account) => account.id === id)) {
    throw new Error("Account not found.")
  }

  const next = { ...state, activeId: id }
  await writeAccountsState(next)
  return visibleAccountsState(next)
})
ipcMain.handle("accounts:getDataPath", () => accountsPath())

ipcMain.handle("accounts:addMicrosoft", async () => {
  const account = await microsoftAuth.loginMicrosoft()
  const state = await readAccountsState()
  const accounts = state.accounts.filter((candidate) => candidate.id !== account.id)
  const next = { activeId: account.id, accounts: [...accounts, account] }
  await writeAccountsState(next)
  return visibleAccountsState(next)
})

ipcMain.handle("status:realm", async () => {
  return probeRealm(AETHERION_SERVER_HOST, AETHERION_SERVER_PORT)
})

async function microsoftPlayerId() {
  const state = await readAccountsState()
  const account =
    state.accounts.find((candidate) => candidate.id === state.activeId && candidate.type === "microsoft") ||
    state.accounts.find((candidate) => candidate.type === "microsoft")
  if (!account) throw new Error("Sign in with Microsoft before using sandboxes.")
  return account.uuid
}

ipcMain.handle("sandbox:options", async () => controlApi.sandboxOptions(await microsoftPlayerId()))
ipcMain.handle("sandbox:list", async () => controlApi.sandboxList(await microsoftPlayerId()))
ipcMain.handle("sandbox:create", async (_event, input) =>
  controlApi.sandboxCreate(await microsoftPlayerId(), input),
)
ipcMain.handle("sandbox:start", async (_event, id) =>
  controlApi.sandboxStart(await microsoftPlayerId(), id),
)
ipcMain.handle("sandbox:stop", async (_event, id) =>
  controlApi.sandboxStop(await microsoftPlayerId(), id),
)
ipcMain.handle("sandbox:remove", async (_event, id) =>
  controlApi.sandboxDelete(await microsoftPlayerId(), id),
)

ipcMain.handle("settings:get", () => readLauncherSettings())
ipcMain.handle("settings:update", async (_event, patch) => {
  const current = await readLauncherSettings()
  const next = sanitizeLauncherSettings(deepMerge(current, patch || {}))
  await writeLauncherSettings(next)
  return next
})
ipcMain.handle("settings:getPaths", async () => {
  const settings = await readLauncherSettings()
  return {
    settingsPath: settingsPath(),
    instancePath: settings.minecraft.gameDirectory,
  }
})
ipcMain.handle("settings:openInstanceFolder", async () => {
  const settings = await readLauncherSettings()
  await fs.mkdir(settings.minecraft.gameDirectory, { recursive: true })
  const error = await shell.openPath(settings.minecraft.gameDirectory)
  if (error) throw new Error(error)
  return { ok: true }
})
ipcMain.handle("java:detect", async () => {
  const settings = await readLauncherSettings()
  const java = await resolveJavaForSettings(settings.java, 21, 21)
  return {
    totalRamMb: systemRamMb(),
    java,
  }
})
ipcMain.handle("java:chooseExecutable", async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: "Choose Java",
    properties: ["openFile"],
    filters:
      process.platform === "win32"
        ? [{ name: "Java", extensions: ["exe"] }]
        : [{ name: "Java", extensions: ["*"] }],
  })
  if (result.canceled || !result.filePaths[0]) return null

  const java = await inspectJava(result.filePaths[0])
  if (!java || java.major < 21) {
    throw new Error("Choose Java 21 or newer.")
  }

  const settings = await readLauncherSettings()
  const next = sanitizeLauncherSettings({
    ...settings,
    java: {
      ...settings.java,
      executablePath: result.filePaths[0],
    },
  })
  await writeLauncherSettings(next)
  return { settings: next, java }
})

ipcMain.handle("mods:listDropins", async () => {
  const root = await currentInstanceRoot()
  return refreshDropinState(root)
})
ipcMain.handle("mods:addDropins", async () => {
  const root = await currentInstanceRoot()
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: "Add drop-in mod",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Minecraft mods", extensions: ["jar"] }],
  })
  if (result.canceled || result.filePaths.length === 0) return refreshDropinState(root)

  await fs.mkdir(dropinDir(root), { recursive: true })
  for (const source of result.filePaths) {
    const filename = sanitizeDropinFilename(path.basename(source))
    const target = path.join(dropinDir(root), filename)
    if (path.resolve(source) !== path.resolve(target)) {
      await fs.copyFile(source, target)
    }
    await fs.rm(`${target}.disabled`, { force: true }).catch(() => undefined)
  }
  return refreshDropinState(root)
})
ipcMain.handle("mods:setOptional", async (_event, payload) => {
  const root = await currentInstanceRoot()
  const filePath = String(payload?.path || "")
  if (!filePath.startsWith("mods/")) throw new Error("Invalid optional mod.")

  const state = await readInstanceState(
    root,
    DEFAULT_MANIFEST,
    DEFAULT_MANIFEST.instanceId || "aetherion-main",
  )
  const next = {
    ...state,
    enabledOptionalMods: {
      ...state.enabledOptionalMods,
      [filePath]: Boolean(payload?.enabled),
    },
  }
  await writeInstanceState(root, next)
  return next.enabledOptionalMods
})
ipcMain.handle("mods:setDropinEnabled", async (_event, payload) => {
  const root = await currentInstanceRoot()
  const filename = sanitizeDropinFilename(payload?.filename)
  const enabledPath = path.join(dropinDir(root), filename)
  const disabledPath = `${enabledPath}.disabled`

  if (payload?.enabled) {
    if (fsSync.existsSync(disabledPath)) {
      await fs.rm(enabledPath, { force: true }).catch(() => undefined)
      await fs.rename(disabledPath, enabledPath)
    }
  } else if (fsSync.existsSync(enabledPath)) {
    await fs.rm(disabledPath, { force: true }).catch(() => undefined)
    await fs.rename(enabledPath, disabledPath)
  }

  return refreshDropinState(root)
})
ipcMain.handle("mods:removeDropin", async (_event, filename) => {
  const root = await currentInstanceRoot()
  const clean = sanitizeDropinFilename(filename)
  const enabledPath = path.join(dropinDir(root), clean)
  await fs.rm(enabledPath, { force: true }).catch(() => undefined)
  await fs.rm(`${enabledPath}.disabled`, { force: true }).catch(() => undefined)
  return refreshDropinState(root)
})
ipcMain.handle("mods:openDropinFolder", async () => {
  const root = await currentInstanceRoot()
  await fs.mkdir(dropinDir(root), { recursive: true })
  const error = await shell.openPath(dropinDir(root))
  if (error) throw new Error(error)
  return { ok: true }
})

ipcMain.handle("launcher:openDataDirectory", async () => {
  const settings = await readLauncherSettings()
  const target = settings.launcher.dataDirectory || app.getPath("userData")
  await fs.mkdir(target, { recursive: true })
  const error = await shell.openPath(target)
  if (error) throw new Error(error)
  return { ok: true }
})
ipcMain.handle("launcher:openLogsDirectory", async () => {
  const root = await currentInstanceRoot()
  const target = path.join(root, "logs")
  await fs.mkdir(target, { recursive: true })
  const error = await shell.openPath(target)
  if (error) throw new Error(error)
  return { ok: true }
})
ipcMain.handle("launcher:clearCache", async () => {
  const root = await currentInstanceRoot()
  const candidates = [
    path.join(root, "natives"),
    path.join(root, "cache"),
    path.join(root, "tmp"),
  ]
  let removed = 0

  for (const folder of candidates) {
    if (!fsSync.existsSync(folder)) continue
    await fs.rm(folder, { recursive: true, force: true })
    removed++
  }

  for (const folder of ["forge", "mods", "config", "resourcepacks", "shaderpacks"]) {
    const absolute = path.join(root, folder)
    if (!fsSync.existsSync(absolute)) continue
    const downloads = (await walkFiles(absolute)).filter((file) => file.endsWith(".download"))
    for (const file of downloads) {
      await fs.rm(file, { force: true })
      removed++
    }
  }

  return { removed }
})
ipcMain.handle("launcher:verifyIntegrity", async () => {
  const settings = await readLauncherSettings()
  const manifest = await loadManifest(settings, undefined)
  validateManifest(manifest)
  const instanceId = manifest.instanceId || DEFAULT_MANIFEST.instanceId || "aetherion-main"
  const root = settings.minecraft.gameDirectory || instancePath(instanceId)
  const [localState, installedHashes] = await Promise.all([
    readInstanceState(root, manifest, instanceId),
    scanInstalledHashes(root),
  ])
  const plan = computeUpdatePlan(manifest, localState, installedHashes)
  return {
    downloadCount: plan.downloadCount,
    removeCount: plan.removeCount,
    totalBytes: plan.totalBytes,
  }
})

ipcMain.handle("launch:start", async (_event, args) => {
  console.log("[aetherion] launch requested", args)
  activeLaunchAbort?.abort()
  const controller = new AbortController()
  activeLaunchAbort = controller

  try {
    const target = await runUpdater(args, controller.signal)
    return { ok: true, target }
  } catch (error) {
    if (controller.signal.aborted) {
      emitLaunchProgress({
        phase: "error",
        message: "Update cancelled.",
        error: "Cancelled.",
      })
      return { ok: false, cancelled: true }
    }

    const message = error instanceof Error ? error.message : String(error)
    emitLaunchProgress({
      phase: "error",
      message: "Update failed.",
      error: message,
    })
    throw error
  } finally {
    if (activeLaunchAbort === controller) activeLaunchAbort = null
  }
})

ipcMain.handle("launch:cancel", () => {
  activeLaunchAbort?.abort()
  if (activeMinecraftProcess && !activeMinecraftProcess.killed) {
    activeMinecraftProcess.kill()
  }
  return { ok: true }
})

function validateOfflineUsername(username) {
  const trimmed = String(username ?? "").trim()
  if (!trimmed) return "Enter a username."
  if (!USERNAME_REGEX.test(trimmed)) {
    return "Use 3 to 16 characters: letters, numbers, or underscore."
  }
  return null
}

function createOfflineAccount(username) {
  const clean = String(username ?? "").trim()
  const error = validateOfflineUsername(clean)
  if (error) throw new Error(error)

  const uuid = offlineUuidFor(clean)
  return {
    id: uuid,
    type: "offline",
    username: clean,
    uuid,
    avatarUrl: minecraftHeadUrl(clean),
    addedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  }
}

function minecraftHeadUrl(username) {
  return `https://minotar.net/helm/${encodeURIComponent(username)}/64.png`
}

function offlineUuidFor(username) {
  const digest = crypto.createHash("md5").update(`OfflinePlayer:${username}`, "utf8").digest()
  const bytes = Buffer.from(digest)
  bytes[6] = (bytes[6] & 0x0f) | 0x30
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

async function readAccountsState() {
  try {
    const raw = await fs.readFile(accountsPath(), "utf8")
    const parsed = JSON.parse(raw)
    return sanitizeAccountsState(parsed)
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[aetherion] failed to read accounts.json", error)
    }
    return { activeId: null, accounts: [] }
  }
}

async function writeAccountsState(state) {
  const filePath = accountsPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(sanitizeAccountsState(state), null, 2)}\n`, "utf8")
}

function visibleAccountsState(state) {
  const accounts = (state?.accounts || []).filter((account) => account.type === "microsoft")
  const activeId = accounts.some((account) => account.id === state.activeId)
    ? state.activeId
    : accounts[0]?.id || null
  return { activeId, accounts }
}

function sanitizeAccountsState(value) {
  const accounts = Array.isArray(value?.accounts)
    ? value.accounts
        .filter((account) => {
          return (
            account &&
            (account.type === "offline" || account.type === "microsoft") &&
            typeof account.id === "string" &&
            typeof account.username === "string" &&
            typeof account.uuid === "string"
          )
        })
        .map((account) => ({
          id: account.id,
          type: account.type,
          username: account.username,
          uuid: account.uuid,
          avatarUrl:
            account.type === "offline" && isGeneratedAvatarUrl(account.avatarUrl)
              ? minecraftHeadUrl(account.username)
              : account.avatarUrl || minecraftHeadUrl(account.username),
          addedAt: account.addedAt,
          lastUsedAt: account.lastUsedAt,
        }))
    : []

  const activeId =
    typeof value?.activeId === "string" &&
    accounts.some((account) => account.id === value.activeId)
      ? value.activeId
      : accounts[0]?.id ?? null

  return { activeId, accounts }
}

function isGeneratedAvatarUrl(value) {
  return (
    typeof value !== "string" ||
    value.includes("mc-heads.net/avatar/") ||
    value.includes("minotar.net/helm/")
  )
}

function accountsPath() {
  return path.join(app.getPath("userData"), "accounts.json")
}

async function readLauncherSettings() {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8")
    return sanitizeLauncherSettings(JSON.parse(raw))
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[aetherion] failed to read launcher-settings.json", error)
    }
    const settings = sanitizeLauncherSettings(DEFAULT_SETTINGS)
    await writeLauncherSettings(settings).catch(() => undefined)
    return settings
  }
}

async function writeLauncherSettings(settings) {
  const filePath = settingsPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(sanitizeLauncherSettings(settings), null, 2)}\n`, "utf8")
}

function sanitizeLauncherSettings(value) {
  const minecraft = value?.minecraft || {}
  const java = value?.java || {}
  const launcher = value?.launcher || {}
  const width = clampNumber(minecraft.resolution?.width, 854, 7680, DEFAULT_SETTINGS.minecraft.resolution.width)
  const height = clampNumber(
    minecraft.resolution?.height,
    480,
    4320,
    DEFAULT_SETTINGS.minecraft.resolution.height,
  )
  const closeOnLaunch = Boolean(minecraft.closeOnLaunch)
  const instanceId = DEFAULT_MANIFEST.instanceId || "aetherion-main"
  const totalRam = systemRamMb()
  const minRamMb = clampNumber(java.minRamMb, 512, totalRam, DEFAULT_SETTINGS.java.minRamMb)
  const maxRamMb = clampNumber(
    java.maxRamMb,
    1024,
    totalRam,
    Math.min(DEFAULT_SETTINGS.java.maxRamMb, totalRam),
  )

  return {
    minecraft: {
      resolution: { width, height },
      fullscreen: Boolean(minecraft.fullscreen),
      autoConnectServer:
        minecraft.autoConnectServer === undefined
          ? DEFAULT_SETTINGS.minecraft.autoConnectServer
          : Boolean(minecraft.autoConnectServer),
      detachProcess: closeOnLaunch ? true : Boolean(minecraft.detachProcess),
      closeOnLaunch,
      gameDirectory:
        typeof minecraft.gameDirectory === "string" && minecraft.gameDirectory.trim()
          ? minecraft.gameDirectory
          : instancePath(instanceId),
    },
    java: {
      minRamMb: Math.min(minRamMb, maxRamMb),
      maxRamMb,
      executablePath: typeof java.executablePath === "string" ? java.executablePath : "",
      jvmArgs: typeof java.jvmArgs === "string" ? java.jvmArgs : "",
      autoDownloadRuntime:
        java.autoDownloadRuntime === undefined
          ? DEFAULT_SETTINGS.java.autoDownloadRuntime
          : Boolean(java.autoDownloadRuntime),
    },
    launcher: {
      updateChannel: "stable",
      manifestUrl:
        typeof launcher.manifestUrl === "string"
          ? launcher.manifestUrl.trim()
          : DEFAULT_SETTINGS.launcher.manifestUrl,
      dataDirectory:
        typeof launcher.dataDirectory === "string" && launcher.dataDirectory.trim()
          ? launcher.dataDirectory
          : app.getPath("userData"),
      minimizeToTray: Boolean(launcher.minimizeToTray),
      telemetry: Boolean(launcher.telemetry),
    },
  }
}

function systemRamMb() {
  return Math.max(1024, Math.floor(os.totalmem() / 1024 / 1024))
}

function settingsPath() {
  return path.join(app.getPath("userData"), "launcher-settings.json")
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base
  const output = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] || {}, value)
    } else {
      output[key] = value
    }
  }
  return output
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

async function runUpdater(args, signal) {
  const settings = await readLauncherSettings()
  const launchArgs = normalizeLaunchArgs(args, settings)

  emitLaunchProgress({
    phase: "fetching-manifest",
    message: "Fetching the Aetherion pack...",
  })

  const manifest = await loadManifest(settings, signal)
  validateManifest(manifest)

  const instanceId = manifest.instanceId || launchArgs.instanceId || "aetherion-main"
  const root = settings.minecraft.gameDirectory || instancePath(instanceId)
  await fs.mkdir(root, { recursive: true })

  emitLaunchProgress({
    phase: "computing-plan",
    message: `Scanning the local instance at ${root}`,
  })

  let [localState, installedHashes] = await Promise.all([
    readInstanceState(root, manifest, instanceId),
    scanInstalledHashes(root),
  ])
  localState = {
    ...localState,
    dropinMods: await scanDropinMods(root, localState.dropinMods),
  }
  throwIfAborted(signal)

  const plan = computeUpdatePlan(manifest, localState, installedHashes)

  if (plan.downloadCount === 0 && plan.removeCount === 0) {
    emitLaunchProgress({
      phase: "verifying",
      message: `Up to date: Minecraft ${manifest.minecraft} + Fabric ${manifest.loader.version}`,
      totalBytes: 0,
      loadedBytes: 0,
      filesDone: 0,
      filesTotal: 0,
    })
  } else {
    await executeUpdatePlan(root, plan, signal)
  }

  await ensureFabricProfile(root, manifest, signal)
  await applyIrisDefaults(root, manifest)
  const installedForgeSha = localState.installedForgeSha || null

  const nextState = {
    instanceId,
    installedManifestVersion: manifest.version,
    enabledOptionalMods: localState.enabledOptionalMods || {},
    dropinMods: localState.dropinMods || [],
    lastCheckedAt: new Date().toISOString(),
    installedForgeSha,
  }
  await writeInstanceState(root, nextState)

  const launchPlan = await buildMinecraftLaunchPlan(root, manifest, launchArgs, signal)
  if (!launchPlan.ready) {
    await prepareMinecraftRuntime(root, launchPlan, signal)
  }
  const finalLaunchPlan = await buildMinecraftLaunchPlan(root, manifest, launchArgs, signal)
  if (!finalLaunchPlan.ready) {
    throw new Error(
      `Still missing ${finalLaunchPlan.missing.length} file(s) before launch. First missing: ${finalLaunchPlan.missing[0]}`,
    )
  }
  const processInfo = await startMinecraft(finalLaunchPlan, signal)

  emitLaunchProgress({
    phase: "running",
    message: `Minecraft started (PID ${processInfo.pid}).`,
    totalBytes: plan.totalBytes,
    loadedBytes: plan.totalBytes,
    filesDone: plan.downloadCount,
    filesTotal: plan.downloadCount,
  })

  if (finalLaunchPlan.closeOnLaunch) {
    setTimeout(() => app.quit(), 700)
  }

  return {
    minecraft: manifest.minecraft,
    loader: manifest.loader.version,
    launchPlan: summarizeLaunchPlan(finalLaunchPlan),
    process: processInfo,
  }
}

function normalizeLaunchArgs(args, settings) {
  const minecraft = settings.minecraft
  return {
    ...args,
    fullscreen: Boolean(minecraft.fullscreen),
    width: minecraft.resolution.width,
    height: minecraft.resolution.height,
    autoConnectServer: Boolean(minecraft.autoConnectServer),
    detachProcess: Boolean(minecraft.detachProcess),
    closeOnLaunch: Boolean(minecraft.closeOnLaunch),
    java: settings.java,
  }
}

async function buildMinecraftLaunchPlan(root, manifest, args, signal) {
  emitLaunchProgress({
    phase: "launching",
    message: "Building the Minecraft launch plan...",
  })

  const profileId = fabricProfileId(manifest)
  const realm = packServer(manifest)
  const forgeProfilePath = path.join(root, "versions", profileId, `${profileId}.json`)
  const forgeProfile = await readJsonFile(forgeProfilePath)
  const parentId = forgeProfile.inheritsFrom || manifest.minecraft
  const parentProfile = await ensureMinecraftVersionJson(root, parentId, signal)
  const merged = mergeVersionProfiles(parentProfile, forgeProfile)
  if (!merged.mainClass) {
    throw new Error(`Profile ${profileId} does not include a mainClass, so Minecraft cannot start.`)
  }
  const account = await getLaunchAccount(args?.accountId)
  const session = await microsoftAuth.sessionForAccount(account)
  if (session.profile && session.profile.username !== account.username) {
    const state = await readAccountsState()
    const next = {
      ...state,
      accounts: state.accounts.map((candidate) =>
        candidate.id === account.id
          ? { ...candidate, username: session.profile.username, lastUsedAt: new Date().toISOString() }
          : candidate,
      ),
    }
    await writeAccountsState(next)
  }
  const java = await resolveJavaForSettings(
    args?.java,
    manifest.java?.minMajor || 21,
    manifest.java?.recommendedMajor || manifest.java?.minMajor || 21,
    true,
  )

  if (!java) {
    throw new Error("Java 21 was not found. Install Eclipse Temurin 21 or set JAVA_HOME.")
  }

  const libraryDirectory = path.join(root, "libraries")
  const assetsRoot = path.join(root, "assets")
  const nativesDirectory = path.join(root, "natives", profileId)
  const clientJar = path.join(root, "versions", parentId, `${parentId}.jar`)
  const libraryPlan = collectLibraries(root, merged.libraries)
  const includeVanillaClientJar = !isForgeProfile(forgeProfile)
  const classpathEntries = includeVanillaClientJar
    ? [...libraryPlan.classpath, clientJar]
    : libraryPlan.classpath
  const assetPlan = await collectAssetPlan(root, parentProfile.assetIndex)
  const variables = {
    auth_player_name: session.name,
    version_name: profileId,
    game_directory: root,
    assets_root: assetsRoot,
    assets_index_name: parentProfile.assetIndex?.id || parentId,
    resolution_width: args?.width || 1280,
    resolution_height: args?.height || 720,
    auth_uuid: session.uuid,
    auth_access_token: session.accessToken,
    clientid: "",
    auth_xuid: session.xuid || "",
    user_type: session.userType,
    version_type: forgeProfile.type || parentProfile.type || "release",
    natives_directory: nativesDirectory,
    launcher_name: LAUNCHER_NAME,
    launcher_version: LAUNCHER_VERSION,
    library_directory: libraryDirectory,
    classpath_separator: path.delimiter,
    classpath: classpathEntries.join(path.delimiter),
  }
  const javaSettings = sanitizeLauncherSettings({ java: args?.java }).java
  const memoryArgs = [
    `-Xms${javaSettings.minRamMb}M`,
    `-Xmx${javaSettings.maxRamMb}M`,
    `-XX:ErrorFile=${path.join(root, "logs", "hs_err_pid%p.log")}`,
    `-XX:HeapDumpPath=${path.join(root, "logs")}`,
    ...parseJvmArgs(javaSettings.jvmArgs),
  ]
  const jvmArgs = [
    ...memoryArgs,
    ...resolveArguments(merged.arguments.jvm, variables),
  ].filter(Boolean)
  const gameArgs = resolveArguments(merged.arguments.game, variables, {
    has_custom_resolution: true,
  })
  const directHost = String(args?.serverHost || "").trim()
  const directPort = Number(args?.serverPort)
  if (args?.fullscreen) gameArgs.push("--fullscreen")
  if (directHost) {
    gameArgs.push("--server", directHost)
    if (Number.isInteger(directPort) && directPort > 0) gameArgs.push("--port", String(directPort))
  } else if (args?.autoConnectServer) {
    gameArgs.push("--server", realm.host)
    gameArgs.push("--port", String(realm.port || AETHERION_SERVER_PORT))
  }
  await ensureMinecraftServerList(
    root,
    directHost
      ? {
          name: String(args?.serverName || "Aetherion Sandbox"),
          host: directHost,
          port: Number.isInteger(directPort) ? directPort : 25565,
        }
      : null,
  )
  const commandArgs = [...jvmArgs, merged.mainClass, ...gameArgs]
  const assetIndexPath = path.join(assetsRoot, "indexes", `${variables.assets_index_name}.json`)
  const missing = [
    ...libraryPlan.missing,
    ...libraryPlan.missingNatives,
    ...(includeVanillaClientJar && !fsSync.existsSync(clientJar)
      ? [toPosix(path.relative(root, clientJar))]
      : []),
    ...assetPlan.missing,
  ]

  const launchPlan = {
    ready: missing.length === 0,
    root,
    profileId,
    parentId,
    javaPath: java.path,
    javaVersion: java.version,
    mainClass: merged.mainClass,
    classpathEntries,
    includeVanillaClientJar,
    libraryArtifacts: libraryPlan.artifacts,
    nativeArtifacts: libraryPlan.nativeArtifacts,
    nativesDirectory,
    detachProcess: Boolean(args?.detachProcess),
    closeOnLaunch: Boolean(args?.closeOnLaunch),
    jvmArgs,
    gameArgs,
    commandArgs,
    missing,
    assetIndex: {
      id: variables.assets_index_name,
      path: assetIndexPath,
      url: parentProfile.assetIndex?.url || null,
      sha1: parentProfile.assetIndex?.sha1 || null,
      size: parentProfile.assetIndex?.size || null,
    },
    assetObjects: assetPlan.objects,
    missingAssetObjects: assetPlan.missingObjects,
  }

  console.log("[aetherion] launch plan", summarizeLaunchPlan(launchPlan))

  emitLaunchProgress({
    phase: "launching",
    message: launchPlan.ready
      ? `Ready to launch ${profileId} with ${libraryPlan.classpath.length} libraries.`
      : `Launch plan ready; ${missing.length} file(s) are still missing before spawn.`,
  })

  return launchPlan
}

function summarizeLaunchPlan(plan) {
  return {
    ready: plan.ready,
    profileId: plan.profileId,
    parentId: plan.parentId,
    javaPath: plan.javaPath,
    javaVersion: plan.javaVersion,
    mainClass: plan.mainClass,
    classpathEntries: plan.classpathEntries.length,
    includeVanillaClientJar: plan.includeVanillaClientJar,
    detachProcess: plan.detachProcess,
    closeOnLaunch: plan.closeOnLaunch,
    libraryArtifacts: plan.libraryArtifacts.length,
    nativeArtifacts: plan.nativeArtifacts.length,
    jvmArgs: plan.jvmArgs.length,
    gameArgs: plan.gameArgs.length,
    commandArgs: plan.commandArgs.length,
    assetIndex: plan.assetIndex.id,
    assetObjects: plan.assetObjects.length,
    missingAssetObjects: plan.missingAssetObjects,
    missing: plan.missing.slice(0, 20),
    missingCount: plan.missing.length,
  }
}

async function startMinecraft(launchPlan, signal) {
  throwIfAborted(signal)
  if (activeMinecraftProcess && !activeMinecraftProcess.killed) {
    throw new Error("Minecraft is already running.")
  }

  await fs.mkdir(path.join(launchPlan.root, "logs"), { recursive: true })
  const logPath = path.join(launchPlan.root, "logs", "aetherion-latest.log")
  const logStream = fsSync.createWriteStream(logPath, { flags: "w" })

  emitLaunchProgress({
    phase: "launching",
    message: "Launching Minecraft...",
  })

  console.log("[aetherion] starting minecraft", {
    javaPath: launchPlan.javaPath,
    cwd: launchPlan.root,
    args: launchPlan.commandArgs.length,
    logPath,
  })

  const child = spawn(launchPlan.javaPath, launchPlan.commandArgs, {
    cwd: launchPlan.root,
    detached: launchPlan.detachProcess,
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      AETHERION_INSTANCE_DIR: launchPlan.root,
    },
  })
  activeMinecraftProcess = child
  activeMinecraftDetached = Boolean(launchPlan.detachProcess)

  const writeLog = (chunk) => {
    const text = chunk.toString()
    logStream.write(text)
    const lastLine = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .pop()
    if (lastLine) console.log("[minecraft]", lastLine)
  }

  const runningMark = /Setting user:|LWJGL Version|OpenAL|Sound engine started|Backend library:/i
  const watchLog = (chunk) => {
    writeLog(chunk)
    if (runningMark.test(chunk.toString())) markRunning()
  }
  child.stdout.on("data", watchLog)
  child.stderr.on("data", watchLog)

  const abort = () => {
    if (!child.killed) child.kill()
  }
  signal?.addEventListener("abort", abort, { once: true })

  let markRunning = () => {}
  const processInfo = await new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(startedTimer)
      signal?.removeEventListener("abort", abort)
      fn(value)
    }
    markRunning = () => {
      if (settled || child.killed || child.exitCode != null) return
      if (launchPlan.detachProcess) child.unref()
      emitLaunchProgress({
        phase: "running",
        message: `Minecraft is running (PID ${child.pid}).`,
      })
      settle(resolve, { pid: child.pid, logPath })
    }
    const startedTimer = setTimeout(markRunning, 8000)

    child.on("error", (error) => {
      settle(reject, error)
    })
    child.on("close", async (code) => {
      logStream.end()
      if (activeMinecraftProcess === child) activeMinecraftProcess = null
      const diagnostics = await minecraftExitDiagnostics(launchPlan.root, logPath, code)

      if (!settled) {
        settle(
          code === 0 ? resolve : reject,
          code === 0
            ? { pid: child.pid, logPath, exitCode: code }
            : new Error(diagnostics.message),
        )
        return
      }

      if (code !== 0) {
        emitLaunchProgress({
          phase: "error",
          message: "Minecraft closed with an error.",
          error: diagnostics.message,
        })
      }
    })
  })

  return processInfo
}

async function minecraftExitDiagnostics(root, logPath, code) {
  const crashReport = await newestCrashReport(root)
  const logTail = await readTail(logPath, 18)
  const crashTail = crashReport ? await readTail(crashReport, 60) : ""
  const hints = []

  if (/java version "1[0-7]/.test(logTail) || /java version 1[0-7]\./i.test(logTail)) {
    hints.push("Minecraft 1.21.1 needs Java 21.")
  }
  if (/OptiFineTransformationService|OptiFineTransformer/i.test(logTail)) {
    hints.push("OptiFine was enabled. Turn OptiFine off under optional mods to test stability.")
  }
  if (
    /aether\.mixins\.json:client\.optifine|BossHealthOverlayMixin/i.test(logTail) ||
    /aether\.mixins\.json:client\.optifine|BossHealthOverlayMixin/i.test(crashTail)
  ) {
    hints.push(
      "Aether conflicts with OptiFine. JEI and Xaero can stay on, but turn OptiFine off to launch this modpack.",
    )
  }
  if (/HTTP\s+404|Not Found em https?:\/\//i.test(logTail)) {
    hints.push("A 404 was found in the log. Run Verify integrity to download the files again.")
  }

  const parts = [`Minecraft exited early with code ${code}.`]
  if (crashReport) parts.push(`Crash report: ${crashReport}`)
  parts.push(`Log: ${logPath}`)
  if (hints.length) parts.push(`Possible cause: ${hints.join(" ")}`)
  if (logTail) parts.push(`Last lines:\n${logTail}`)

  return { message: parts.join("\n\n"), crashReport, logPath, logTail }
}

async function newestCrashReport(root) {
  const crashDir = path.join(root, "crash-reports")
  const entries = await fs.readdir(crashDir, { withFileTypes: true }).catch(() => [])
  const reports = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".txt")) continue
    const fullPath = path.join(crashDir, entry.name)
    const info = await fs.stat(fullPath).catch(() => null)
    if (info) reports.push({ path: fullPath, mtimeMs: info.mtimeMs })
  }
  return reports.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.path || null
}

async function readTail(filePath, maxLines) {
  const text = await fs.readFile(filePath, "utf8").catch(() => "")
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-maxLines)
    .join("\n")
}

async function ensureMinecraftServerList(root, extra) {
  const serversPath = path.join(root, "servers.dat")
  let rootTag = null
  let compressed = true

  try {
    const file = await fs.readFile(serversPath)
    const decoded = decodeMaybeCompressedNbt(file)
    rootTag = decoded.root
    compressed = decoded.compressed
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[aetherion] failed to read servers.dat, recreating", error)
    }
  }

  if (!rootTag || rootTag.type !== 10 || !rootTag.value || typeof rootTag.value !== "object") {
    rootTag = {
      type: 10,
      name: "",
      value: {
        servers: { type: 9, value: { itemType: 10, value: [] } },
      },
    }
  }

  const servers = rootTag.value.servers
  if (
    !servers ||
    servers.type !== 9 ||
    servers.value?.itemType !== 10 ||
    !Array.isArray(servers.value?.value)
  ) {
    rootTag.value.servers = { type: 9, value: { itemType: 10, value: [] } }
  }

  const list = rootTag.value.servers.value.value
  const wanted = [{ name: AETHERION_SERVER_NAME, ip: AETHERION_SERVER_HOST }]
  if (extra?.host) {
    const port = Number(extra.port)
    const ip = Number.isInteger(port) && port > 0 && port !== 25565 ? `${extra.host}:${port}` : extra.host
    wanted.push({ name: extra.name || "Aetherion Sandbox", ip })
  }

  let changed = false
  for (const entry of wanted) {
    const key = entry.ip.toLowerCase()
    const index = list.findIndex((server) => String(server?.ip?.value || "").toLowerCase() === key)
    const tag = {
      name: { type: 8, value: entry.name },
      ip: { type: 8, value: entry.ip },
      acceptTextures: { type: 1, value: 1 },
    }
    if (index >= 0) {
      if (list[index]?.name?.value !== entry.name) {
        list[index] = { ...list[index], ...tag }
        changed = true
      }
    } else {
      list.unshift(tag)
      changed = true
    }
  }

  if (!changed && fsSync.existsSync(serversPath)) return
  await fs.writeFile(serversPath, encodeMaybeCompressedNbt(rootTag, compressed))
}

function decodeMaybeCompressedNbt(buffer) {
  const compressed = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b
  const payload = compressed ? zlib.gunzipSync(buffer) : buffer
  return { root: readNbtRoot(payload), compressed }
}

function encodeMaybeCompressedNbt(rootTag, compressed) {
  const payload = writeNbtRoot(rootTag)
  return compressed ? zlib.gzipSync(payload) : payload
}

function readNbtRoot(buffer) {
  const cursor = { offset: 0 }
  const type = readUInt8(buffer, cursor)
  const name = readNbtString(buffer, cursor)
  return { type, name, value: readNbtPayload(buffer, cursor, type) }
}

function readNbtPayload(buffer, cursor, type) {
  switch (type) {
    case 0:
      return null
    case 1:
      return readInt8(buffer, cursor)
    case 2:
      return readInt16(buffer, cursor)
    case 3:
      return readInt32(buffer, cursor)
    case 4:
      return readBigInt64(buffer, cursor)
    case 5:
      return readFloat(buffer, cursor)
    case 6:
      return readDouble(buffer, cursor)
    case 7: {
      const length = readInt32(buffer, cursor)
      const value = buffer.subarray(cursor.offset, cursor.offset + length)
      cursor.offset += length
      return Buffer.from(value)
    }
    case 8:
      return readNbtString(buffer, cursor)
    case 9: {
      const itemType = readUInt8(buffer, cursor)
      const length = readInt32(buffer, cursor)
      const value = []
      for (let index = 0; index < length; index++) {
        value.push(readNbtPayload(buffer, cursor, itemType))
      }
      return { itemType, value }
    }
    case 10: {
      const value = {}
      while (true) {
        const childType = readUInt8(buffer, cursor)
        if (childType === 0) break
        const name = readNbtString(buffer, cursor)
        value[name] = { type: childType, value: readNbtPayload(buffer, cursor, childType) }
      }
      return value
    }
    case 11: {
      const length = readInt32(buffer, cursor)
      const value = []
      for (let index = 0; index < length; index++) value.push(readInt32(buffer, cursor))
      return value
    }
    case 12: {
      const length = readInt32(buffer, cursor)
      const value = []
      for (let index = 0; index < length; index++) value.push(readBigInt64(buffer, cursor))
      return value
    }
    default:
      throw new Error(`Unsupported NBT tag: ${type}`)
  }
}

function writeNbtRoot(rootTag) {
  const chunks = [Buffer.from([rootTag.type]), writeNbtString(rootTag.name || "")]
  chunks.push(writeNbtPayload(rootTag.type, rootTag.value))
  return Buffer.concat(chunks)
}

function writeNbtPayload(type, value) {
  switch (type) {
    case 0:
      return Buffer.alloc(0)
    case 1:
      return writeInt8(value)
    case 2:
      return writeInt16(value)
    case 3:
      return writeInt32(value)
    case 4:
      return writeBigInt64(value)
    case 5:
      return writeFloat(value)
    case 6:
      return writeDouble(value)
    case 7:
      return Buffer.concat([writeInt32(value?.length || 0), Buffer.from(value || [])])
    case 8:
      return writeNbtString(value || "")
    case 9: {
      const itemType = value?.itemType ?? 10
      const items = Array.isArray(value?.value) ? value.value : []
      return Buffer.concat([
        Buffer.from([itemType]),
        writeInt32(items.length),
        ...items.map((item) => writeNbtPayload(itemType, item)),
      ])
    }
    case 10: {
      const chunks = []
      for (const [name, child] of Object.entries(value || {})) {
        chunks.push(Buffer.from([child.type]), writeNbtString(name), writeNbtPayload(child.type, child.value))
      }
      chunks.push(Buffer.from([0]))
      return Buffer.concat(chunks)
    }
    case 11:
      return Buffer.concat([writeInt32(value?.length || 0), ...(value || []).map(writeInt32)])
    case 12:
      return Buffer.concat([writeInt32(value?.length || 0), ...(value || []).map(writeBigInt64)])
    default:
      throw new Error(`Unsupported NBT tag: ${type}`)
  }
}

function readUInt8(buffer, cursor) {
  return buffer.readUInt8(cursor.offset++)
}

function readInt8(buffer, cursor) {
  return buffer.readInt8(cursor.offset++)
}

function readInt16(buffer, cursor) {
  const value = buffer.readInt16BE(cursor.offset)
  cursor.offset += 2
  return value
}

function readInt32(buffer, cursor) {
  const value = buffer.readInt32BE(cursor.offset)
  cursor.offset += 4
  return value
}

function readBigInt64(buffer, cursor) {
  const value = buffer.readBigInt64BE(cursor.offset)
  cursor.offset += 8
  return value
}

function readFloat(buffer, cursor) {
  const value = buffer.readFloatBE(cursor.offset)
  cursor.offset += 4
  return value
}

function readDouble(buffer, cursor) {
  const value = buffer.readDoubleBE(cursor.offset)
  cursor.offset += 8
  return value
}

function readNbtString(buffer, cursor) {
  const length = buffer.readUInt16BE(cursor.offset)
  cursor.offset += 2
  const value = buffer.subarray(cursor.offset, cursor.offset + length).toString("utf8")
  cursor.offset += length
  return value
}

function writeInt8(value) {
  const buffer = Buffer.alloc(1)
  buffer.writeInt8(Number(value || 0))
  return buffer
}

function writeInt16(value) {
  const buffer = Buffer.alloc(2)
  buffer.writeInt16BE(Number(value || 0))
  return buffer
}

function writeInt32(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeInt32BE(Number(value || 0))
  return buffer
}

function writeBigInt64(value) {
  const buffer = Buffer.alloc(8)
  buffer.writeBigInt64BE(BigInt(value || 0))
  return buffer
}

function writeFloat(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeFloatBE(Number(value || 0))
  return buffer
}

function writeDouble(value) {
  const buffer = Buffer.alloc(8)
  buffer.writeDoubleBE(Number(value || 0))
  return buffer
}

function writeNbtString(value) {
  const text = Buffer.from(String(value || ""), "utf8")
  return Buffer.concat([writeUInt16(text.length), text])
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16BE(Number(value || 0))
  return buffer
}

async function prepareMinecraftRuntime(root, launchPlan, signal) {
  const artifacts = uniqueArtifacts([
    ...launchPlan.libraryArtifacts,
    ...launchPlan.nativeArtifacts,
  ])
  const libraryDownloads = []

  for (const artifact of artifacts) {
    if (!(await fileMatchesHash(artifact.path, artifact.sha1, "sha1"))) {
      libraryDownloads.push(artifact)
    }
  }

  const indexDownloads = []
  if (
    launchPlan.assetIndex.url &&
    !(await fileMatchesHash(launchPlan.assetIndex.path, launchPlan.assetIndex.sha1, "sha1"))
  ) {
    indexDownloads.push({
      path: launchPlan.assetIndex.path,
      url: launchPlan.assetIndex.url,
      sha1: launchPlan.assetIndex.sha1,
      size: launchPlan.assetIndex.size || 0,
      label: `asset index ${launchPlan.assetIndex.id}`,
    })
  }

  const firstBatch = [...libraryDownloads, ...indexDownloads]
  await downloadRuntimeArtifacts(firstBatch, signal, "Downloading libraries and the asset index")

  const assetIndex = await readJsonFile(launchPlan.assetIndex.path)
  const assetDownloads = []
  for (const [name, object] of Object.entries(assetIndex.objects || {})) {
    if (!object?.hash) continue
    const asset = assetObjectArtifact(root, name, object)
    if (!(await fileMatchesHash(asset.path, asset.sha1, "sha1"))) {
      assetDownloads.push(asset)
    }
  }

  await downloadRuntimeArtifacts(assetDownloads, signal, "Downloading Minecraft assets")
  await ensureNativesExtracted(launchPlan, signal)
}

async function downloadRuntimeArtifacts(artifacts, signal, label) {
  if (!artifacts.length) return

  let loadedBytes = 0
  let filesDone = 0
  const totalBytes = artifacts.reduce((total, artifact) => total + (artifact.size || 0), 0)

  emitLaunchProgress({
    phase: "downloading-files",
    message: `${label}...`,
    totalBytes,
    loadedBytes,
    filesDone,
    filesTotal: artifacts.length,
  })

  await runWithConcurrency(artifacts, 8, async (artifact) => {
    await downloadArtifactWithRetry(artifact, signal, (delta) => {
      loadedBytes += delta
      emitLaunchProgress({
        phase: "downloading-files",
        message: `Downloading ${artifact.label || displayName(artifact.path)}...`,
        totalBytes,
        loadedBytes,
        filesDone,
        filesTotal: artifacts.length,
      })
    })
    filesDone++
    emitLaunchProgress({
      phase: "downloading-files",
      message: `${artifact.label || displayName(artifact.path)} complete.`,
      totalBytes,
      loadedBytes,
      filesDone,
      filesTotal: artifacts.length,
    })
  })
}

async function downloadArtifactWithRetry(artifact, signal, onBytes) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await downloadArtifact(artifact, signal, onBytes)
      return
    } catch (error) {
      await fs.rm(`${artifact.path}.download`, { force: true }).catch(() => undefined)
      if (signal.aborted || attempt === 3) throw error
      await sleep([1000, 3000, 9000][attempt - 1])
    }
  }
}

async function downloadArtifact(artifact, signal, onBytes) {
  if (!artifact.url) throw new Error(`Artifact is missing a URL: ${artifact.label || artifact.path}`)

  const temp = `${artifact.path}.download`
  await fs.mkdir(path.dirname(artifact.path), { recursive: true })
  await downloadUrlToTemp(artifact.url, temp, "sha1", artifact.sha1, signal, onBytes)
  await fs.rm(artifact.path, { force: true })
  await fs.rename(temp, artifact.path)
}

async function ensureNativesExtracted(launchPlan, signal) {
  if (!launchPlan.nativeArtifacts.length) return

  const statePath = path.join(launchPlan.nativesDirectory, ".aetherion-natives.json")
  const expectedState = JSON.stringify(
    launchPlan.nativeArtifacts.map((artifact) => ({
      path: toPosix(path.relative(launchPlan.root, artifact.path)),
      sha1: artifact.sha1,
    })),
  )

  try {
    const current = await fs.readFile(statePath, "utf8")
    if (current === expectedState) return
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[aetherion] failed to read natives state", error)
    }
  }

  emitLaunchProgress({
    phase: "verifying",
    message: "Extracting Minecraft natives...",
  })

  await fs.rm(launchPlan.nativesDirectory, { recursive: true, force: true })
  await fs.mkdir(launchPlan.nativesDirectory, { recursive: true })

  for (const artifact of launchPlan.nativeArtifacts) {
    await extractZipToDirectory(artifact.path, launchPlan.nativesDirectory, artifact.exclude || [], signal)
  }

  await fs.writeFile(statePath, expectedState, "utf8")
}

async function extractZipToDirectory(zipPath, targetDir, excludes, signal) {
  throwIfAborted(signal)
  const buffer = await fs.readFile(zipPath)
  const entries = readZipCentralDirectory(buffer)

  for (const entry of entries) {
    throwIfAborted(signal)
    if (!shouldExtractZipEntry(entry.name, excludes)) continue

    const target = safeResolve(targetDir, entry.name)
    if (entry.directory) {
      await fs.mkdir(target, { recursive: true })
      continue
    }

    const content = inflateZipEntry(buffer, entry)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }
}

function readZipCentralDirectory(buffer) {
  const endOffset = findZipEndOfCentralDirectory(buffer)
  if (endOffset < 0) throw new Error("Invalid ZIP file: end of central directory was not found.")

  const centralSize = buffer.readUInt32LE(endOffset + 12)
  const centralOffset = buffer.readUInt32LE(endOffset + 16)
  const entries = []
  let offset = centralOffset
  const end = centralOffset + centralSize

  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid ZIP file: central directory is corrupt.")
    }

    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const filenameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer
      .subarray(offset + 46, offset + 46 + filenameLength)
      .toString(flags & 0x0800 ? "utf8" : "utf8")
      .replace(/\\/g, "/")

    entries.push({
      name,
      method,
      compressedSize,
      localHeaderOffset,
      directory: name.endsWith("/"),
    })
    offset += 46 + filenameLength + extraLength + commentLength
  }

  return entries
}

function findZipEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22)
  for (let offset = buffer.length - 22; offset >= min; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset
  }
  return -1
}

function inflateZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP file: local header is missing for ${entry.name}`)
  }

  const filenameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const dataStart = offset + 30 + filenameLength + extraLength
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize)

  if (entry.method === 0) return Buffer.from(compressed)
  if (entry.method === 8) return zlib.inflateRawSync(compressed)
  throw new Error(`Unsupported ZIP method (${entry.method}) for ${entry.name}`)
}

function shouldExtractZipEntry(entryName, excludes) {
  if (!entryName || entryName.includes("\0")) return false
  if (entryName.startsWith("/") || /^[a-zA-Z]:\//.test(entryName)) return false
  if (entryName.split("/").some((part) => part === "..")) return false
  return !(excludes || []).some((pattern) => entryName.startsWith(String(pattern).replace(/\\/g, "/")))
}

async function getLaunchAccount(accountId) {
  const state = await readAccountsState()
  const account =
    state.accounts.find((candidate) => candidate.id === accountId) ||
    state.accounts.find((candidate) => candidate.id === state.activeId)

  if (!account || account.type !== "microsoft") {
    throw new Error("Sign in with Microsoft before playing.")
  }

  return account
}

async function ensureMinecraftVersionJson(root, versionId, signal) {
  const versionPath = path.join(root, "versions", versionId, `${versionId}.json`)
  if (fsSync.existsSync(versionPath)) return readJsonFile(versionPath)

  emitLaunchProgress({
    phase: "fetching-manifest",
    message: `Downloading vanilla metadata for ${versionId}...`,
  })

  const manifest = await fetchJson(MOJANG_VERSION_MANIFEST, signal)
  const version = manifest.versions?.find((candidate) => candidate.id === versionId)
  if (!version?.url) {
    throw new Error(`Minecraft version ${versionId} was not found in the Mojang manifest.`)
  }

  const profile = await fetchJson(version.url, signal)
  await fs.mkdir(path.dirname(versionPath), { recursive: true })
  await fs.writeFile(versionPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8")
  return profile
}

async function fetchJson(url, signal) {
  throwIfAborted(signal)
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
    redirect: "follow",
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} at ${url}`)
  }
  return response.json()
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

function mergeVersionProfiles(parent, child) {
  return {
    mainClass: child.mainClass || parent.mainClass,
    type: child.type || parent.type,
    libraries: [...(parent.libraries || []), ...(child.libraries || [])],
    arguments: {
      jvm: [
        ...normalizeArguments(parent.arguments?.jvm),
        ...normalizeArguments(child.arguments?.jvm),
      ],
      game: [
        ...normalizeArguments(parent.arguments?.game || parent.minecraftArguments),
        ...normalizeArguments(child.arguments?.game || child.minecraftArguments),
      ],
    },
  }
}

function isForgeProfile(profile) {
  const gameArgs = normalizeArguments(profile.arguments?.game || profile.minecraftArguments)
  return gameArgs.some((arg) => arg === "forgeclient" || arg === "--fml.forgeVersion")
}

function normalizeArguments(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean)
  return []
}

function collectLibraries(root, libraries) {
  const artifacts = []
  const classpath = []
  const nativeArtifacts = []
  const missing = []
  const missingNatives = []

  for (const library of libraries || []) {
    if (!isAllowedByRules(library.rules)) continue

    const artifact = libraryArtifactFromDownload(root, library, library.downloads?.artifact)
    if (artifact) {
      if (isNativeLibrary(library, artifact.relativePath)) {
        nativeArtifacts.push(artifact)
        if (!fsSync.existsSync(artifact.path)) missingNatives.push(artifact.relativePath)
      } else {
        artifacts.push(artifact)
        classpath.push(artifact.path)
        if (!fsSync.existsSync(artifact.path)) missing.push(artifact.relativePath)
      }
    }

    const nativeClassifier = nativeClassifierFor(library)
    const native = nativeClassifier ? library.downloads?.classifiers?.[nativeClassifier] : null
    if (native) {
      const nativeArtifact = libraryArtifactFromDownload(root, library, native)
      if (nativeArtifact) {
        nativeArtifacts.push({
          ...nativeArtifact,
          exclude: library.extract?.exclude || [],
        })
        if (!fsSync.existsSync(nativeArtifact.path)) missingNatives.push(nativeArtifact.relativePath)
      }
    }
  }

  return { artifacts, classpath, nativeArtifacts, missing, missingNatives }
}

async function collectAssetPlan(root, assetIndex) {
  if (!assetIndex?.id || !assetIndex?.url) {
    return { objects: [], missing: [], missingObjects: 0 }
  }

  const indexPath = path.join(root, "assets", "indexes", `${assetIndex.id}.json`)
  if (!fsSync.existsSync(indexPath)) {
    return {
      objects: [],
      missing: [toPosix(path.relative(root, indexPath))],
      missingObjects: 0,
    }
  }

  const index = await readJsonFile(indexPath)
  const objects = []
  const missing = []
  for (const [name, object] of Object.entries(index.objects || {})) {
    if (!object?.hash) continue
    const artifact = assetObjectArtifact(root, name, object)
    objects.push(artifact)
    if (!fsSync.existsSync(artifact.path)) missing.push(artifact.relativePath)
  }

  return { objects, missing, missingObjects: missing.length }
}

function libraryArtifactFromDownload(root, library, download) {
  const artifactPath = download?.path || mavenPathFromName(library.name)
  if (!artifactPath) return null

  const url = download?.url || libraryUrlFor(library, artifactPath)
  const absolute = path.join(root, "libraries", ...artifactPath.split("/"))
  return {
    path: absolute,
    relativePath: toPosix(path.relative(root, absolute)),
    url,
    sha1: download?.sha1 || null,
    size: download?.size || 0,
    label: library.name || artifactPath,
  }
}

function libraryUrlFor(library, artifactPath) {
  const base = library.url || "https://libraries.minecraft.net/"
  return `${String(base).replace(/\/?$/, "/")}${artifactPath}`
}

function isNativeLibrary(library, artifactPath) {
  return (
    Boolean(library.natives) ||
    /(^|-)natives-/.test(library.name || "") ||
    /(^|-)natives-/.test(artifactPath || "")
  )
}

function assetObjectArtifact(root, name, object) {
  const hash = object.hash
  const shard = hash.slice(0, 2)
  const absolute = path.join(root, "assets", "objects", shard, hash)
  return {
    path: absolute,
    relativePath: toPosix(path.relative(root, absolute)),
    url: `${MINECRAFT_RESOURCES_BASE}/${shard}/${hash}`,
    sha1: hash,
    size: object.size || 0,
    label: name,
  }
}

function uniqueArtifacts(artifacts) {
  const byPath = new Map()
  for (const artifact of artifacts) {
    if (!artifact?.path) continue
    byPath.set(artifact.path, artifact)
  }
  return [...byPath.values()]
}

function resolveArguments(args, variables, features = {}) {
  const resolved = []

  for (const arg of args || []) {
    if (typeof arg === "string") {
      resolved.push(applyVariables(arg, variables))
      continue
    }

    if (!arg || typeof arg !== "object") continue
    if (!isAllowedByRules(arg.rules, { features })) continue

    for (const value of flattenArgumentValue(arg.value)) {
      resolved.push(applyVariables(value, variables))
    }
  }

  return resolved
}

function flattenArgumentValue(value) {
  if (Array.isArray(value)) return value.flatMap(flattenArgumentValue)
  if (typeof value === "string") return [value]
  return []
}

function applyVariables(value, variables) {
  return String(value).replace(/\$\{([^}]+)\}/g, (_match, key) => {
    const replacement = variables[key]
    return replacement === undefined || replacement === null ? "" : String(replacement)
  })
}

function nativeClassifierFor(library) {
  const osName = getMinecraftOsName()
  const classifier = library.natives?.[osName]
  if (!classifier) return null
  return classifier.replace("${arch}", process.arch === "x64" ? "64" : "32")
}

function isAllowedByRules(rules, options = {}) {
  if (!Array.isArray(rules) || rules.length === 0) return true

  let allowed = false
  for (const rule of rules) {
    if (!ruleMatches(rule, options)) continue
    allowed = rule.action === "allow"
  }
  return allowed
}

function ruleMatches(rule, options) {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== getMinecraftOsName()) return false
    if (rule.os.arch && rule.os.arch !== process.arch) return false
  }

  if (rule.features) {
    for (const [feature, expected] of Object.entries(rule.features)) {
      if (Boolean(options.features?.[feature]) !== Boolean(expected)) return false
    }
  }
  return true
}

function getMinecraftOsName() {
  if (process.platform === "win32") return "windows"
  if (process.platform === "darwin") return "osx"
  return "linux"
}

function mavenPathFromName(name) {
  if (!name || typeof name !== "string") return null
  const [group, artifact, version, classifierPart] = name.split(":")
  if (!group || !artifact || !version) return null

  const classifier = classifierPart ? `-${classifierPart.replace(/^@/, "")}` : ""
  const extension = classifierPart?.startsWith("@") ? classifierPart.slice(1) : "jar"
  return `${group.replace(/\./g, "/")}/${artifact}/${version}/${artifact}-${version}${classifier}.${extension}`
}

async function ensureFabricProfile(root, manifest, signal) {
  const profileId = fabricProfileId(manifest)
  const jsonPath = path.join(root, "versions", profileId, `${profileId}.json`)
  if (fsSync.existsSync(jsonPath)) {
    emitLaunchProgress({
      phase: "installing-forge",
      message: `Fabric ${manifest.loader.version} is already installed.`,
    })
    return profileId
  }

  emitLaunchProgress({
    phase: "installing-forge",
    message: `Fetching Fabric ${manifest.loader.version} for Minecraft ${manifest.minecraft}...`,
  })
  const url = `https://meta.fabricmc.net/v2/versions/loader/${manifest.minecraft}/${manifest.loader.version}/profile/json`
  const profile = await fetchJson(url, signal)
  await fs.mkdir(path.dirname(jsonPath), { recursive: true })
  await fs.writeFile(jsonPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8")
  emitLaunchProgress({
    phase: "installing-forge",
    message: `Fabric ${manifest.loader.version} is ready.`,
  })
  return profileId
}

async function applyIrisDefaults(root, manifest) {
  const enabled = (manifest.shaderpacks || []).find((shader) => shader && shader.enable !== false)
  if (!enabled?.filename) return
  const configDir = path.join(root, "config")
  await fs.mkdir(configDir, { recursive: true })
  const irisPath = path.join(configDir, "iris.properties")
  let iris = ""
  try {
    iris = await fs.readFile(irisPath, "utf8")
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
  const shaderLine = `shaderPack=${enabled.filename}`
  if (/^shaderPack=.*/m.test(iris)) iris = iris.replace(/^shaderPack=.*/m, shaderLine)
  else iris = `${iris.trim()}\n${shaderLine}\n`
  if (/^enableShaders=.*/m.test(iris)) iris = iris.replace(/^enableShaders=.*/m, "enableShaders=true")
  else iris += "enableShaders=true\n"
  if (!iris.endsWith("\n")) iris += "\n"
  await fs.writeFile(irisPath, iris, "utf8")
}


async function ensureLauncherProfile(root) {
  const profilePath = path.join(root, "launcher_profiles.json")
  if (fsSync.existsSync(profilePath)) return

  const profile = {
    profiles: {},
    selectedProfile: "",
    clientToken: crypto.randomUUID(),
    authenticationDatabase: {},
    launcherVersion: {
      name: "Aetherion Launcher",
      format: 21,
      profilesFormat: 2,
    },
  }

  await fs.writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8")
}

async function loadManifest(_settings, signal) {
  const url = String(process.env.AETHERION_MANIFEST_URL || "").trim()
  if (url) {
    const cacheBust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`
    const response = await fetch(cacheBust, {
      signal,
      headers: { Accept: "application/json" },
      redirect: "follow",
    })
    if (!response.ok) {
      throw new Error(`Could not fetch the manifest (${response.status} ${response.statusText})`)
    }
    const manifest = normalizePackManifest(await response.json())
    assertClientPack(manifest)
    return manifest
  }

  const candidates = [
    path.join(app.getAppPath(), "out", "manifest.json"),
    path.join(app.getAppPath(), "public", "manifest.json"),
    path.resolve(process.cwd(), "public", "manifest.json"),
  ]
  for (const candidate of candidates) {
    if (!fsSync.existsSync(candidate)) continue
    console.log("[aetherion] using bundled pack", candidate)
    const manifest = normalizePackManifest(await readJsonFile(candidate))
    assertClientPack(manifest)
    return manifest
  }

  throw new Error("The Aetherion 1.21.1 Fabric pack is missing from this build.")
}

function validateManifest(manifest) {
  assertClientPack(manifest)
}

async function readInstanceState(root, manifest, instanceId) {
  try {
    const raw = await fs.readFile(instanceStatePath(root), "utf8")
    const parsed = JSON.parse(raw)
    return {
      instanceId,
      installedManifestVersion: parsed.installedManifestVersion ?? null,
      enabledOptionalMods: parsed.enabledOptionalMods || {},
      dropinMods: Array.isArray(parsed.dropinMods) ? parsed.dropinMods : [],
      lastCheckedAt: parsed.lastCheckedAt,
      installedForgeSha: parsed.installedForgeSha,
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[aetherion] failed to read instance-state.json", error)
    }
    return {
      instanceId,
      installedManifestVersion: null,
      enabledOptionalMods: {},
      dropinMods: [],
      installedForgeSha: null,
    }
  }
}

async function writeInstanceState(root, state) {
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(instanceStatePath(root), `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

async function currentInstanceRoot() {
  const settings = await readLauncherSettings()
  return settings.minecraft.gameDirectory || instancePath(DEFAULT_MANIFEST.instanceId || "aetherion-main")
}

function dropinDir(root) {
  return path.join(root, "mods", "dropin")
}

function sanitizeDropinFilename(value) {
  const filename = path.basename(String(value || "").trim())
  if (!/\.jar$/i.test(filename)) throw new Error("A drop-in mod must be a .jar file.")
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
}

async function refreshDropinState(root) {
  const instanceId = DEFAULT_MANIFEST.instanceId || "aetherion-main"
  const state = await readInstanceState(root, DEFAULT_MANIFEST, instanceId)
  const dropinMods = await scanDropinMods(root, state.dropinMods)
  const next = { ...state, instanceId, dropinMods }
  await writeInstanceState(root, next)
  return dropinMods
}

async function scanDropinMods(root, knownMods = []) {
  const dir = dropinDir(root)
  await fs.mkdir(dir, { recursive: true })
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const known = new Map((knownMods || []).map((mod) => [mod.filename, mod]))
  const byFilename = new Map()

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const lower = entry.name.toLowerCase()
    const enabled = lower.endsWith(".jar")
    const disabled = lower.endsWith(".jar.disabled")
    if (!enabled && !disabled) continue

    const filename = disabled ? entry.name.slice(0, -".disabled".length) : entry.name
    if (!/\.jar$/i.test(filename)) continue

    const filePath = path.join(dir, entry.name)
    const stat = await fs.stat(filePath)
    const previous = known.get(filename)
    const record = {
      filename,
      size: stat.size,
      enabled,
      addedAt: previous?.addedAt || stat.birthtime?.toISOString() || new Date().toISOString(),
    }

    const current = byFilename.get(filename)
    if (!current || record.enabled) byFilename.set(filename, record)
  }

  return [...byFilename.values()].sort((a, b) => a.filename.localeCompare(b.filename))
}

function computeUpdatePlan(manifest, local, installedHashes) {
  const actions = []
  const needsForgeInstall = false

  const validPaths = new Set()
  for (const file of manifest.files) {
    validPaths.add(file.path)

    if (file.type === "optional") {
      const enabled =
        local.enabledOptionalMods?.[file.path] !== undefined
          ? local.enabledOptionalMods[file.path]
          : file.defaultEnabled ?? false
      if (!enabled) {
        if (installedHashes[file.path]) {
          actions.push({ kind: "remove", path: file.path, reason: "optional-disabled" })
        }
        continue
      }
    }

    const installed = installedHashes[file.path]
    const expected = String(file.sha256 || "")
    if (installed && (!expected || installed.toLowerCase() === expected.toLowerCase())) {
      actions.push({ kind: "skip", path: file.path, reason: "hash-match" })
    } else {
      actions.push({
        kind: "download",
        path: file.path,
        url: file.url,
        sha256: expected,
        size: file.size || 0,
        category: file.type,
      })
    }
  }

  const protectedPatterns = manifest.protectedPatterns || []
  const dropinSet = new Set((local.dropinMods || []).map((mod) => `mods/${mod.filename}`))
  for (const filePath of Object.keys(installedHashes)) {
    if (validPaths.has(filePath)) continue
    if (filePath.startsWith("forge/")) continue
    if (filePath.startsWith("mods/dropin/")) continue
    if (filePath.startsWith("shaderpacks/")) continue
    if (dropinSet.has(filePath)) continue
    if (isProtected(filePath, protectedPatterns)) continue
    actions.push({ kind: "remove", path: filePath, reason: "orphan" })
  }

  const downloads = actions.filter((action) => action.kind === "download")
  return {
    manifestVersion: manifest.version,
    fromVersion: local.installedManifestVersion,
    actions,
    totalBytes: downloads.reduce((total, action) => total + (action.size || 0), 0),
    downloadCount: downloads.length,
    removeCount: actions.filter((action) => action.kind === "remove").length,
    needsForgeInstall,
  }
}

async function executeUpdatePlan(root, plan, signal) {
  const downloads = plan.actions.filter((action) => action.kind === "download")
  const removals = plan.actions.filter((action) => action.kind === "remove")
  let loadedBytes = 0
  let filesDone = 0

  emitLaunchProgress({
    phase: "downloading-files",
    message: downloads.length ? "Downloading files..." : "No downloads needed.",
    totalBytes: plan.totalBytes,
    loadedBytes,
    filesDone,
    filesTotal: downloads.length,
  })

  await runWithConcurrency(downloads, 4, async (action) => {
    await downloadAction(root, action, signal, (delta) => {
      loadedBytes += delta
      emitLaunchProgress({
        phase: "downloading-files",
        message: `Downloading ${displayName(action.path)}...`,
        totalBytes: plan.totalBytes,
        loadedBytes,
        filesDone,
        filesTotal: downloads.length,
      })
    })
    filesDone++
    emitLaunchProgress({
      phase: "downloading-files",
      message: `${displayName(action.path)} complete.`,
      totalBytes: plan.totalBytes,
      loadedBytes,
      filesDone,
      filesTotal: downloads.length,
    })
  })

  if (removals.length) {
    emitLaunchProgress({
      phase: "verifying",
      message: "Removing old files...",
      totalBytes: plan.totalBytes,
      loadedBytes,
      filesDone,
      filesTotal: downloads.length,
    })
    for (const action of removals) {
      await fs.rm(safeResolve(root, action.path), { force: true })
    }
  }

  emitLaunchProgress({
    phase: "verifying",
    message: "Verification complete.",
    totalBytes: plan.totalBytes,
    loadedBytes: plan.totalBytes,
    filesDone: downloads.length,
    filesTotal: downloads.length,
  })
}

async function resolveJavaForSettings(javaSettings, minMajor, preferredMajor = minMajor, download = false) {
  const configuredPath =
    typeof javaSettings?.executablePath === "string" && javaSettings.executablePath.trim()
      ? javaSettings.executablePath.trim()
      : null

  if (configuredPath) {
    const configured = await inspectJava(configuredPath)
    if (!configured) {
      throw new Error(`The configured Java executable was not recognized: ${configuredPath}`)
    }
    if (configured.major < minMajor) {
      throw new Error(
        `Configured Java must be ${minMajor}+; found ${configured.major} at ${configuredPath}`,
      )
    }
    return configured
  }

  const found = await findJava(minMajor, preferredMajor)
  if (found || !download || javaSettings?.autoDownloadRuntime === false) return found
  return downloadTemurin(preferredMajor)
}

async function downloadTemurin(major) {
  const runtimeRoot = path.join(app.getPath("userData"), "runtime", `java-${major}`)
  const existing = await inspectJava(path.join(runtimeRoot, "bin", javaExecutableName()))
  if (existing && existing.major >= major) return existing

  emitLaunchProgress({
    phase: "downloading-java",
    message: `Downloading Java ${major}...`,
  })
  const osName = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux"
  const arch = process.arch === "arm64" ? "aarch64" : "x64"
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${osName}/${arch}/jre/hotspot/normal/eclipse?project=jdk`
  const zipPath = path.join(app.getPath("userData"), "runtime", `temurin-${major}.zip`)
  const extractTo = path.join(app.getPath("userData"), "runtime", `temurin-${major}-extract`)
  await fs.mkdir(path.dirname(zipPath), { recursive: true })
  await fs.rm(extractTo, { recursive: true, force: true })
  await fs.mkdir(extractTo, { recursive: true })
  await downloadUrlToTemp(url, zipPath, "sha256", "", undefined, () => {})
  await runProcess("tar", ["-xf", zipPath, "-C", extractTo], {}, undefined)
  const children = await fs.readdir(extractTo, { withFileTypes: true })
  const jreDir = children.find((entry) => entry.isDirectory())
  if (!jreDir) throw new Error("Java archive did not contain a runtime folder.")
  await fs.rm(runtimeRoot, { recursive: true, force: true })
  await fs.rename(path.join(extractTo, jreDir.name), runtimeRoot)
  await fs.rm(extractTo, { recursive: true, force: true }).catch(() => undefined)
  const installed = await inspectJava(path.join(runtimeRoot, "bin", javaExecutableName()))
  if (!installed) throw new Error(`Java ${major} downloaded, but the java binary was not found.`)
  emitLaunchProgress({
    phase: "downloading-java",
    message: `Java ${installed.major} is ready.`,
  })
  return installed
}

async function findJava(minMajor, preferredMajor = minMajor) {
  const candidates = uniqueTruthy([
    process.env.AETHERION_JAVA_PATH,
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", javaExecutableName()) : null,
    "java",
  ])

  if (process.platform === "win32") {
    candidates.unshift(...(await findMinecraftRuntimeJavas()))

    for (const envName of ["ProgramFiles", "ProgramFiles(x86)"]) {
      const base = process.env[envName]
      if (!base) continue
      for (const relative of [
        "Eclipse Adoptium",
        "Java",
        "Microsoft",
        "Amazon Corretto",
        "Zulu",
      ]) {
        const dir = path.join(base, relative)
        if (!fsSync.existsSync(dir)) continue
        const installs = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
        for (const install of installs) {
          if (!install.isDirectory()) continue
          candidates.push(path.join(dir, install.name, "bin", javaExecutableName()))
        }
      }
    }
  }

  const seen = new Set()
  const compatible = []
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    const result = await inspectJava(candidate)
    if (result && result.major >= minMajor) compatible.push(result)
  }

  return (
    compatible.sort((a, b) => {
      const aExact = a.major === preferredMajor ? 0 : 1
      const bExact = b.major === preferredMajor ? 0 : 1
      if (aExact !== bExact) return aExact - bExact
      return Math.abs(a.major - preferredMajor) - Math.abs(b.major - preferredMajor)
    })[0] || null
  )
}

async function findMinecraftRuntimeJavas() {
  if (process.platform !== "win32") return []

  const roots = uniqueTruthy([
    process.env.APPDATA ? path.join(process.env.APPDATA, ".minecraft", "runtime") : null,
    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Packages",
          "Microsoft.4297127D64EC6_8wekyb3d8bbwe",
          "LocalCache",
          "Local",
          ".minecraft",
          "runtime",
        )
      : null,
  ])
  const candidates = []

  for (const root of roots) {
    candidates.push(...(await findJavaExecutables(root)))
  }

  return candidates
}

async function findJavaExecutables(root) {
  if (!fsSync.existsSync(root)) return []

  const matches = []
  async function visit(dir, depth) {
    if (depth > 8 || matches.length >= 24) return

    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(full, depth + 1)
      } else if (entry.isFile() && entry.name.toLowerCase() === javaExecutableName()) {
        matches.push(full)
      }
    }
  }

  await visit(root, 0)
  return matches
}

function parseJvmArgs(value) {
  const text = String(value || "").trim()
  if (!text) return []

  const args = []
  let current = ""
  let quote = null
  let escaping = false

  for (const char of text) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }
    if (char === "\\") {
      escaping = true
      continue
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char
      continue
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current)
        current = ""
      }
      continue
    }
    current += char
  }

  if (current) args.push(current)
  return args.filter((arg) => !/^-[xX]m[sx]/.test(arg))
}

function javaExecutableName() {
  return process.platform === "win32" ? "java.exe" : "java"
}

async function inspectJava(candidate) {
  try {
    const resolvedCandidate = resolveWindowsCommandPath(candidate)
    const probePath = javaProbePath(resolvedCandidate)
    const output = await captureProcess(probePath, ["-version"], { timeoutMs: 8000 })
    const text = `${output.stdout}\n${output.stderr}`
    const major = parseJavaMajor(text)
    if (!major) return null
    return {
      path: javaLaunchPath(resolvedCandidate),
      probePath,
      major,
      version: firstLine(text) || `Java ${major}`,
    }
  } catch {
    return null
  }
}

function resolveWindowsCommandPath(candidate) {
  if (process.platform !== "win32") return candidate
  const command = String(candidate || "")
  if (!command || path.isAbsolute(command) || command.includes("\\") || command.includes("/")) {
    return candidate
  }

  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)
  const extensions = path.extname(command)
    ? [""]
    : String(process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
        .split(";")
        .filter(Boolean)

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const full = path.join(entry, `${command}${extension}`)
      if (fsSync.existsSync(full)) return full
    }
  }

  return candidate
}

function javaProbePath(candidate) {
  if (process.platform !== "win32") return candidate
  const parsed = path.parse(String(candidate))
  if (parsed.base.toLowerCase() !== "javaw.exe") return candidate
  const sibling = path.join(parsed.dir, "java.exe")
  return fsSync.existsSync(sibling) ? sibling : candidate
}

function javaLaunchPath(candidate) {
  if (process.platform !== "win32") return candidate
  const parsed = path.parse(String(candidate))
  if (parsed.base.toLowerCase() === "javaw.exe") return candidate
  if (parsed.base.toLowerCase() !== "java.exe") return candidate
  const sibling = path.join(parsed.dir, "javaw.exe")
  return fsSync.existsSync(sibling) ? sibling : candidate
}

function parseJavaMajor(text) {
  const match = text.match(/version\s+"([^"]+)"/i) || text.match(/openjdk\s+([^\s]+)/i)
  if (!match) return null
  const version = match[1]
  if (version.startsWith("1.")) return Number.parseInt(version.split(".")[1], 10)
  return Number.parseInt(version.split(".")[0], 10)
}

function firstLine(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

function captureProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false,
      cwd: options.cwd,
    })
    let stdout = ""
    let stderr = ""
    const timeout =
      options.timeoutMs &&
      setTimeout(() => {
        child.kill()
        reject(new Error(`Process timeout: ${command} ${args.join(" ")}`))
      }, options.timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout)
      reject(error)
    })
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`Process exited with ${code}: ${stderr || stdout}`))
    })
  })
}

function runProcess(command, args, options, signal, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      windowsHide: true,
      shell: false,
    })
    let tail = ""
    const recentLines = []

    const handleData = (chunk) => {
      tail += chunk.toString()
      const lines = tail.split(/\r?\n/)
      tail = lines.pop() || ""
      for (const line of lines) {
        recentLines.push(line)
        if (recentLines.length > 12) recentLines.shift()
        onLine?.(line)
      }
    }

    const abort = () => {
      child.kill()
      reject(new Error("Operation cancelled."))
    }

    signal?.addEventListener("abort", abort, { once: true })
    child.stdout.on("data", handleData)
    child.stderr.on("data", handleData)
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abort)
      reject(error)
    })
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abort)
      if (tail.trim()) {
        recentLines.push(tail.trim())
        onLine?.(tail.trim())
      }
      if (code === 0) resolve()
      else {
        const details = recentLines.map((line) => line.trim()).filter(Boolean).join("\n")
        reject(
          new Error(
            `Process exited with code ${code}.` +
              (details ? `\n\nLast installer lines:\n${details}` : ""),
          ),
        )
      }
    })
  })
}

async function downloadAction(root, action, signal, onBytes) {
  const target = safeResolve(root, action.path)
  const temp = `${target}.download`
  await fs.mkdir(path.dirname(target), { recursive: true })

  const localArtifact = isDev ? findLocalPackArtifact(action) : null
  if (localArtifact) {
    await copyLocalArtifactToTemp(localArtifact, temp, action.sha256, signal, onBytes)
    await fs.rm(target, { force: true }).catch(() => undefined)
    await fs.rename(temp, target)
    return
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await downloadToTemp(action.url, temp, action.sha256, signal, onBytes)
      await fs.rm(target, { force: true }).catch(() => undefined)
      await fs.rename(temp, target)
      return
    } catch (error) {
      await fs.rm(temp, { force: true }).catch(() => undefined)
      if (signal.aborted || attempt === 3) throw error
      await sleep([1000, 3000, 9000][attempt - 1])
    }
  }
}

async function downloadToTemp(url, temp, expectedSha256, signal, onBytes) {
  await downloadUrlToTemp(url, temp, "sha256", expectedSha256, signal, onBytes)
}

function findLocalPackArtifact(action) {
  const filename = path.basename(toPosix(action.path))
  const releaseVersion = String(action.url || "").match(/\/releases\/download\/v([^/]+)/)?.[1]
  const packDirs = uniqueTruthy([
    process.env.AETHERION_LOCAL_PACK_DIR,
    releaseVersion ? path.resolve(process.cwd(), `pack-v${releaseVersion}`) : null,
    path.resolve(process.cwd(), "pack"),
  ])

  for (const base of packDirs) {
    const candidates = []
    if (action.category === "forge" || action.path.startsWith("forge/")) {
      candidates.push(path.join(base, filename))
      candidates.push(path.join(base, "forge", filename))
    } else if (action.path.startsWith("mods/")) {
      candidates.push(path.join(base, "mods", "required", filename))
      candidates.push(path.join(base, "mods", "optional", filename))
      candidates.push(path.join(base, "mods", filename))
    } else {
      candidates.push(path.resolve(base, ...toPosix(action.path).split("/")))
      candidates.push(path.join(base, filename))
    }

    const found = candidates.find((candidate) => fsSync.existsSync(candidate))
    if (found) return found
  }

  return null
}

async function copyLocalArtifactToTemp(source, temp, expectedSha256, signal, onBytes) {
  throwIfAborted(signal)
  await fs.mkdir(path.dirname(temp), { recursive: true })

  const hash = crypto.createHash("sha256")
  const reader = fsSync.createReadStream(source)
  const writer = fsSync.createWriteStream(temp)

  try {
    for await (const chunk of reader) {
      throwIfAborted(signal)
      hash.update(chunk)
      onBytes?.(chunk.byteLength)
      if (!writer.write(chunk)) await once(writer, "drain")
    }
  } finally {
    writer.end()
  }

  await once(writer, "finish")
  const actual = hash.digest("hex")
  if (expectedSha256 && actual.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(
      `SHA-256 does not match for ${source}\n  expected: ${expectedSha256}\n  received: ${actual}`,
    )
  }
}

async function downloadUrlToTemp(url, temp, algorithm, expectedHash, signal, onBytes) {
  throwIfAborted(signal)
  const response = await fetch(url, { signal, redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} at ${url}`)
  }
  if (!response.body) throw new Error(`Response had no stream at ${url}`)

  const hash = crypto.createHash(algorithm)
  const writer = fsSync.createWriteStream(temp)
  const reader = response.body.getReader()

  try {
    while (true) {
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      hash.update(chunk)
      onBytes?.(chunk.byteLength)
      if (!writer.write(chunk)) await once(writer, "drain")
    }
  } finally {
    writer.end()
  }

  await once(writer, "finish")
  const actual = hash.digest("hex")
  if (expectedHash && actual.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(
      `Hash ${algorithm.toUpperCase()} does not match for ${url}\n  expected: ${expectedHash}\n  received: ${actual}`,
    )
  }
}

async function scanInstalledHashes(root) {
  const hashes = {}
  for (const folder of ["forge", "mods", "config", "resourcepacks", "shaderpacks"]) {
    const absolute = path.join(root, folder)
    if (!fsSync.existsSync(absolute)) continue
    const files = await walkFiles(absolute)
    for (const file of files) {
      if (file.endsWith(".download")) continue
      const relative = toPosix(path.relative(root, file))
      hashes[relative] = await sha256File(file)
    }
  }
  return hashes
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walkFiles(full)))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

async function sha256File(file) {
  return hashFile(file, "sha256")
}

async function fileMatchesHash(file, expectedHash, algorithm) {
  if (!fsSync.existsSync(file)) return false
  if (!expectedHash) return true
  const actual = await hashFile(file, algorithm)
  return actual.toLowerCase() === expectedHash.toLowerCase()
}

async function hashFile(file, algorithm) {
  const hash = crypto.createHash(algorithm)
  const stream = fsSync.createReadStream(file)
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest("hex")
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (item) await worker(item)
    }
  })
  await Promise.all(runners)
}

function instancePath(instanceId) {
  return path.join(app.getPath("userData"), "instances", sanitizeSegment(instanceId))
}

function instanceStatePath(root) {
  return path.join(root, "instance-state.json")
}

function safeResolve(root, relativePath) {
  const resolved = path.resolve(root, ...toPosix(relativePath).split("/"))
  const normalizedRoot = path.resolve(root)
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Invalid path in the manifest: ${relativePath}`)
  }
  return resolved
}

function sanitizeSegment(value) {
  return String(value || "default").replace(/[^a-zA-Z0-9_.-]/g, "_")
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/")
}

function displayName(filePath) {
  return filePath.split("/").pop() || filePath
}

function uniqueTruthy(values) {
  return values.filter(Boolean)
}

function isProtected(filePath, patterns) {
  return patterns.some((pattern) => globToRegex(pattern).test(filePath))
}

function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`, "i")
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new Error("Operation cancelled.")
}

function emitLaunchProgress(progress) {
  mainWindow?.webContents.send("launch:progress", progress)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
