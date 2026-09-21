"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Coffee, Download, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { SettingsSection } from "@/components/launcher/settings-shell"
import { DEFAULT_SETTINGS, MOCK_MANIFEST_PREVIEW } from "@/lib/launcher/mock-data"

const FALLBACK_SYSTEM_RAM_MB = 16 * 1024

type DetectedJava = {
  path: string
  major: number
  version: string
} | null

export function JavaTab() {
  const [java, setJava] = useState(DEFAULT_SETTINGS.java)
  const [totalRamMb, setTotalRamMb] = useState(FALLBACK_SYSTEM_RAM_MB)
  const [detectedJava, setDetectedJava] = useState<DetectedJava>(null)
  const [status, setStatus] = useState("Carregando configuracao Java...")

  useEffect(() => {
    if (!window.aetherion?.settings) return

    window.aetherion.settings
      .get()
      .then((state) => setJava(state.java))
      .catch((err) => {
        console.warn("[aetherion] failed to load java settings", err)
        setStatus("Nao foi possivel carregar as configuracoes locais.")
      })

    refreshJavaDetection()
  }, [])

  function refreshJavaDetection() {
    window.aetherion?.java
      .detect()
      .then((info) => {
        setTotalRamMb(info.totalRamMb)
        setDetectedJava(info.java)
        setStatus(
          info.java
            ? `Java ${info.java.major} pronto em ${info.java.path}`
            : "Nenhum Java 17+ encontrado.",
        )
      })
      .catch((err) => {
        console.warn("[aetherion] failed to detect java", err)
        setDetectedJava(null)
        setStatus(err instanceof Error ? err.message : String(err))
      })
  }

  function updateJava(next: typeof java | ((current: typeof java) => typeof java)) {
    setJava((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      window.aetherion?.settings
        .update({ java: resolved })
        .then((state) => {
          setJava(state.java)
          refreshJavaDetection()
        })
        .catch((err) => {
          console.warn("[aetherion] failed to save java settings", err)
          setStatus(err instanceof Error ? err.message : String(err))
        })
      return resolved
    })
  }

  function updateJavaPreview(next: typeof java | ((current: typeof java) => typeof java)) {
    setJava((current) => (typeof next === "function" ? next(current) : next))
  }

  async function chooseJava() {
    try {
      const result = await window.aetherion?.java?.chooseExecutable()
      if (!result) return
      setJava(result.settings.java)
      setDetectedJava(result.java)
      setStatus(`Java ${result.java.major} selecionado.`)
    } catch (err) {
      console.warn("[aetherion] failed to choose java", err)
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  const maxGb = java.maxRamMb / 1024
  const minGb = java.minRamMb / 1024
  const totalGb = totalRamMb / 1024

  return (
    <>
      <SettingsSection
        title="Memoria"
        description={`Total do sistema: ${totalGb.toFixed(1)} GB. Recomendado: 6-10 GB para modpacks.`}
      >
        <div className="space-y-6 rounded-2xl border border-white/8 bg-card/40 p-5">
          <MemorySlider
            label="RAM maxima"
            value={java.maxRamMb}
            min={2048}
            max={totalRamMb}
            onChange={(v) =>
              updateJavaPreview((s) => ({ ...s, maxRamMb: Math.max(v, s.minRamMb) }))
            }
            onCommit={(v) =>
              updateJava((s) => ({ ...s, maxRamMb: Math.max(v, s.minRamMb) }))
            }
            display={`${maxGb.toFixed(1)} GB`}
          />
          <MemorySlider
            label="RAM minima"
            value={java.minRamMb}
            min={1024}
            max={java.maxRamMb}
            onChange={(v) => updateJavaPreview((s) => ({ ...s, minRamMb: v }))}
            onCommit={(v) => updateJava((s) => ({ ...s, minRamMb: v }))}
            display={`${minGb.toFixed(1)} GB`}
          />
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/40">
            <MemoryStat label="Alocada" value={`${maxGb.toFixed(1)} GB`} accent />
            <MemoryStat label="Minima" value={`${minGb.toFixed(1)} GB`} />
            <MemoryStat label="Sistema" value={`${totalGb.toFixed(1)} GB`} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O launcher aplica estes valores como -Xms e -Xmx no processo do Minecraft.
          Se o Java gerar erro de memoria, reduza a RAM ou aumente o arquivo de paginacao do Windows.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Executavel Java"
        description="O launcher valida o binario antes de iniciar o jogo. Use Java 17 ou superior."
      >
        <div className="space-y-4 rounded-2xl border border-white/8 bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <div className="size-9 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {detectedJava ? `Java ${detectedJava.major} detectado` : "Java nao detectado"}
              </p>
              <p className="text-xs text-muted-foreground">
                Recomendado para Minecraft {MOCK_MANIFEST_PREVIEW.minecraft} (Forge{" "}
                {MOCK_MANIFEST_PREVIEW.forgeVersion}) - major &gt;= 17
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">{status}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Coffee className="size-4 text-muted-foreground shrink-0" />
            <Input
              readOnly
              value={java.executablePath || detectedJava?.path || "Auto detectar Java 17+"}
              className="flex-1 h-9 bg-input/40 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 bg-transparent"
              onClick={chooseJava}
            >
              <FolderOpen className="size-4" />
              Escolher
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              Se nao houver Java compativel instalado, instale um runtime Java 17.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-primary"
              onClick={() =>
                window.open("https://adoptium.net/temurin/releases/?version=17", "_blank")
              }
            >
              <Download className="size-4" />
              Baixar runtime
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Opcoes JVM adicionais"
        description="Argumentos passados ao processo Java. Use com cuidado."
      >
        <Textarea
          value={java.jvmArgs}
          onChange={(e) => updateJava((s) => ({ ...s, jvmArgs: e.target.value }))}
          className="min-h-[96px] bg-input/40 font-mono text-xs"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground">
          O launcher controla -Xms e -Xmx pelos sliders. Se voce digitar esses argumentos
          aqui, eles serao ignorados para evitar conflito.
        </p>
      </SettingsSection>
    </>
  )
}

function MemorySlider({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  onCommit: (v: number) => void
  display: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </label>
        <span className="text-sm font-mono text-primary">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={512}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit(v)}
      />
    </div>
  )
}

function MemoryStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-serif ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}
