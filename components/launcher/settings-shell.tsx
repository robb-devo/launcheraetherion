"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Box, Cog, Coffee, Home, User } from "lucide-react"
import type React from "react"
import { cn } from "@/lib/utils"
import { LAUNCHER_VERSION } from "@/lib/launcher/version"
import { AetherionMark } from "./aetherion-mark"

const NAV = [
  { href: "/settings/account", label: "Account", icon: User },
  { href: "/settings/minecraft", label: "Minecraft", icon: Home },
  { href: "/settings/mods", label: "Mods", icon: Box },
  { href: "/settings/java", label: "Java", icon: Coffee },
  { href: "/settings/launcher", label: "Launcher", icon: Cog },
]

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="grid h-full w-full grid-cols-[248px_1fr]">
      <aside className="flex flex-col border-r border-white/8 bg-sidebar">
        <div className="flex items-center gap-3 px-6 pb-5 pt-7">
          <AetherionMark size={30} />
          <div>
            <p className="font-serif text-base leading-none tracking-[0.14em]">AETHERION</p>
            <p className="aetherion-kicker mt-2">Settings</p>
          </div>
        </div>

        <div className="aetherion-divider mx-6 h-px" />

        <nav className="flex-1 space-y-1 px-3 py-6">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg border px-3 text-sm transition duration-200",
                  active
                    ? "border-magic/30 bg-magic/10 text-magic shadow-[inset_2px_0_0_var(--magic)]"
                    : "border-transparent text-muted-foreground hover:bg-white/4 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="font-medium tracking-wide">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/8 p-3">
          <Link
            href="/launcher"
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-white/4 hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Back</span>
          </Link>
          <p className="aetherion-kicker mt-3 px-3">Launcher v{LAUNCHER_VERSION}</p>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="min-w-0 overflow-y-auto aetherion-scroll">{children}</main>
    </div>
  )
}

/**
 * SettingsPage — wrapper que dá consistência a título/descrição.
 */
export function SettingsPage({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-start justify-between gap-6 px-10 pb-6 pt-10">
        <div>
          <h1 className="font-serif text-[2rem] tracking-[0.06em] text-foreground">{title}</h1>
          {description && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      <div className="aetherion-divider h-px mx-10" />
      <div className="flex-1 px-10 py-8 space-y-8">{children}</div>
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-white/6 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
