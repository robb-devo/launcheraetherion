"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AetherionMark } from "./aetherion-mark"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleMicrosoft() {
    if (busy) return
    if (!window.aetherion?.accounts) {
      setError("Microsoft sign-in runs in the desktop launcher.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.aetherion.accounts.addMicrosoft()
      router.push("/launcher")
    } catch (e) {
      setError(readableError(e, "Microsoft sign-in failed."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full w-full grid-cols-12">
      <div className="relative col-span-5 overflow-hidden border-r border-white/8 bg-[url('/aetherion-bg.jpg')] bg-cover bg-[center_40%]">
        <div className="absolute inset-0 aetherion-scrim" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" />
        <div className="absolute inset-0 aetherion-vignette" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <AetherionMark size={36} />
            <span className="font-serif text-lg tracking-[0.16em]">AETHERION</span>
          </div>
          <div>
            <p className="aetherion-kicker text-primary/85!">Ethereal Realm</p>
            <p className="mt-3 font-serif text-[2rem] leading-[1.15] text-balance text-foreground drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
              Cross the veil.
              <br />
              <span className="text-primary">Step into the realm.</span>
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground/70">
              Sign in with Microsoft, then press play. The launcher prepares the
              realm and starts the game.
            </p>
          </div>
        </div>
      </div>

      <div className="relative col-span-7 flex items-center justify-center bg-background/40 p-10">
        <Link
          href="/launcher"
          aria-label="Cancel"
          className="absolute top-6 right-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-4" /> Cancel
        </Link>

        <div className="aetherion-rise w-full max-w-sm">
          <h1 className="font-serif text-3xl tracking-[0.12em] text-foreground">Enter</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Microsoft is the way in. The launcher uses that profile to play.
          </p>

          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleMicrosoft()}
            className="mt-8 h-11 w-full gap-2 bg-primary font-serif tracking-[0.16em] text-primary-foreground hover:bg-primary/90 aetherion-gold-glow aetherion-sheen"
          >
            {busy ? "WAITING..." : "SIGN IN WITH MICROSOFT"}
          </Button>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/90 leading-relaxed">{error}</p>
            </div>
          )}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/80">
            Aetherion does not store account data on its own servers.
          </p>
        </div>
      </div>
    </div>
  )
}

function readableError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback
  return raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
}
