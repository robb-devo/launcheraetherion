"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Play, RotateCcw, Square, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  SANDBOX_PRESETS,
  SANDBOX_TYPES,
  type SandboxCreateInput,
  type SandboxOptions,
  type SandboxLiveStatus,
  type SandboxServer,
  type SandboxType,
} from "@/lib/launcher/sandbox"
import type { Account, LauncherSettings, LaunchProgress } from "@/lib/launcher/types"
import { CLIENT_PACK } from "@/lib/launcher/mock-data"
import { LaunchProgressOverlay } from "./launch-progress"

const EMPTY_OPTIONS: SandboxOptions = {
  presets: SANDBOX_PRESETS,
  serverTypes: SANDBOX_TYPES,
  versions: {},
}

export function SandboxFactory() {
  const router = useRouter()
  const [options, setOptions] = useState<SandboxOptions>(EMPTY_OPTIONS)
  const [servers, setServers] = useState<SandboxServer[]>([])
  const [name, setName] = useState("")
  const [serverType, setServerType] = useState<SandboxType>("paper")
  const [version, setVersion] = useState("")
  const [preset, setPreset] = useState("16")
  const [account, setAccount] = useState<Account | null>(null)
  const [settings, setSettings] = useState<LauncherSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspected, setInspected] = useState<SandboxServer | null>(null)
  const [live, setLive] = useState<SandboxLiveStatus | null>(null)
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const versions = options.versions?.[serverType] ?? []
  const selectedVersion = useMemo(() => {
    if (version && versions.includes(version)) return version
    return versions[0] || version
  }, [version, versions])
  const presetInfo = SANDBOX_PRESETS.find((item) => item.value === preset) ?? SANDBOX_PRESETS[0]

  useEffect(() => {
    if (!window.aetherion?.launch) return
    return window.aetherion.launch.onProgress((next) => setProgress(next))
  }, [])

  useEffect(() => {
    if (!window.aetherion) return
    window.aetherion.accounts
      .list()
      .then((state) => {
        const active =
          state.accounts.find((item) => item.id === state.activeId) ?? state.accounts[0] ?? null
        setAccount(active)
      })
      .catch((err) => setError(readableError(err, "Could not load the account.")))
    window.aetherion.settings
      .get()
      .then(setSettings)
      .catch(() => undefined)
    void refresh().catch((err) => setError(readableError(err, "Could not load servers.")))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || !window.aetherion?.sandbox?.inspect) return
    let stopped = false
    const load = () => {
      window.aetherion?.sandbox
        .inspect(selectedId)
        .then((result) => {
          if (stopped) return
          setInspected(result.server)
          setLive(result.live)
        })
        .catch((err) => {
          if (!stopped) setError(readableError(err, "Could not open that server."))
        })
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [selectedId])

  async function refresh() {
    if (!window.aetherion?.sandbox) return
    setError(null)
    const [nextOptions, list] = await Promise.all([
      window.aetherion.sandbox.options(),
      window.aetherion.sandbox.list(),
    ])
    const allowed = new Set(["vanilla", "paper", "fabric", "purpur"])
    const serverTypes = (nextOptions.serverTypes || []).filter((item) => allowed.has(item.value))
    setOptions({
      ...EMPTY_OPTIONS,
      ...nextOptions,
      presets: SANDBOX_PRESETS,
      serverTypes: serverTypes.length ? serverTypes : SANDBOX_TYPES,
      versions: nextOptions.versions || {},
    })
    setServers(list.servers || [])
  }

  async function createServer() {
    if (!window.aetherion?.sandbox) {
      setError("Create a server from the desktop launcher.")
      return
    }
    if (!account || account.type !== "microsoft") {
      router.push("/login")
      return
    }
    const clean = name.trim()
    const cleaned = clean.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
    if (cleaned.length < 2 || cleaned.length > 24) {
      setError("Name must be 2–24 chars (letters, numbers, hyphens).")
      return
    }
    if (!selectedVersion) {
      setError("Choose a version once the control API answers.")
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const input: SandboxCreateInput = {
      name: clean,
      serverType,
      version: selectedVersion,
      ramGb: presetInfo.ramGb,
      cpuCores: presetInfo.cpuCores,
      preset: "custom",
      onlineMode: true,
      startAfterCreate: true,
    }
    try {
      const created = await window.aetherion.sandbox.create(input)
      setNotice(created.address ? `Ready · ${created.address}` : "Server created.")
      setName("")
      await refresh()
    } catch (err) {
      setError(readableError(err, "Could not create the server."))
    } finally {
      setBusy(false)
    }
  }

  async function runAction(action: () => Promise<unknown>, done: string) {
    if (!window.aetherion?.sandbox) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(done)
      await refresh()
    } catch (err) {
      setError(readableError(err, "Request failed."))
    } finally {
      setBusy(false)
    }
  }

  async function play(server: SandboxServer) {
    if (!window.aetherion?.launch) {
      setError("Play runs in the desktop launcher.")
      return
    }
    if (!account) {
      router.push("/login")
      return
    }
    const [host, portText] = server.address.split(":")
    const port = Number(portText)
    setProgress({ phase: "fetching-manifest", message: "Fetching the pack..." })
    try {
      await window.aetherion.launch.start({
        accountId: account.id,
        instanceId: CLIENT_PACK.id,
        fullscreen: settings?.minecraft.fullscreen ?? false,
        width: settings?.minecraft.resolution.width ?? 1280,
        height: settings?.minecraft.resolution.height ?? 720,
        autoConnectServer: false,
        isolated: true,
        detachProcess: settings?.minecraft.detachProcess ?? true,
        closeOnLaunch: settings?.minecraft.closeOnLaunch ?? false,
        serverHost: host,
        serverPort: Number.isInteger(port) ? port : undefined,
        serverName: server.name,
        minecraftVersion: server.version,
      })
      window.setTimeout(() => {
        setProgress((current) => (current?.phase === "running" ? null : current))
      }, 1400)
    } catch (err) {
      setProgress({
        phase: "error",
        message: "Preparation failed",
        error: readableError(err, "Could not launch."),
      })
    }
  }

  const listed = servers.find((server) => server.id === selectedId) || null
  const selected = (
    selectedId && (inspected?.id === selectedId || listed)
      ? { ...(listed || {}), ...(inspected?.id === selectedId ? inspected : {}) }
      : null
  ) as SandboxServer | null

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[url('/aetherion-bg.jpg')] bg-cover bg-[center_42%] opacity-40" />
      <div className="absolute inset-0 aetherion-scrim" />
      <div className="relative flex h-full flex-col">
        <header className="flex items-center justify-between gap-4 px-8 pt-7">
          <div>
            <p className="aetherion-kicker text-primary/85!">Sandbox factory</p>
            <h1 className="mt-2 font-serif text-3xl tracking-[0.12em] text-foreground">Your server</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              A private server on spare capacity. It does not join or change the live realm.
            </p>
          </div>
          <Link
            href="/launcher"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Realm
          </Link>
        </header>

        <div ref={scrollRef} className="aetherion-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-8 py-6">
          {selected ? (
            <SandboxDetail
              server={selected}
              live={live}
              busy={busy}
              error={error}
              notice={notice}
              onBack={() => {
                setSelectedId(null)
                setInspected(null)
                setLive(null)
              }}
              onStart={() =>
                void runAction(() => window.aetherion!.sandbox.start(selected.id), `Start queued · ${selected.address}`)
              }
              onStop={() =>
                void runAction(() => window.aetherion!.sandbox.stop(selected.id), `Stop queued · ${selected.address}`)
              }
              onRestart={() =>
                void runAction(
                  () => window.aetherion!.sandbox.restart(selected.id),
                  `Restart queued · ${selected.address}`,
                )
              }
              onDelete={() =>
                void runAction(async () => {
                  const result = await window.aetherion!.sandbox.remove(selected.id)
                  setSelectedId(null)
                  setInspected(null)
                  return result
                }, `${selected.name} deleted.`)
              }
              onPlay={() => void play(selected)}
            />
          ) : (
          <>
          <section className="aetherion-glass rounded-2xl p-5">
            <p className="aetherion-kicker">New server</p>
            <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="my-server"
                maxLength={24}
                className="mt-2 h-11 border-white/10 bg-white/4"
              />
            </label>

            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-muted-foreground">Engine</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {options.serverTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setServerType(item.value)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition",
                    serverType === item.value
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/10 bg-white/3 hover:border-white/20",
                  )}
                >
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{item.blurb}</span>
                </button>
              ))}
            </div>

            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-muted-foreground">Version</p>
            {versions.length === 0 ? (
              <>
                <Input
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  placeholder="1.21.1"
                  aria-label="Version"
                  className="mt-2 h-11 max-w-xs border-white/10 bg-white/4"
                />
                <p className="mt-2 text-xs text-muted-foreground">Versions load from the control API.</p>
              </>
            ) : (
              <VersionSelect versions={versions} value={selectedVersion} onChange={setVersion} />
            )}

            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-muted-foreground">RAM / CPU</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SANDBOX_PRESETS.map((item) => (
                <Chip key={item.value} active={preset === item.value} onClick={() => setPreset(item.value)}>
                  {item.label}
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {item.ramGb}G · {item.cpuCores}C
                  </span>
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {presetInfo.blurb}. Join address uses the host the control API assigns.
            </p>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            {notice && <p className="mt-4 text-sm text-primary">{notice}</p>}

            <Button
              type="button"
              disabled={busy}
              onClick={() => void createServer()}
              className="mt-5 h-11 bg-primary px-6 font-serif tracking-[0.16em] text-primary-foreground hover:bg-primary/90"
            >
              {busy ? "WORKING..." : "CREATE"}
            </Button>
          </section>

          <section>
            <p className="aetherion-kicker">Your servers</p>
            {servers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No servers yet for this Microsoft account.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {servers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => setSelectedId(server.id)}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-background/55 px-4 py-4 transition hover:border-primary/40"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(server.id)}>
                      <p className="font-semibold text-foreground">{server.name}</p>
                      <p className="mt-1 font-mono text-sm text-primary">{server.address}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{serverMeta(server)}</p>
                    </button>
                    <ServerActions
                      busy={busy}
                      onStart={() =>
                        void runAction(
                          () => window.aetherion!.sandbox.start(server.id),
                          `Start queued · ${server.address}`,
                        )
                      }
                      onStop={() =>
                        void runAction(
                          () => window.aetherion!.sandbox.stop(server.id),
                          `Stop queued · ${server.address}`,
                        )
                      }
                      onPlay={() => void play(server)}
                      onDelete={() =>
                        void runAction(
                          () => window.aetherion!.sandbox.remove(server.id),
                          `${server.name} deleted.`,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
          </>
          )}
        </div>
      </div>

      {progress && (
        <LaunchProgressOverlay
          progress={progress}
          onCancel={() => {
            window.aetherion?.launch.cancel().catch(() => undefined)
            setProgress(null)
          }}
          onDismiss={() => setProgress(null)}
        />
      )}
    </div>
  )
}

