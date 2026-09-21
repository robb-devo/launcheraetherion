"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertCircle, ArrowRight, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { addOfflineAccount, validateOfflineUsername } from "@/lib/launcher/accounts"
import type { AccountsState } from "@/lib/launcher/types"
import { publicAssetPath } from "@/lib/public-path"
import { AetherionMark } from "./aetherion-mark"

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    const validation = validateOfflineUsername(username)
    if (validation) {
      setError(validation)
      return
    }

    setBusy(true)
    setError(null)

    try {
      if (window.aetherion?.accounts) {
        await window.aetherion.accounts.addOffline(username)
      } else {
        const previewState: AccountsState = { activeId: null, accounts: [] }
        await addOfflineAccount(previewState, username)
      }
      router.push("/launcher")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar conta offline.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full w-full grid-cols-12">
      <div className="relative col-span-5 overflow-hidden border-r border-white/8">
        <Image
          src={publicAssetPath("/aetherion-bg.jpg")}
          alt=""
          fill
          priority
          className="object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 aetherion-scrim" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" />
        <div className="absolute inset-0 aetherion-vignette" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <AetherionMark size={36} />
            <span className="font-serif text-lg tracking-[0.16em]">AETHERION</span>
          </div>
          <div>
            <p className="aetherion-kicker text-primary/85!">Reino Etéreo</p>
            <p className="mt-3 font-serif text-[2rem] leading-[1.15] text-balance text-foreground drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
              Cruze o veu.
              <br />
              <span className="text-primary">Forje sua lenda.</span>
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground/70">
              Entre em modo offline local. Login Microsoft sera conectado depois,
              com tokens guardados apenas no cofre do sistema.
            </p>
          </div>
        </div>
      </div>

      <div className="relative col-span-7 flex items-center justify-center bg-background/40 p-10">
        <Link
          href="/launcher"
          aria-label="Cancelar"
          className="absolute top-6 right-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-4" /> Cancelar
        </Link>

        <div className="aetherion-rise w-full max-w-sm">
          <h1 className="font-serif text-3xl tracking-[0.12em] text-foreground">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta fica salva somente neste computador.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const login = window.aetherion?.accounts?.addMicrosoft?.()
              if (!login) {
                setError("Login Microsoft sera implementado no processo Electron.")
                return
              }
              login
                .then(() => router.push("/launcher"))
                .catch((e) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Login Microsoft ainda nao esta disponivel neste build.",
                  ),
                )
            }}
            className="mt-8 h-11 w-full justify-center gap-3 border-white/10 bg-white/4 hover:bg-white/8"
          >
            <MicrosoftLogo />
            <span className="text-sm font-medium">Continuar com Microsoft</span>
          </Button>

          <div className="flex items-center gap-4 my-6">
            <Separator className="flex-1 bg-border/60" />
            <span className="aetherion-kicker">
              ou modo offline
            </span>
            <Separator className="flex-1 bg-border/60" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="username" className="aetherion-kicker">
                Nome de usuario
              </FieldLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError(null)
                  }}
                  placeholder="Steve"
                  className="h-11 border-white/10 bg-white/4 pl-10"
                  required
                  minLength={3}
                  maxLength={16}
                />
              </div>
              <FieldDescription className="text-[11px]">
                Use 3 a 16 caracteres. Nenhuma senha e pedida ou enviada.
              </FieldDescription>
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/90 leading-relaxed">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="mt-6 h-11 w-full gap-2 bg-primary font-serif tracking-[0.2em] text-primary-foreground hover:bg-primary/90 aetherion-gold-glow aetherion-sheen"
            >
              {busy ? "SALVANDO..." : "ENTRAR"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/80">
            O Aetherion nao armazena dados de conta em servidores proprios.
          </p>
        </div>
      </div>
    </div>
  )
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="size-4" aria-hidden>
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  )
}
