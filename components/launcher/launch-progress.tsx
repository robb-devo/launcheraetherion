"use client"

import { CheckCircle2, Download, Hammer, Loader2, Rocket, Search, ServerCrash, Coffee } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LaunchPhase, LaunchProgress } from "@/lib/launcher/types"

interface Props {
  progress: LaunchProgress
  onCancel?: () => void
  onDismiss?: () => void
}

const PHASE_ORDER: LaunchPhase[] = [
  "fetching-manifest",
  "computing-plan",
  "checking-java",
  "downloading-java",
  "installing-forge",
  "downloading-files",
  "verifying",
  "launching",
]

const PHASE_META: Record<
  LaunchPhase,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  idle: { label: "Waiting", icon: Loader2 },
  "fetching-manifest": { label: "Fetching manifest", icon: Search },
  "computing-plan": { label: "Computing differences", icon: Search },
  "checking-java": { label: "Checking Java", icon: Coffee },
  "downloading-java": { label: "Downloading Java runtime", icon: Download },
  "installing-forge": { label: "Installing Forge", icon: Hammer },
  "downloading-files": { label: "Downloading mods and configs", icon: Download },
  verifying: { label: "Verifying integrity", icon: CheckCircle2 },
  launching: { label: "Starting Minecraft", icon: Rocket },
  running: { label: "Game running", icon: Rocket },
  error: { label: "Error", icon: ServerCrash },
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "0 MB"
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} GB`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`
  return `${n} B`
}

export function LaunchProgressOverlay({ progress, onCancel, onDismiss }: Props) {
  const { phase, message, loadedBytes, totalBytes, filesDone, filesTotal, error } = progress

  const isError = phase === "error"
  const isDone = phase === "running"
  const percent =
    totalBytes && totalBytes > 0
      ? Math.min(100, ((loadedBytes ?? 0) / totalBytes) * 100)
      : phase === "verifying" || phase === "launching"
        ? 100
        : undefined

  const activeIdx = PHASE_ORDER.indexOf(phase)

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Preparing the instance"
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/78 backdrop-blur-xl"
    >
      <div className="aetherion-glass aetherion-rise mx-6 w-full max-w-xl rounded-2xl border-primary/20 p-8">
        <div className="mb-6 flex items-center gap-3">
          <div
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-xl",
              isError
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/12 text-primary",
            )}
          >
            {isError ? (
              <ServerCrash className="size-5" />
            ) : isDone ? (
              <Rocket className="size-5" />
            ) : (
              <Loader2 className="size-5 animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-xl tracking-[0.06em] text-foreground">
              {isError
                ? "Preparation failed"
                : isDone
                  ? "Ready"
                  : "Preparing Aetherion..."}
            </h2>
            <p className="truncate text-xs text-muted-foreground">{message}</p>
          </div>
        </div>

        {/* Barra de progresso */}
        {!isError && (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn(
                  "h-full rounded-full bg-primary shadow-[0_0_16px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-all duration-300",
                  percent === undefined && "w-1/3 animate-pulse",
                )}
                style={percent !== undefined ? { width: `${percent}%` } : undefined}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] tracking-wide text-muted-foreground">
              <span>
                {filesTotal && filesTotal > 0
                  ? `${filesDone ?? 0} / ${filesTotal} files`
                  : "\u00a0"}
              </span>
              <span>
                {totalBytes
                  ? `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`
                  : percent !== undefined
                    ? `${percent.toFixed(0)}%`
                    : ""}
              </span>
            </div>
          </>
        )}

        {/* Erro */}
        {isError && error && (
          <div className="whitespace-pre-wrap break-words rounded-xl border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Etapas */}
        <ol className="mt-6 space-y-1.5">
          {PHASE_ORDER.map((p, i) => {
            const Icon = PHASE_META[p].icon
            const state: "done" | "active" | "pending" =
              isError && i === activeIdx
                ? "active"
                : i < activeIdx || isDone
                  ? "done"
                  : i === activeIdx
                    ? "active"
                    : "pending"

            return (
              <li key={p} className="flex items-center gap-3 rounded-lg px-1 py-1 text-sm">
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border",
                    state === "done" && "border-primary/35 bg-primary/10 text-primary",
                    state === "active" && "border-primary/50 bg-primary/15 text-primary",
                    state === "pending" && "border-white/8 bg-white/3 text-muted-foreground",
                  )}
                >
                  {state === "done" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : state === "active" ? (
                    <Icon
                      className={cn(
                        "size-3.5",
                        (p === "fetching-manifest" ||
                          p === "downloading-java" ||
                          p === "downloading-files") &&
                          "animate-pulse",
                      )}
                    />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </span>
                <span
                  className={cn(
                    state === "pending" && "text-muted-foreground",
                    state === "active" && "text-foreground font-medium",
                    state === "done" && "text-foreground/80",
                  )}
                >
                  {PHASE_META[p].label}
                </span>
              </li>
            )
          })}
        </ol>

        {/* Ações */}
        <div className="mt-8 flex justify-end gap-2">
          {isError || isDone ? (
            <button
              type="button"
              onClick={onDismiss}
              className="h-9 rounded-lg border border-white/10 px-4 text-sm text-foreground transition hover:bg-white/6"
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-lg border border-white/10 px-4 text-sm text-muted-foreground transition hover:bg-white/6 hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
