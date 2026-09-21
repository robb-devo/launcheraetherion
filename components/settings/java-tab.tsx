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
  const [status, setStatus] = useState("Loading Java settings...")

  useEffect(() => {
    if (!window.aetherion?.settings) return

    window.aetherion.settings
      .get()
      .then((state) => setJava(state.java))
      .catch((err) => {
        console.warn("[aetherion] failed to load java settings", err)
        setStatus("Could not load local settings.")
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
            ? `Java ${info.java.major} ready at ${info.java.path}`
            : "No Java 17+ found.",
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
      setStatus(`Java ${result.java.major} selected.`)
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
        title="Memory"
        description={`System total: ${totalGb.toFixed(1)} GB. Recommended: 6-10 GB for modpacks.`}
      >
        <div className="space-y-6 rounded-2xl border border-white/8 bg-card/40 p-5">
          <MemorySlider
            label="Maximum RAM"
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
            label="Minimum RAM"
            value={java.minRamMb}
            min={1024}
            max={java.maxRamMb}
            onChange={(v) => updateJavaPreview((s) => ({ ...s, minRamMb: v }))}
            onCommit={(v) => updateJava((s) => ({ ...s, minRamMb: v }))}
            display={`${minGb.toFixed(1)} GB`}
          />
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/40">
            <MemoryStat label="Allocated" value={`${maxGb.toFixed(1)} GB`} accent />
            <MemoryStat label="Minimum" value={`${minGb.toFixed(1)} GB`} />
            <MemoryStat label="System" value={`${totalGb.toFixed(1)} GB`} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The launcher applies these values as -Xms and -Xmx for Minecraft.
          If Java runs out of memory, lower the RAM or increase the Windows page file.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Java executable"
        description="The launcher checks the binary before the game starts. Use Java 17 or newer."
      >
        <div className="space-y-4 rounded-2xl border border-white/8 bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <div className="size-9 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {detectedJava ? `Java ${detectedJava.major} detected` : "Java not detected"}
              </p>
              <p className="text-xs text-muted-foreground">
                Recommended for Minecraft {MOCK_MANIFEST_PREVIEW.minecraft} (Forge{" "}
                {MOCK_MANIFEST_PREVIEW.forgeVersion}) - major &gt;= 17
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">{status}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Coffee className="size-4 text-muted-foreground shrink-0" />
            <Input
              readOnly
              value={java.executablePath || detectedJava?.path || "Auto-detect Java 17+"}
              className="flex-1 h-9 bg-input/40 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 bg-transparent"
              onClick={chooseJava}
            >
              <FolderOpen className="size-4" />
              Choose
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              If no compatible Java is installed, install a Java 17 runtime.
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
              Download runtime
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Extra JVM options"
        description="Arguments passed to the Java process. Use with care."
      >
        <Textarea
          value={java.jvmArgs}
          onChange={(e) => updateJava((s) => ({ ...s, jvmArgs: e.target.value }))}
          className="min-h-[96px] bg-input/40 font-mono text-xs"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground">
          The launcher sets -Xms and -Xmx from the sliders. If you type those arguments
          here, they are ignored so they do not conflict.
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
