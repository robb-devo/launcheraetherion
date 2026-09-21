"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cog, Globe, LogIn, Play, Youtube } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  MOCK_ACCOUNTS,
  DEFAULT_SETTINGS,
  MOCK_MANIFEST,
  MOCK_MOJANG_STATUS,
  MOCK_SERVER_STATUS,
} from "@/lib/launcher/mock-data"
import { simulateLaunch } from "@/lib/launcher/launch-simulator"
import type { Account, LauncherSettings, LaunchProgress } from "@/lib/launcher/types"
import { publicAssetPath } from "@/lib/public-path"
import { LAUNCHER_VERSION } from "@/lib/launcher/version"
import { AetherionMark } from "./aetherion-mark"
import { LaunchProgressOverlay } from "./launch-progress"

export function Dashboard() {
  const router = useRouter()
  const [activeAccount, setActiveAccount] = useState<Account | null>(MOCK_ACCOUNTS[0])
  const [settings, setSettings] = useState<LauncherSettings>(DEFAULT_SETTINGS)
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!window.aetherion?.accounts) return

    window.aetherion.accounts
      .list()
      .then((state) => {
        const active =
          state.accounts.find((account: Account) => account.id === state.activeId) ??
          state.accounts[0]
        if (active) setActiveAccount(active)
        else {
          setActiveAccount(null)
          router.replace("/login")
        }
      })
      .catch((err) => console.warn("[aetherion] failed to load account", err))
  }, [])

  useEffect(() => {
    if (!window.aetherion?.settings) return

    window.aetherion.settings
      .get()
      .then(setSettings)
      .catch((err) => console.warn("[aetherion] failed to load settings", err))
  }, [])

  // Fase 5 (Electron): esse handler chama window.aetherion.launch({ ... })
  // e escuta os mesmos eventos `LaunchProgress`. Aqui usamos o simulador
  // que percorre TODAS as fases reais do pipeline.
  async function handleLaunch() {
    const controller = new AbortController()
    if (!activeAccount) {
      router.push("/login")
      return
    }
    abortRef.current = controller
    setProgress({ phase: "fetching-manifest", message: "Starting..." })

    try {
      if (window.aetherion?.launch) {
        const unsubscribe = window.aetherion.launch.onProgress((p) => setProgress(p))
        try {
          await window.aetherion.launch.start({
            accountId: activeAccount.id,
            instanceId: MOCK_MANIFEST.instanceId ?? "aetherion-main",
            fullscreen: settings.minecraft.fullscreen,
            width: settings.minecraft.resolution.width,
            height: settings.minecraft.resolution.height,
            autoConnectServer: settings.minecraft.autoConnectServer,
            detachProcess: settings.minecraft.detachProcess,
            closeOnLaunch: settings.minecraft.closeOnLaunch,
          })
        } finally {
          unsubscribe()
        }
        setTimeout(() => {
          setProgress((current) => (current?.phase === "running" ? null : current))
        }, 1200)
        return
      }

      await simulateLaunch({
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      })
    } catch (err) {
      if (controller.signal.aborted) {
        setProgress(null)
        return
      }
      setProgress({
        phase: "error",
        message: "Preparation failed",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function cancel() {
    abortRef.current?.abort()
    window.aetherion?.launch.cancel().catch((err) => {
      console.warn("[aetherion] failed to cancel launch", err)
    })
    setProgress(null)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[url('/aetherion-bg.jpg')] bg-cover bg-[center_42%] scale-[1.03]">
        <div className="absolute inset-0 aetherion-scrim" />
        <div className="absolute inset-0 aetherion-vignette" />
        <div className="pointer-events-none absolute inset-0 aetherion-atmosphere" />
      </div>

      <div className="relative flex h-full flex-col">
        <header className="flex items-start justify-between gap-6 px-8 pt-7 aetherion-rise">
          <div className="flex items-center gap-3.5">
            <AetherionMark size={46} />
            <div>
              <h1 className="font-serif text-[1.7rem] leading-none tracking-[0.16em] text-foreground">
                AETHERION
              </h1>
              <p className="mt-2 flex items-center gap-2">
                <span className="aetherion-kicker text-primary/85!">Ethereal Realm</span>
                <span className="text-muted-foreground/40" aria-hidden>
                  ·
                </span>
                <span className="aetherion-kicker">v{LAUNCHER_VERSION}</span>
              </p>
            </div>
          </div>

          {activeAccount ? (
            <AccountBadge
              username={activeAccount.username}
              avatarUrl={activeAccount.avatarUrl}
              type={activeAccount.type}
            />
          ) : (
            <Button asChild variant="outline" className="h-11 border-white/10 bg-background/50 px-5 backdrop-blur-md">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </header>

        <div className="flex flex-1 items-end px-8 pb-5">
          <div className="aetherion-rise max-w-md" style={{ animationDelay: "80ms" }}>
            <p className="aetherion-kicker text-primary/90!">Main Realm</p>
            <p className="mt-3 font-serif text-5xl leading-none tracking-[0.18em] text-foreground drop-shadow-[0_10px_28px_rgba(0,0,0,0.72)]">
              AETHERION
            </p>
            <p className="mt-3 text-sm text-foreground/70">
              {MOCK_MANIFEST.minecraft} · Forge {MOCK_MANIFEST.forge.version}
            </p>
          </div>
        </div>

        <footer className="px-6 pb-6">
          <div className="aetherion-dock grid grid-cols-12 items-center gap-5 rounded-2xl px-5 py-4">
            <div className="col-span-5 flex items-center gap-6">
              <StatusBlock
                label="Players"
                value={`${MOCK_SERVER_STATUS.players.current} / ${MOCK_SERVER_STATUS.players.max}`}
                dotClass="bg-primary text-primary"
              />
              <span className="hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
              <StatusBlock
                label="Mojang"
                value={MOCK_MOJANG_STATUS.auth === "green" ? "Online" : "Unstable"}
                dotClass={
                  MOCK_MOJANG_STATUS.auth === "green"
                    ? "bg-primary text-primary"
                    : "bg-destructive text-destructive"
                }
              />
              <span className="hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
              <StatusBlock
                label="Ping"
                value={`${MOCK_SERVER_STATUS.ping ?? "--"} ms`}
                dotClass="bg-magic text-magic"
              />
            </div>

            <div className="col-span-3 flex items-center justify-center gap-2">
              <IconLink href="/settings/account" label="Settings">
                <Cog className="size-4" />
              </IconLink>
              <IconLink href="#" label="Site">
                <Globe className="size-4" />
              </IconLink>
              <IconLink href="#" label="YouTube">
                <Youtube className="size-4" />
              </IconLink>
              <IconLink href="#" label="Discord">
                <DiscordMark />
              </IconLink>
            </div>

            <div className="col-span-4 flex items-center justify-end gap-4">
              <div className="text-right">
                <p className="aetherion-kicker">Instance</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {MOCK_MANIFEST.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {MOCK_MANIFEST.minecraft} · v{MOCK_MANIFEST.version}
                </p>
              </div>

              <Button
                size="lg"
                onClick={handleLaunch}
                disabled={progress !== null && progress.phase !== "error" && progress.phase !== "running"}
                className={cn(
                  "h-14 min-w-[168px] rounded-xl px-7 font-serif text-base tracking-[0.22em]",
                  "bg-primary text-primary-foreground hover:bg-primary/92",
                  "aetherion-gold-glow aetherion-sheen",
                )}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Play className="size-4 fill-primary-foreground" />
                  PLAY
                </span>
              </Button>
            </div>
          </div>
        </footer>
      </div>

      {progress && (
        <LaunchProgressOverlay
          progress={progress}
          onCancel={cancel}
          onDismiss={() => setProgress(null)}
        />
      )}
    </div>
  )
}

function StatusBlock({
  label,
  value,
  dotClass,
}: {
  label: string
  value: string
  dotClass: string
}) {
  return (
    <div>
      <p className="aetherion-kicker">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full aetherion-live", dotClass)} />
        <span className="text-sm font-medium tracking-wide text-foreground">{value}</span>
      </div>
    </div>
  )
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/4 text-muted-foreground transition duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
    >
      {children}
    </Link>
  )
}

function AccountBadge({
  username,
  avatarUrl,
  type,
}: {
  username: string
  avatarUrl?: string
  type: "offline" | "microsoft"
}) {
  return (
    <div className="aetherion-glass flex items-center gap-3 rounded-xl px-3 py-2">
      <div className="text-right">
        <p className="text-sm font-medium leading-tight text-foreground">{username}</p>
        <p className="aetherion-kicker mt-1">
          {type === "microsoft" ? "Microsoft" : "Offline"}
        </p>
      </div>
      <Avatar className="size-10 rounded-lg ring-1 ring-primary/40">
        <AvatarImage src={publicAssetPath(avatarUrl || "/placeholder.svg")} alt={username} />
        <AvatarFallback className="rounded-lg bg-muted text-primary">
          {username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <Link
        href="/login"
        aria-label="Switch account"
        className="ml-0.5 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/6 hover:text-primary"
      >
        <LogIn className="size-4" />
      </Link>
    </div>
  )
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M19.27 5.33A17.4 17.4 0 0 0 15.09 4l-.4.73a16.1 16.1 0 0 1 4.08 1.27 16.6 16.6 0 0 0-13.54 0A16.4 16.4 0 0 1 9.3 4.73L8.91 4a17.4 17.4 0 0 0-4.18 1.33C2.2 9.02 1.5 12.6 1.85 16.13A17.6 17.6 0 0 0 7.1 18.7l.82-1.12a11.5 11.5 0 0 1-1.82-.87l.45-.35c3.52 1.63 7.34 1.63 10.8 0l.46.35c-.58.35-1.19.64-1.82.87l.82 1.12a17.5 17.5 0 0 0 5.25-2.57c.5-4.06-.72-7.6-2.79-10.8ZM8.68 14.3c-1.05 0-1.92-.98-1.92-2.17 0-1.2.85-2.18 1.92-2.18 1.08 0 1.94.99 1.92 2.18 0 1.19-.85 2.17-1.92 2.17Zm6.64 0c-1.05 0-1.92-.98-1.92-2.17 0-1.2.85-2.18 1.92-2.18 1.08 0 1.94.99 1.92 2.18 0 1.19-.84 2.17-1.92 2.17Z"
      />
    </svg>
  )
}
