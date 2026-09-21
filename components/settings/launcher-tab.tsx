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

export function LauncherTab() {
  const [prefs, setPrefs] = useState(DEFAULT_SETTINGS.launcher)
  const [status, setStatus] = useState("Configuracoes locais prontas.")

  useEffect(() => {
    window.aetherion?.settings
      ?.get()
      .then((settings) => setPrefs(settings.launcher))
      .catch((err) => {
        console.warn("[aetherion] failed to load launcher settings", err)
        setStatus(err instanceof Error ? err.message : String(err))
      })
  }, [])

  function updatePrefs(next: typeof prefs | ((current: typeof prefs) => typeof prefs)) {
    setPrefs((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      window.aetherion?.settings
        ?.update({ launcher: resolved })
        .then((settings) => {
          setPrefs(settings.launcher)
          setStatus("Configuracoes salvas.")
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
        `Integridade verificada: ${result.downloadCount} download(s), ${result.removeCount} remocao(oes).`,
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
        description="Comportamento da janela e informacoes locais."
      >
        <SettingsRow
          label="Minimizar para a bandeja"
          description="Ao fechar, o launcher continua rodando em segundo plano."
        >
          <Switch
            checked={prefs.minimizeToTray}
            onCheckedChange={(v) => updatePrefs((p) => ({ ...p, minimizeToTray: v }))}
          />
        </SettingsRow>

        <SettingsRow
          label="Telemetria anonima"
          description="Ajuda a detectar crashes e bugs. Nenhum dado pessoal e enviado."
        >
          <Switch
            checked={prefs.telemetry}
            onCheckedChange={(v) => updatePrefs((p) => ({ ...p, telemetry: v }))}
          />
        </SettingsRow>
        <p className="text-[11px] text-muted-foreground">{status}</p>
      </SettingsSection>

      <SettingsSection
        title="Armazenamento"
        description="Instancias, mods baixados, caches e logs ficam aqui."
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
                "Pasta de armazenamento aberta.",
              )
            }
          >
            <FolderOpen className="size-4" />
            Abrir
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <ActionCard
            icon={<RotateCcw className="size-4" />}
            title="Verificar integridade"
            description="Recalcula hashes e baixa arquivos corrompidos."
            onClick={verifyIntegrity}
          />
          <ActionCard
            icon={<Trash2 className="size-4" />}
            title="Limpar cache"
            description="Remove downloads temporarios e thumbnails."
            onClick={() =>
              runLauncherAction(
                () => window.aetherion?.launcher?.clearCache() ?? Promise.resolve(),
                "Cache local limpo.",
              )
            }
          />
          <ActionCard
            icon={<FileText className="size-4" />}
            title="Ver logs"
            description="Abre a pasta de logs do launcher e do jogo."
            onClick={() =>
              runLauncherAction(
                () => window.aetherion?.launcher?.openLogsDirectory() ?? Promise.resolve(),
                "Pasta de logs aberta.",
              )
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Sobre">
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
