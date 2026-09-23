"use client"

import { useEffect, useState } from "react"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingsRow, SettingsSection } from "@/components/launcher/settings-shell"
import { DEFAULT_SETTINGS, CLIENT_PACK } from "@/lib/launcher/mock-data"

export function MinecraftTab() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS.minecraft)
  const [instancePath, setInstancePath] = useState(settings.gameDirectory ?? "")
  const [versions, setVersions] = useState<Array<{ id: string; label: string }>>([
    { id: CLIENT_PACK.minecraft, label: `${CLIENT_PACK.minecraft} · Aetherion` },
  ])

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

    window.aetherion?.minecraft
      ?.versions()
      .then((list) => {
        if (list.versions?.length) setVersions(list.versions)
      })
      .catch(() => undefined)
  }, [])

  function updateMinecraft(next: typeof settings | ((current: typeof settings) => typeof settings)) {
    setSettings((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      window.aetherion?.settings
        .update({ minecraft: resolved })
        .then(async (state) => {
          setSettings(state.minecraft)
          const paths = await window.aetherion?.settings.getPaths()
          if (paths?.instancePath) setInstancePath(paths.instancePath)
        })
        .catch((err) => console.warn("[aetherion] failed to save minecraft settings", err))
      return resolved
    })
  }

  return (
    <>
      <SettingsSection
        title="Version"
        description="1.21.1 keeps the Aetherion Fabric pack in the default folder. Any other version starts without those mods."
      >
        <SettingsRow label="Minecraft version" description="Used by Play and when joining a server of that version.">
          <select
            aria-label="Minecraft version"
            value={settings.version || CLIENT_PACK.minecraft}
            onChange={(event) => updateMinecraft((current) => ({ ...current, version: event.target.value }))}
            className="h-9 rounded-md border border-white/10 bg-input/40 px-3 text-sm text-foreground"
          >
            {versions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsSection>

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
