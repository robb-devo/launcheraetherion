/**
 * Mock data para o preview.
 * No Electron: substituido por leitura real de accounts.json / instance-state.json
 * e fetch do manifest remoto via GitHub Pages.
 */
import manifestData from "../../public/manifest.json"
import type {
  Account,
  DropinMod,
  LauncherSettings,
  ManifestFile,
  MojangStatus,
  ServerStatus,
} from "./types"

export const CLIENT_PACK = manifestData

export const MOCK_ACCOUNTS: Account[] = []

export const MOCK_DROPIN_MODS: DropinMod[] = []

export const DEFAULT_SETTINGS: LauncherSettings = {
  minecraft: {
    version: "1.21.1",
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
    jvmArgs:
      "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions",
    autoDownloadRuntime: true,
  },
  launcher: {
    updateChannel: "stable",
    manifestUrl: "",
    minimizeToTray: true,
    telemetry: false,
  },
}

export const MOCK_SERVER_STATUS: ServerStatus = {
  online: false,
  players: { current: 0, max: 0 },
  motd: "",
  ping: 0,
}

export const MOCK_MOJANG_STATUS: MojangStatus = {
  auth: "green",
  session: "green",
}

export const REQUIRED_MODS: ManifestFile[] = CLIENT_PACK.mods.map((mod) => ({
  path: `mods/${mod.filename}`,
  url: mod.url,
    sha256: "",
    size: 0,
    type: "optional",
    defaultEnabled: true,
    id: mod.slug,
  name: mod.slug,
  version: mod.filename,
}))

export const OPTIONAL_MODS: ManifestFile[] = []

export const PACK_SHADERS = CLIENT_PACK.shaderpacks

export const PACK_LABEL = `${CLIENT_PACK.minecraft} · Fabric ${CLIENT_PACK.loader.version}`

export const MOCK_MANIFEST_PREVIEW = {
  version: CLIENT_PACK.version,
  name: CLIENT_PACK.name,
  minecraft: CLIENT_PACK.minecraft,
  loaderVersion: CLIENT_PACK.loader.version,
  instanceId: CLIENT_PACK.id,
} as const