function SandboxDetail({
  server,
  live,
  busy,
  error,
  notice,
  onBack,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onPlay,
}: {
  server: SandboxServer
  live: SandboxLiveStatus | null
  busy: boolean
  error: string | null
  notice: string | null
  onBack: () => void
  onStart: () => void
  onStop: () => void
  onRestart: () => void
  onDelete: () => void
  onPlay: () => void
}) {
  const status =
    live?.state === "online" ? "Online" : live?.state === "offline" ? "Offline" : "Unknown"
  const dot =
    live?.state === "online"
      ? "bg-primary text-primary"
      : live?.state === "offline"
        ? "bg-destructive text-destructive"
        : "bg-muted-foreground text-muted-foreground"
  const players = live?.players ? `${live.players.current} / ${live.players.max}` : "—"
  return (
    <div className="aetherion-glass aetherion-rise rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Servers
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full aetherion-live", dot)} />
          <span className="text-sm font-medium tracking-wide text-foreground">{status}</span>
        </div>
      </div>

      <p className="aetherion-kicker mt-5 text-primary/85!">Sandbox</p>
      <h2 className="mt-2 font-serif text-3xl tracking-[0.12em] text-foreground">{server.name}</h2>
      <p className="mt-2 font-mono text-sm text-primary">{server.address}</p>
      <p className="mt-1 text-xs text-muted-foreground">{serverMeta(server)}</p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && <p className="mt-4 text-sm text-primary">{notice}</p>}

      <div className="mt-5">
        <ServerActions
          busy={busy}
          onStart={onStart}
          onStop={onStop}
          onRestart={onRestart}
          onPlay={onPlay}
          onDelete={onDelete}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
        <Metric label="Players" value={players} dot={dot} />
        <Metric label="Ping" value={live?.ping != null ? `${live.ping} ms` : "—"} dot="bg-magic text-magic" />
        <Metric label="MOTD" value={server.motd || live?.motd || "—"} dot="bg-primary/70 text-primary" />
      </div>

      <p className="aetherion-kicker mt-6">World</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Engine" value={server.serverType} />
        <Fact label="Version" value={server.version} />
        <Fact label="RAM" value={server.ramGb ? `${server.ramGb} GB` : "—"} />
        <Fact label="CPU" value={server.cpuCores ? `${server.cpuCores}` : "—"} />
        <Fact label="Max players" value={server.maxPlayers != null ? String(server.maxPlayers) : "—"} />
        <Fact label="View" value={server.viewDistance != null ? String(server.viewDistance) : "—"} />
        <Fact label="Simulation" value={server.simulationDistance != null ? String(server.simulationDistance) : "—"} />
        <Fact label="Difficulty" value={server.difficulty || "—"} />
        <Fact label="Gamemode" value={server.gamemode || "—"} />
        <Fact label="Online mode" value={server.onlineMode == null ? "—" : server.onlineMode ? "On" : "Off"} />
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Plugins and the console are not on the friend-key API. Start, stop, restart, and delete are. World values are the ones stored when this server was created.
      </p>
    </div>
  )
}

