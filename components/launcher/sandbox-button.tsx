"use client"

import { useState } from "react"
import { Box, Square, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  SANDBOX_DEFAULT_RAM_GB,
  SANDBOX_DEFAULT_TYPE,
  SANDBOX_RAM_GB,
  sanitizeSandboxName,
  type SandboxServer,
} from "@/lib/launcher/sandbox"
import { cn } from "@/lib/utils"

export function SandboxButton({ minecraftVersion }: { minecraftVersion: string }) {
  const [open, setOpen] = useState(false)
  const [servers, setServers] = useState<SandboxServer[]>([])
  const [name, setName] = useState("")
  const [ramGb, setRamGb] = useState<(typeof SANDBOX_RAM_GB)[number]>(SANDBOX_DEFAULT_RAM_GB)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function refresh() {
    if (!window.aetherion?.sandbox) {
      setServers([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await window.aetherion.sandbox.list()
      setServers(list.servers || [])
    } catch (err) {
      setError(readableError(err, "Could not load sandboxes."))
    } finally {
      setLoading(false)
    }
  }

  async function createServer() {
    const cleaned = sanitizeSandboxName(name)
    if (!cleaned) {
      setError("Name must be 2–24 chars (letters, numbers, hyphens).")
      setNotice(null)
      return
    }
    if (!window.aetherion?.sandbox) {
      setError("Create a sandbox from the desktop launcher.")
      setNotice(null)
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const created = await window.aetherion.sandbox.create({
        name: cleaned,
        version: minecraftVersion,
        ramGb,
        serverType: SANDBOX_DEFAULT_TYPE,
        startAfterCreate: true,
      })
      setName("")
      setNotice(created.address ? `Ready · ${created.address}` : "Sandbox created.")
      await refresh()
    } catch (err) {
      setError(readableError(err, "Could not create the sandbox."))
    } finally {
      setBusy(false)
    }
  }

  async function run(id: string, action: "start" | "stop" | "remove", done: string) {
    if (!window.aetherion?.sandbox) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setConfirmId(null)
    try {
      if (action === "start") await window.aetherion.sandbox.start(id)
      else if (action === "stop") await window.aetherion.sandbox.stop(id)
      else await window.aetherion.sandbox.remove(id)
      setNotice(done)
      await refresh()
    } catch (err) {
      setError(readableError(err, "Request failed."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void refresh()
        else setConfirmId(null)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <Box className="size-3.5" />
          Sandbox
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={10}
        className="w-[300px] rounded-xl border-white/10 bg-background/95 p-3 text-foreground shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="aetherion-kicker text-primary/85!">Sandbox</p>
          <p className="text-[10px] tracking-wide text-muted-foreground">
            {SANDBOX_DEFAULT_TYPE} {minecraftVersion}
          </p>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Isolated server. It does not join the live realm.
        </p>

        <div className="mt-3 flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createServer()
            }}
            placeholder="Name"
            maxLength={24}
            aria-label="Sandbox name"
            className="h-8 border-white/10 bg-white/4 text-sm"
          />
          <div className="flex shrink-0 rounded-lg border border-white/10 p-0.5">
            {SANDBOX_RAM_GB.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRamGb(value)}
                className={cn(
                  "h-7 rounded-md px-2 text-[10px] tracking-wide transition",
                  ramGb === value
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value} GB
              </button>
            ))}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void createServer()}
          className="mt-2 h-8 w-full bg-primary text-[11px] tracking-[0.16em] text-primary-foreground hover:bg-primary/90"
        >
          {busy ? "WORKING" : "CREATE"}
        </Button>

        {error && <p className="mt-2 text-xs leading-relaxed text-destructive">{error}</p>}
        {notice && <p className="mt-2 text-xs leading-relaxed text-primary">{notice}</p>}

        <div className="mt-3 border-t border-white/10 pt-2">
          {loading && servers.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Loading…</p>
          ) : servers.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No sandboxes yet.</p>
          ) : (
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {servers.map((server) => (
                <li
                  key={server.id}
                  className="rounded-lg border border-white/8 bg-white/3 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{server.name}</p>
                      <p className="truncate font-mono text-[11px] text-primary">{server.address}</p>
                      <p className="text-[10px] text-muted-foreground">{server.ramGb} GB</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Start ${server.name}`}
                        onClick={() => void run(server.id, "start", `Start queued · ${server.name}`)}
                        className="rounded-md px-1.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground transition hover:bg-white/6 hover:text-foreground disabled:opacity-40"
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Stop ${server.name}`}
                        onClick={() => void run(server.id, "stop", `Stop queued · ${server.name}`)}
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/6 hover:text-foreground disabled:opacity-40"
                      >
                        <Square className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={
                          confirmId === server.id ? `Confirm delete ${server.name}` : `Delete ${server.name}`
                        }
                        onClick={() => {
                          if (confirmId !== server.id) {
                            setConfirmId(server.id)
                            return
                          }
                          void run(server.id, "remove", `${server.name} deleted.`)
                        }}
                        className={cn(
                          "inline-flex h-6 items-center justify-center rounded-md px-1 text-muted-foreground transition hover:bg-white/6 hover:text-destructive disabled:opacity-40",
                          confirmId === server.id && "text-destructive",
                        )}
                      >
                        {confirmId === server.id ? (
                          <span className="text-[10px] uppercase tracking-wide">Delete</span>
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function readableError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback
  return raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
}
