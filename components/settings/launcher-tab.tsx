"use client"

import { useEffect, useState } from "react"
import { FileText, FolderOpen, HardDrive, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  SettingsRow,
  SettingsSection,
} from "@/components/launcher/settings-shell"
import { DEFAULT_SETTINGS } from "@/lib/launcher/mock-data"
import { LAUNCHER_BUILD_LABEL, LAUNCHER_VERSION } from "@/lib/launcher/version"
import type { LauncherUpdateState } from "@/types/aetherion"

export function LauncherTab() {
  const [prefs, setPrefs] = useState(DEFAULT_SETTINGS.launcher)
  const [status, setStatus] = useState("Local settings are ready.")
  const [update, setUpdate] = useState<LauncherUpdateState>({
    status: "idle",
    version: null,
    message: "Install this version once. Later releases install themselves from GitHub.",
  })

  useEffect(() => {
    window.aetherion?.settings
      ?.get()
      .then((settings) => setPrefs(settings.launcher))
      .catch((err) => {
        console.warn("[aetherion] failed to load launcher settings", err)
        setStatus(err instanceof Error ? err.message : String(err))
      })

    const updater = window.aetherion?.updater
    if (!updater) return
    updater.get().then(setUpdate).catch(() => undefined)
    return updater.onState(setUpdate)
  }, [])

  function updatePrefs(next: typeof prefs | ((current: typeof prefs) => typeof prefs)) {
    setPrefs((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      window.aetherion?.settings
        ?.update({ launcher: resolved })
        .then((settings) => {
          setPrefs(settings.launcher)
          setStatus("Settings saved.")
        })
        .catch((err) => {
          console.warn("[aetherion] failed to save launcher settings", err)
          setStatus(err instanceof Error ? err.message : String(err))
        })
      return resolved
    })
  }

  async function runLauncherAction(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      setStatus(success)
    } catch (err) {
      console.warn("[aetherion] launcher action failed", err)
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function verifyIntegrity() {
    try {
      const result = await window.aetherion?.launcher?.verifyIntegrity()
      if (!result) return
      setStatus(
        `Integrity checked: ${result.downloadCount} download(s), ${result.removeCount} removal(s).`,
      )
    } catch (err) {
      console.warn("[aetherion] verify integrity failed", err)
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <SettingsSection
        title="Launcher"
        description="Window behavior and local details."
      >
        <SettingsRow
          label="Minimize to tray"
          description="Closing the window keeps the launcher running in the background."
        >
          <Switch
            checked={prefs.minimizeToTray}
            onCheckedChange={(v) => updatePrefs((p) => ({ ...p, minimizeToTray: v }))}
          />
        </SettingsRow>

        <SettingsRow
          label="Anonymous telemetry"
          description="Helps catch crashes and bugs. No personal data is sent."
        >
          <Switch
            checked={prefs.telemetry}
            onCheckedChange={(v) => updatePrefs((p) => ({ ...p, telemetry: v }))}
          />
        </SettingsRow>
        <p className="text-[11px] text-muted-foreground">{status}</p>
      </SettingsSection>

      <SettingsSection
        title="Storage"
        description="Instances, downloaded mods, caches, and logs live here."
      >
        <div className="flex items-center gap-2">
          <HardDrive className="size-4 text-muted-foreground shrink-0" />
          <Input
            readOnly
            value={prefs.dataDirectory ?? "%APPDATA%\\Aetherion Launcher"}
            className="flex-1 h-9 bg-input/40 font-mono text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 bg-transparent"
            onClick={() =>
              runLauncherAction(
                () => window.aetherion?.launcher?.openDataDirectory() ?? Promise.resolve(),
                "Storage folder opened.",
              )
            }
          >
            <FolderOpen className="size-4" />
            Open
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <ActionCard
            icon={<RotateCcw className="size-4" />}
            title="Verify integrity"
            description="Rechecks hashes and downloads damaged files."
            onClick={verifyIntegrity}
          />
          <ActionCard
            icon={<Trash2 className="size-4" />}
            title="Clear cache"
            description="Removes temporary downloads."
            onClick={() =>
              runLauncherAction(
                () => window.aetherion?.launcher?.clearCache() ?? Promise.resolve(),
                "Local cache cleared.",
              )
            }
          />
          <ActionCard
            icon={<FileText className="size-4" />}
            title="View logs"
            description="Opens the launcher and game log folder."
            onClick={() =>
              runLauncherAction(
                () => window.aetherion?.launcher?.openLogsDirectory() ?? Promise.resolve(),
                "Log folder opened.",
              )
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Updates"
        description="An installed build checks GitHub Releases. A newer release appears here only when it includes latest.yml, the Setup.exe, and the blockmap."
      >
        <p className="text-sm text-foreground">{update.message}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 bg-transparent"
            onClick={() => {
              window.aetherion?.updater
                .check()
                .then(setUpdate)
                .catch((err) => {
                  console.warn("[aetherion] update check failed", err)
                })
            }}
          >
            Check for updates
          </Button>
          {update.status === "ready" ? (
            <Button
              size="sm"
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                window.aetherion?.updater.install().catch((err) => {
                  console.warn("[aetherion] failed to install update", err)
                })
              }}
            >
              Restart and install
            </Button>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection title="About">
        <div className="aetherion-glass space-y-3 rounded-2xl p-5">
          <InfoLine label="Launcher" value={`Aetherion v${LAUNCHER_VERSION}`} />
          <InfoLine label="Build" value={LAUNCHER_BUILD_LABEL} />
          <InfoLine label="Electron" value="Real" />
          <InfoLine label="Node" value="Runtime local" />
        </div>
      </SettingsSection>
    </>
  )
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-white/8 bg-card/40 p-4 text-left transition duration-200 hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </button>
  )
}

function InfoLine({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "text-muted-foreground/60 font-mono" : "text-foreground font-mono"}>
        {value}
      </span>
    </div>
  )
}
