import type { AccountsState, LauncherSettings, LaunchProgress } from "@/lib/launcher/types"

export {}

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
          detachProcess?: boolean
          closeOnLaunch?: boolean
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
      mods: {
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
