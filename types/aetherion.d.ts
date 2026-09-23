import type { AccountsState, LauncherSettings, LaunchProgress } from "@/lib/launcher/types"

export {}

export type LauncherUpdateState = {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "none" | "error"
  version: string | null
  percent?: number
  message: string
}

export type MinecraftVersionChoice = {
  id: string
  label: string
  pack: boolean
}

declare global {
  interface Window {
    aetherion?: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      launch: {
        start: (args: {
          accountId: string
          instanceId: string
          fullscreen: boolean
          width: number
          height: number
          autoConnectServer?: boolean
          isolated?: boolean
          detachProcess?: boolean
          closeOnLaunch?: boolean
          serverHost?: string
          serverPort?: number
          serverName?: string
          minecraftVersion?: string
        }) => Promise<{
          ok: boolean
          target?: {
            minecraft: string
            forge: string
          }
        }>
        cancel: () => Promise<{ ok: boolean }>
        onProgress: (cb: (progress: LaunchProgress) => void) => () => void
      }
      accounts: {
        list: () => Promise<AccountsState>
        addOffline: (username: string) => Promise<AccountsState>
        addMicrosoft: () => Promise<AccountsState>
        remove: (id: string) => Promise<AccountsState>
        setActive: (id: string) => Promise<AccountsState>
        getDataPath: () => Promise<string>
      }
      settings: {
        get: () => Promise<LauncherSettings>
        update: (patch: Partial<LauncherSettings>) => Promise<LauncherSettings>
        getPaths: () => Promise<{
          settingsPath: string
          instancePath: string
        }>
        openInstanceFolder: () => Promise<{ ok: boolean }>
      }
      java: {
        detect: () => Promise<{
          totalRamMb: number
          java: {
            path: string
            major: number
            version: string
          } | null
        }>
        chooseExecutable: () => Promise<{
          settings: LauncherSettings
          java: {
            path: string
            major: number
            version: string
          }
        } | null>
      }
      status: {
        realm: () => Promise<{
          host: string
          port: number
          state: "online" | "offline" | "unknown"
          online: boolean | null
          players: { current: number; max: number } | null
          ping: number | null
          motd: string | null
          mojang?: "online" | "unknown"
        }>
      }
      sandbox: {
        options: () => Promise<import("@/lib/launcher/sandbox").SandboxOptions>
        list: () => Promise<{ servers: import("@/lib/launcher/sandbox").SandboxServer[] }>
        create: (
          input: import("@/lib/launcher/sandbox").SandboxCreateInput,
        ) => Promise<import("@/lib/launcher/sandbox").SandboxServer>
        start: (id: string) => Promise<{ ok?: boolean; address?: string; running?: boolean | null }>
        stop: (id: string) => Promise<{ ok?: boolean; address?: string; running?: boolean | null }>
        remove: (id: string) => Promise<{ ok?: boolean; id?: string }>
        restart: (id: string) => Promise<{ ok?: boolean; address?: string; running?: boolean | null }>
        inspect: (id: string) => Promise<{
          server: import("@/lib/launcher/sandbox").SandboxServer
          live: import("@/lib/launcher/sandbox").SandboxLiveStatus
        }>
      }
      launcher: {
        openDataDirectory: () => Promise<{ ok: boolean }>
        openLogsDirectory: () => Promise<{ ok: boolean }>
        clearCache: () => Promise<{ removed: number }>
        verifyIntegrity: () => Promise<{
          downloadCount: number
          removeCount: number
          totalBytes: number
        }>
      }
      shell: {
        openExternal: (url: string) => Promise<{ ok: boolean }>
      }
      updater: {
        get: () => Promise<LauncherUpdateState>
        check: () => Promise<LauncherUpdateState>
        install: () => Promise<{ ok: boolean }>
        onState: (cb: (state: LauncherUpdateState) => void) => () => void
      }
      minecraft: {
        versions: () => Promise<{
          current: string
          versions: MinecraftVersionChoice[]
        }>
      }
      mods: {
        listPack: () => Promise<
          Array<{ path: string; name: string; version: string; enabled: boolean }>
        >
        listDropins: () => Promise<import("@/lib/launcher/types").DropinMod[]>
        addDropins: () => Promise<import("@/lib/launcher/types").DropinMod[]>
        setOptional: (
          path: string,
          enabled: boolean,
        ) => Promise<Record<string, boolean>>
        setDropinEnabled: (
          filename: string,
          enabled: boolean,
        ) => Promise<import("@/lib/launcher/types").DropinMod[]>
        removeDropin: (filename: string) => Promise<import("@/lib/launcher/types").DropinMod[]>
        openDropinFolder: () => Promise<{ ok: boolean }>
      }
    }
  }
}
