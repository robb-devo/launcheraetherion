"use client"

import { useEffect, useState } from "react"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingsRow, SettingsSection } from "@/components/launcher/settings-shell"
import { DEFAULT_SETTINGS } from "@/lib/launcher/mock-data"

export function MinecraftTab() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS.minecraft)
  const [instancePath, setInstancePath] = useState(settings.gameDirectory ?? "")

  useEffect(() => {
    if (!window.aetherion?.settings) return

    window.aetherion.settings
      .get()
      .then((state) => {
        setSettings(state.minecraft)
        setInstancePath(state.minecraft.gameDirectory ?? "")
      })
      .catch((err) => console.warn("[aetherion] failed to load minecraft settings", err))

    window.aetherion.settings
      .getPaths()
      .then((paths) => setInstancePath(paths.instancePath))
      .catch(() => undefined)
  }, [])

  function updateMinecraft(next: typeof settings | ((current: typeof settings) => typeof settings)) {
    setSettings((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      window.aetherion?.settings
        .update({ minecraft: resolved })
        .then((state) => {
          setSettings(state.minecraft)
          setInstancePath(state.minecraft.gameDirectory ?? instancePath)
        })
        .catch((err) => console.warn("[aetherion] failed to save minecraft settings", err))
      return resolved
    })
  }

  return (
    <>
      <SettingsSection
        title="Video"
        description="Starting resolution and how the game fills the screen."
      >
        <SettingsRow label="Game resolution" description="Used when the game is not fullscreen.">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={settings.resolution.width}
              onChange={(e) =>
                updateMinecraft((s) => ({
                  ...s,
                  resolution: { ...s.resolution, width: Number(e.target.value) },
                }))
              }
              className="w-24 h-9 bg-input/40 text-center"
            />
            <span className="text-muted-foreground">×</span>
            <Input
              type="number"
              value={settings.resolution.height}
              onChange={(e) =>
                updateMinecraft((s) => ({
                  ...s,
                  resolution: { ...s.resolution, height: Number(e.target.value) },
                }))
              }
              className="w-24 h-9 bg-input/40 text-center"
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label="Start in fullscreen"
          description="Overrides the resolution above when it is on."
        >
          <Switch
            checked={settings.fullscreen}
            onCheckedChange={(v) => updateMinecraft((s) => ({ ...s, fullscreen: v }))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Startup"
        description="How the game behaves when it starts."
      >
        <SettingsRow
          label="Connect to the server automatically"
          description="Joins Aetherion as soon as the game opens."
        >
          <Switch
            checked={settings.autoConnectServer}
            onCheckedChange={(v) => updateMinecraft((s) => ({ ...s, autoConnectServer: v }))}
          />
        </SettingsRow>

        <SettingsRow
          label="Separate process from the launcher"
          description="When this is off, closing the launcher also closes the game."
        >
          <Switch
            checked={settings.detachProcess}
            onCheckedChange={(v) =>
              updateMinecraft((s) => ({
                ...s,
                detachProcess: v,
                closeOnLaunch: v ? s.closeOnLaunch : false,
              }))
            }
          />
        </SettingsRow>

        <SettingsRow
          label="Close the launcher when the game opens"
          description="Frees RAM while you play."
        >
          <Switch
            checked={settings.closeOnLaunch}
            onCheckedChange={(v) =>
              updateMinecraft((s) => ({
                ...s,
                closeOnLaunch: v,
                detachProcess: v || s.detachProcess,
              }))
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Instance directory"
        description="Where the modpack files, saves, configs, and cache live."
      >
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={
              instancePath ||
              settings.gameDirectory ||
              "%APPDATA%\\Aetherion Launcher\\instances\\aetherion-main"
            }
            className="flex-1 h-9 bg-input/40 font-mono text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 bg-transparent"
            onClick={() =>
              window.aetherion?.settings
                .openInstanceFolder()
                .catch((err) => console.warn("[aetherion] failed to open instance", err))
            }
          >
            <FolderOpen className="size-4" />
            Open
          </Button>
        </div>
      </SettingsSection>
    </>
  )
}
