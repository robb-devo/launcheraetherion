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
  Manifest,
  MojangStatus,
  ServerStatus,
} from "./types"

export const MOCK_ACCOUNTS: Account[] = [
  {
    id: "acc_1",
    type: "microsoft",
    username: "Aetherion_Main",
    uuid: "1a04d0e5-45db-36ef-974f-c53c337e46cb",
    avatarUrl: "/minecraft-avatar-dark-knight.jpg",
    lastUsedAt: "2026-04-17T22:10:00Z",
  },
  {
    id: "acc_2",
    type: "offline",
    username: "Guardian",
    uuid: "1c25df42-1e71-3d46-b785-40e44b7367f4",
    avatarUrl: "/minecraft-avatar-wizard.jpg",
    lastUsedAt: "2026-04-15T18:32:00Z",
  },
  {
    id: "acc_3",
    type: "offline",
    username: "RuneKeeper",
    uuid: "8b8c2d09-4d8d-4b79-b612-6f1b2e3c4d5e",
    avatarUrl: "/minecraft-avatar-ranger.jpg",
  },
]

export const MOCK_DROPIN_MODS: DropinMod[] = []

export const DEFAULT_SETTINGS: LauncherSettings = {
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
  online: true,
  players: { current: 147, max: 1000 },
  motd: "Aetherion - Ethereal Realm",
  ping: 32,
}

export const MOCK_MOJANG_STATUS: MojangStatus = {
  auth: "green",
  session: "green",
}

export const MOCK_MANIFEST = manifestData as Manifest

export const REQUIRED_MODS = MOCK_MANIFEST.files.filter((file) => file.type === "required")
export const OPTIONAL_MODS = MOCK_MANIFEST.files.filter((file) => file.type === "optional")

export const MOCK_MANIFEST_PREVIEW = {
  version: MOCK_MANIFEST.version,
  name: MOCK_MANIFEST.name,
  minecraft: MOCK_MANIFEST.minecraft,
  forgeVersion: MOCK_MANIFEST.forge.version,
  publishedAt: MOCK_MANIFEST.publishedAt,
} as const
