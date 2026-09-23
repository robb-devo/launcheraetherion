"use client"

import { useEffect, useState } from "react"
import { FolderOpen, RefreshCw, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SettingsSection } from "@/components/launcher/settings-shell"
import {
  MOCK_DROPIN_MODS,
  OPTIONAL_MODS,
  PACK_SHADERS,
  REQUIRED_MODS,
} from "@/lib/launcher/mock-data"
import type { DropinMod, ManifestFile } from "@/lib/launcher/types"
import { displayModTag } from "@/lib/launcher/labels"
import { cn } from "@/lib/utils"

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

export function ModsTab() {
  const [packMods, setPackMods] = useState(REQUIRED_MODS)
  const [optional, setOptional] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(REQUIRED_MODS.map((mod) => [mod.path, mod.defaultEnabled !== false])),
  )
  const [dropins, setDropins] = useState<DropinMod[]>(MOCK_DROPIN_MODS)
  const [status, setStatus] = useState("Local drop-ins are ready.")

  useEffect(() => {
    reloadDropins()
    window.aetherion?.mods
      ?.listPack?.()
      .then((mods) => {
        if (!mods?.length) return
        setPackMods(
          mods.map((mod) => ({
            path: mod.path,
            url: "",
            sha256: "",
            size: 0,
            type: "optional" as const,
            defaultEnabled: true,
            name: mod.name,
            version: mod.version,
          })),
        )
        setOptional(Object.fromEntries(mods.map((mod) => [mod.path, mod.enabled])))
      })
      .catch((err) => console.warn("[aetherion] failed to load pack mods", err))
  }, [])

  async function reloadDropins() {
    try {
      const mods = await window.aetherion?.mods?.listDropins()
      if (mods) setDropins(mods)
      setStatus("Drop-ins refreshed.")
    } catch (err) {
      console.warn("[aetherion] failed to load drop-in mods", err)
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function addDropins() {
    try {
      const mods = await window.aetherion?.mods?.addDropins()
      if (mods) setDropins(mods)
      setStatus("Mod added to mods/dropin.")
    } catch (err) {
      console.warn("[aetherion] failed to add drop-in mod", err)
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function toggleOptional(path: string, enabled: boolean) {
    setOptional((prev) => ({ ...prev, [path]: enabled }))
    try {
      await window.aetherion?.mods?.setOptional(path, enabled)
      if (enabled && isOptiFinePath(path)) {
        setStatus(
          "OptiFine is on in experimental mode. If the game closes with a mixin/Aether error, turn off only OptiFine and leave the other optional mods on.",
        )
        return
      }
      setStatus("Optional mods updated.")
    } catch (err) {
      console.warn("[aetherion] failed to update optional mod", err)
      setOptional((prev) => ({ ...prev, [path]: !enabled }))
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function toggleDropin(filename: string, enabled: boolean) {
    setDropins((prev) =>
      prev.map((mod) => (mod.filename === filename ? { ...mod, enabled } : mod)),
    )
    try {
      const mods = await window.aetherion?.mods?.setDropinEnabled(filename, enabled)
      if (mods) setDropins(mods)
    } catch (err) {
      console.warn("[aetherion] failed to toggle drop-in mod", err)
      await reloadDropins()
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function removeDropin(filename: string) {
    setDropins((prev) => prev.filter((mod) => mod.filename !== filename))
    try {
      const mods = await window.aetherion?.mods?.removeDropin(filename)
      if (mods) setDropins(mods)
      setStatus("Drop-in removed.")
    } catch (err) {
      console.warn("[aetherion] failed to remove drop-in mod", err)
      await reloadDropins()
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function openDropinFolder() {
    try {
      await window.aetherion?.mods?.openDropinFolder()
    } catch (err) {
      console.warn("[aetherion] failed to open drop-in folder", err)
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <SettingsSection
        title={`Aetherion mods (${packMods.length})`}
        description="Installed in the normal mods folder for Minecraft 1.21.1. Turn any of them off. Other versions do not get this pack."
      >
        <div className="rounded-lg border border-border/50 divide-y divide-border/40">
          {packMods.map((mod) => (
            <ModRow
              key={mod.path}
              mod={mod}
              enabled={optional[mod.path] !== false}
              onToggle={(value) => toggleOptional(mod.path, value)}
            />
          ))}
        </div>
      </SettingsSection>

      {OPTIONAL_MODS.length > 0 ? (
      <SettingsSection
        title={`Optional (${OPTIONAL_MODS.length})`}
        description="You can turn these on or off."
      >
        <div className="rounded-lg border border-border/50 divide-y divide-border/40">
          {OPTIONAL_MODS.map((mod) => (
            <ModRow
              key={mod.path}
              mod={mod}
              enabled={optional[mod.path]}
              onToggle={(v) => toggleOptional(mod.path, v)}
            />
          ))}
        </div>
      </SettingsSection>
      ) : null}

      <SettingsSection
        title="Drop-in Mods"
        description="Mods you added yourself. The launcher keeps these files across modpack updates."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 bg-transparent"
            onClick={addDropins}
          >
            <Upload className="size-4" />
            Add .jar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2 text-muted-foreground"
            onClick={reloadDropins}
          >
            <RefreshCw className="size-4" />
            Reload
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2 text-muted-foreground"
            onClick={openDropinFolder}
          >
            <FolderOpen className="size-4" />
            Open folder
          </Button>
          <p className="ml-auto text-xs text-muted-foreground">
            Folder: <code className="font-mono">mods/dropin/</code>
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">{status}</p>

        <div className="rounded-lg border border-border/50 divide-y divide-border/40">
          {dropins.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No mods added yet.
            </div>
          ) : (
            dropins.map((mod) => (
              <div key={mod.filename} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">
                    {mod.filename}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatSize(mod.size)}</p>
                </div>
                <Switch
                  checked={mod.enabled}
                  onCheckedChange={(v) => toggleDropin(mod.filename, v)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeDropin(mod.filename)}
                  aria-label={`Remove ${mod.filename}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Shaderpacks"
        description="Iris loads the pack shader when the game starts."
      >
        <div className="rounded-lg border border-border/50 divide-y divide-border/40">
          {PACK_SHADERS.map((shader) => (
            <div key={shader.slug} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{shader.slug}</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {shader.filename}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs">
                {shader.enable === false ? "Off" : "Enabled"}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  )
}

function isOptiFinePath(filePath: string) {
  return /optifine/i.test(filePath)
}

function getModHint(mod: ManifestFile) {
  if (mod.description) return mod.description
  if (isOptiFinePath(mod.path)) {
    return "Experimental: this pack can conflict with Aether. If the game fails to open, turn off only OptiFine."
  }
  return null
}

function ModRow({
  mod,
  enabled,
  onToggle,
}: {
  mod: ManifestFile
  enabled?: boolean
  onToggle?: (v: boolean) => void
}) {
  const displayName = mod.name ?? mod.path.split("/").pop() ?? mod.path
  const hint = getModHint(mod)

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div
        className={cn(
          "size-2 rounded-full shrink-0",
          enabled ? "bg-magic" : "bg-muted",
        )}
      />
      <div className="flex-1 min-w-0">
        {hint ? <p className="mb-1 text-[11px] text-amber-300/90">{hint}</p> : null}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
          {mod.tag && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider border-border/60 text-muted-foreground"
            >
              {displayModTag(mod.tag)}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
        {mod.version
          ? mod.version.endsWith(".jar") || mod.version.endsWith(".zip")
            ? mod.version
            : `v${mod.version}`
          : null}
          {mod.version && mod.author && " • "}
          {mod.author}
        </p>
      </div>
      <Switch checked={enabled ?? false} onCheckedChange={onToggle} />
    </div>
  )
}
