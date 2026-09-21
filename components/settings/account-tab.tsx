"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, Plus, Trash2, UserPlus, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AccountsState } from "@/lib/launcher/types"
import { MOCK_ACCOUNTS } from "@/lib/launcher/mock-data"
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
  const [state, setState] = useState<AccountsState>(() => ({
    activeId: MOCK_ACCOUNTS[0]?.id ?? null,
    accounts: MOCK_ACCOUNTS,
  }))
  const [mode, setMode] = useState<"idle" | "offline" | "microsoft">("idle")
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
      setMode("idle")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the account.")
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
      setError(e instanceof Error ? e.message : "Could not remove the account.")
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
      setError(e instanceof Error ? e.message : "Could not select the account.")
    }
  }

  function handleMicrosoftStub() {
    setError(
      "Microsoft sign-in needs the Electron process. It is available when the launcher is packaged.",
    )
  }

  function handleMicrosoftLogin() {
    if (!window.aetherion?.accounts?.addMicrosoft) {
      setError("Microsoft sign-in will be connected in the Electron process.")
      return
    }

    window.aetherion.accounts
      .addMicrosoft()
      .then(setState)
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Microsoft sign-in is not available in this build yet.",
        ),
      )
  }

  return (
    <div className="space-y-6">
      {/* Ações */}
      {mode === "idle" && (
        <div className="grid grid-cols-2 gap-3">
          <AddAccountButton
            label="Microsoft account"
            description="Official sign-in with OAuth"
            icon={<UserPlus className="size-4" />}
            onClick={handleMicrosoftLogin}
          />
          <AddAccountButton
            label="Offline account"
            description="Username only"
            icon={<Plus className="size-4" />}
            onClick={() => {
              setError(null)
              setMode("offline")
            }}
          />
        </div>
      )}

      {/* Form inline — conta offline */}
      {mode === "offline" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">New offline account</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The UUID is generated from the nickname using the same
                algorithm Mojang uses for offline players.
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 -mt-1 -mr-1"
              onClick={() => {
                setMode("idle")
                setUsername("")
                setError(null)
              }}
              aria-label="Cancel"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              autoFocus
              placeholder="Username (3–16 characters)"
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
      )}

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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {acc.username}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider border-border/60",
                          acc.type === "microsoft"
                            ? "text-magic border-magic/40"
                            : "text-muted-foreground",
                        )}
                      >
                        {acc.type}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground font-mono truncate">
                      {acc.uuid}
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

function AddAccountButton({
  label,
  description,
  icon,
  onClick,
}: {
  label: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 p-4 rounded-lg border border-dashed border-border/60 bg-card/50 hover:border-primary/40 hover:bg-primary/5 transition text-left"
    >
      <span className="size-10 inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}
