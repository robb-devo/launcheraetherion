"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AccountsState } from "@/lib/launcher/types"
import {
  addOfflineAccount,
  removeAccount as removeAccountLib,
  setActiveAccount,
  validateOfflineUsername,
} from "@/lib/launcher/accounts"
import { publicAssetPath } from "@/lib/public-path"
import { cn } from "@/lib/utils"

/**
 * Usa a lib pura `lib/launcher/accounts.ts` com React state como storage
 * temporário para o preview. Na Fase 5 (Electron), o estado persiste em
 * `%APPDATA%/.aetherion/accounts.json` via `window.aetherion.accounts.*`.
 */
export function AccountTab() {
  const router = useRouter()
  const [state, setState] = useState<AccountsState>({ activeId: null, accounts: [] })
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!window.aetherion?.accounts) return

    window.aetherion.accounts
      .list()
      .then(setState)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load local accounts."),
      )
  }, [])

  const validationError = useMemo(
    () => (username ? validateOfflineUsername(username) : null),
    [username],
  )

  async function handleAddOffline() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const next = window.aetherion?.accounts
        ? await window.aetherion.accounts.addOffline(username)
        : await addOfflineAccount(state, username)
      setState(next)
      setUsername("")
    } catch (e) {
      setError(readableError(e, "Could not add the account."))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      let next: AccountsState
      if (window.aetherion?.accounts) {
        next = await window.aetherion.accounts.remove(id)
      } else {
        next = removeAccountLib(state, id)
      }
      setState(next)
      if (next.accounts.length === 0) router.replace("/login")
    } catch (e) {
      setError(readableError(e, "Could not remove the account."))
    }
  }

  async function handleSelect(id: string) {
    setError(null)
    try {
      if (window.aetherion?.accounts) {
        setState(await window.aetherion.accounts.setActive(id))
      } else {
        setState((prev) => setActiveAccount(prev, id))
      }
    } catch (e) {
      setError(readableError(e, "Could not select the account."))
    }
  }

  async function handleMicrosoft() {
    if (busy) return
    if (!window.aetherion?.accounts) {
      setError("Microsoft sign-in runs in the desktop launcher.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      setState(await window.aetherion.accounts.addMicrosoft())
    } catch (e) {
      setError(readableError(e, "Microsoft sign-in failed."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">Microsoft</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used to play and to own your servers. Stays on this computer.
        </p>
        <Button
          type="button"
          onClick={() => void handleMicrosoft()}
          disabled={busy}
          className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Sign in with Microsoft
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/3 p-4">
        <p className="text-sm font-medium text-foreground">Player name</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used in game. Saved only on this computer.
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            autoFocus
            placeholder="Name (3–16 characters)"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !validationError) handleAddOffline()
            }}
            maxLength={16}
            className="bg-input/40 font-mono"
            aria-invalid={!!validationError}
          />
          <Button
            onClick={handleAddOffline}
            disabled={!username || !!validationError || busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Add
          </Button>
        </div>

        {validationError && (
          <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-3" />
            {validationError}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/90 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Lista */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Current accounts ({state.accounts.length})
        </p>
        {state.accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No accounts yet. Add one above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {state.accounts.map((acc) => {
              const active = acc.id === state.activeId
              return (
                <div
                  key={acc.id}
                  className={cn(
                    "group flex items-center gap-4 rounded-xl border p-4 transition duration-200",
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-card hover:border-border",
                  )}
                >
                  <Avatar className="size-12 rounded-md ring-1 ring-border">
                    <AvatarImage
                      src={publicAssetPath(acc.avatarUrl || "/placeholder.svg")}
                      alt={acc.username}
                    />
                    <AvatarFallback className="rounded-md bg-muted text-primary">
                      {acc.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {acc.username}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground font-mono truncate">
                      {acc.type === "microsoft" ? "Microsoft" : "Offline"} · {acc.uuid}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {active ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs">
                        <Check className="size-3" />
                        Selected
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSelect(acc.id)}
                        className="h-8 text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        Select
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(acc.id)}
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${acc.username}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function readableError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback
  return raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
}
