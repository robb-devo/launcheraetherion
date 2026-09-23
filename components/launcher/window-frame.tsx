"use client"

import { useEffect, useState } from "react"
import type React from "react"
import { Minus, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { DISCORD_URL, WEBSITE_URL } from "@/lib/launcher/social"
import { AetherionMark } from "./aetherion-mark"

/**
 * WindowFrame — simula a chrome de uma janela desktop.
 *
 * No preview web (Fase 1) os botões são decorativos. Na Fase 5 (Electron/Tauri),
 * estes botões serão conectados a `window.minimize()`, `window.maximize()` e
 * `window.close()` via bridge IPC. A janela real será `frame: false` +
 * `titleBarStyle: 'hidden'` (Electron) ou `decorations: false` (Tauri).
 */
export function WindowFrame({
  title = "Aetherion Launcher",
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(Boolean(window.aetherion))
  }, [])

  const minimize = () => window.aetherion?.window.minimize()
  const maximize = () => window.aetherion?.window.maximize()
  const close = () => window.aetherion?.window.close()

  return (
    <div
      className={cn(
        "w-full overflow-hidden text-foreground",
        isElectron
          ? "h-screen bg-background p-0"
          : "min-h-dvh flex items-center justify-center bg-background p-6 sm:p-10",
      )}
    >
      {!isElectron && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--magic)_16%,transparent),transparent_46%),radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_42%)]"
        />
      )}
      <div
        className={cn(
          "relative z-10 w-full overflow-hidden bg-background flex flex-col",
          isElectron
            ? "h-full rounded-none border-0 shadow-none"
            : "max-w-[1200px] h-[760px] rounded-2xl border border-white/10 shadow-[0_40px_120px_-36px_rgba(0,0,0,0.85)]",
          className,
        )}
      >
        <header
          className="h-11 shrink-0 flex items-center justify-between pl-4 pr-2 bg-background/80 border-b border-white/6 select-none"
          style={isElectron ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
        >
          <div className="flex items-center gap-2.5">
            <AetherionMark size={18} />
            <span className="text-[11px] font-medium tracking-[0.18em] uppercase text-foreground/75 font-serif">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ExternalLink href={WEBSITE_URL}>Website</ExternalLink>
            <ExternalLink href={DISCORD_URL}>Discord</ExternalLink>
            <WindowButton aria-label="Minimize" onClick={minimize}>
              <Minus className="size-3.5" />
            </WindowButton>
            <WindowButton aria-label="Maximize" onClick={maximize}>
              <Square className="size-3" />
            </WindowButton>
            <WindowButton aria-label="Close" variant="danger" onClick={close}>
              <X className="size-3.5" />
            </WindowButton>
          </div>
        </header>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      className="mr-1 h-8 rounded-md px-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80 transition hover:bg-white/6 hover:text-primary"
      onClick={() => {
        const open = window.aetherion?.shell?.openExternal
        if (open) {
          open(href).catch((err) => console.warn("[aetherion] failed to open link", err))
          return
        }
        window.open(href, "_blank", "noopener,noreferrer")
      }}
    >
      {children}
    </button>
  )
}

function WindowButton({
  children,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "danger" }) {
  return (
    <button
      type="button"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      className={cn(
        "h-8 w-10 rounded-md inline-flex items-center justify-center text-muted-foreground/80 transition-colors duration-150",
        "hover:bg-white/6 hover:text-foreground",
        variant === "danger" && "hover:bg-destructive hover:text-white",
      )}
      {...props}
    >
      {children}
    </button>
  )
}