function ServerActions({
  busy,
  onStart,
  onStop,
  onRestart,
  onPlay,
  onDelete,
}: {
  busy: boolean
  onStart: () => void
  onStop: () => void
  onRestart?: () => void
  onPlay: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onStart}>
        Start
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onStop}>
        <Square className="size-3.5" />
        Stop
      </Button>
      {onRestart ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRestart}>
          <RotateCcw className="size-3.5" />
          Restart
        </Button>
      ) : null}
      <Button type="button" size="sm" disabled={busy} onClick={onPlay}>
        <Play className="size-3.5 fill-primary-foreground" />
        Play
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        className="text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
    </div>
  )
}

function Metric({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div>
      <p className="aetherion-kicker">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full aetherion-live", dot)} />
        <span className="truncate text-sm font-medium tracking-wide text-foreground">{value}</span>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-3">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function serverMeta(server: SandboxServer) {
  const ram = server.ramGb ? `${server.ramGb}G` : "—"
  const cpu = server.cpuCores ? `${server.cpuCores}C` : "—"
  return `${server.serverType} ${server.version} · ${ram} · ${cpu}`
}

function VersionSelect({
  versions,
  value,
  onChange,
}: {
  versions: string[]
  value: string
  onChange: (version: string) => void
}) {
  return (
    <div className="mt-2 max-w-xs">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Version"
          className="h-11 w-full rounded-lg border-white/10 bg-white/4 px-3 text-sm text-foreground shadow-none hover:border-primary/40 focus-visible:border-primary/50 focus-visible:ring-primary/30 data-[size=default]:h-11 data-[state=open]:border-primary/50"
        >
          <SelectValue placeholder="Choose a version" />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-white/10 bg-popover/95 text-foreground shadow-xl backdrop-blur-md">
          {versions.map((item) => (
            <SelectItem
              key={item}
              value={item}
              className="rounded-lg py-2 focus:bg-primary/15 focus:text-foreground data-[highlighted]:bg-primary/15 data-[state=checked]:text-foreground [&_svg]:text-primary"
            >
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-2 text-xs text-muted-foreground">
        {versions.length} versions for this engine.
      </p>
    </div>
  )
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3 text-xs tracking-wide transition",
        active
          ? "border-magic/50 bg-magic/15 text-foreground"
          : "border-white/10 bg-white/4 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function readableError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback
  return raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
}
