"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export type LauncherUpdateStatus = {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error"
  version?: string | null
  percent?: number | null
  transferred?: number | null
  total?: number | null
  bytesPerSecond?: number | null
  error?: string | null
}

function formatBytes(value?: number | null): string {
  if (!value || value <= 0) return "0 MB"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} KB`
  return `${value} B`
}

export function LauncherUpdateNotice() {
  const [state, setState] = useState<LauncherUpdateStatus | null>(null)

  useEffect(() => {
    const updater = window.aetherion?.updater
    if (!updater) return

    let alive = true
    updater
      .getState()
      .then((next) => {
        if (alive) setState(next)
      })
      .catch(() => undefined)

    const unsubscribe = updater.onStatus((next) => setState(next))
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  if (!state) return null
  if (state.status !== "available" && state.status !== "downloading" && state.status !== "downloaded" && state.status !== "error") {
    return null
  }

  const total = state.total ?? 0
  const transferred = state.transferred ?? 0
  const percent = total > 0 ? Math.min(100, (transferred / total) * 100) : null
  const versionLabel = state.version ? ` ${state.version}` : ""

  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-40 flex justify-center px-6">
      <div className="aetherion-glass pointer-events-auto w-full max-w-xl rounded-2xl px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="aetherion-kicker text-primary/90!">Launcher update</p>
            <p className="mt-1 font-serif text-lg tracking-wide text-foreground">
              {state.status === "error"
                ? "Update could not finish"
                : state.status === "downloaded"
                  ? `Version${versionLabel} is ready`
                  : `Downloading${versionLabel}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {state.status === "error"
                ? state.error || "The update check failed."
                : state.status === "downloaded"
                  ? "The launcher will restart to apply this update."
                  : "Minecraft, mods, and accounts stay on this PC."}
            </p>
          </div>
          {state.status === "downloaded" && (
            <button
              type="button"
              onClick={() => window.aetherion?.updater?.install()}
              className="h-9 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Restart
            </button>
          )}
          {state.status === "error" && (
            <button
              type="button"
              onClick={() => window.aetherion?.updater?.check()}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-foreground transition hover:bg-white/6"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          )}
        </div>

        {state.status !== "error" && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-[width] duration-300",
                  percent === null && "w-0",
                )}
                style={percent !== null ? { width: `${percent}%` } : undefined}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {state.status === "downloaded"
                  ? "Download complete"
                  : percent === null
                    ? "Contacting the release"
                    : "Downloading"}
              </span>
              <span>
                {total > 0
                  ? `${formatBytes(transferred)} / ${formatBytes(total)}`
                  : percent !== null
                    ? `${percent.toFixed(0)}%`
                    : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
