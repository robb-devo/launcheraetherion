import {
  CheckCircle2,
  Download,
  MessageCircle,
  Package,
  Server,
  Settings,
  Shield,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AetherionMark } from "@/components/launcher/aetherion-mark"
import { MOCK_MANIFEST } from "@/lib/launcher/mock-data"
import { launcherDownloadUrl, releasePageUrl } from "@/lib/launcher/github-releases"
import { LAUNCHER_VERSION } from "@/lib/launcher/version"
import { publicAssetPath } from "@/lib/public-path"

const WINDOWS_INSTALLER_FILENAME = `Aetherion.Launcher.Setup.${LAUNCHER_VERSION}.exe`
const LAUNCHER_REPO = {
  owner: "washryan",
  repo: "launcheraetherion",
}

const WINDOWS_DOWNLOAD_URL = launcherDownloadUrl(
  LAUNCHER_VERSION,
  WINDOWS_INSTALLER_FILENAME,
  LAUNCHER_REPO,
)
const LAUNCHER_RELEASE_URL = releasePageUrl(LAUNCHER_VERSION, LAUNCHER_REPO)
const MODPACK_RELEASE_URL = releasePageUrl(MOCK_MANIFEST.version, LAUNCHER_REPO)
const REQUIRED_MODS = MOCK_MANIFEST.files.filter((file) => file.type === "required")
const OPTIONAL_MODS = MOCK_MANIFEST.files.filter((file) => file.type === "optional")
const FEATURED_MODS = REQUIRED_MODS.slice(0, 12)

export default function DownloadPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${publicAssetPath("/aetherion-bg.jpg")})` }}
        />
        <div className="absolute inset-0 aetherion-scrim" />
        <div className="absolute inset-0 aetherion-atmosphere" />
      </div>
      <header className="relative border-b border-white/8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <AetherionMark size={36} />
            <div className="min-w-0">
              <p className="font-serif text-lg tracking-[0.14em]">AETHERION</p>
              <p className="aetherion-kicker mt-1">Reino Etéreo</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a
              href={MOCK_MANIFEST.endpoints?.discord}
              className="text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5"
            >
              <MessageCircle className="size-4" />
              Discord
            </a>
            <a
              href={LAUNCHER_RELEASE_URL}
              className="text-muted-foreground hover:text-foreground transition"
            >
              Releases
            </a>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 py-16 md:py-20">
        <Badge
          variant="outline"
          className="mb-6 border-primary/40 text-[10px] uppercase tracking-[0.22em] text-primary"
        >
          Windows x64 • Minecraft {MOCK_MANIFEST.minecraft} • Forge {MOCK_MANIFEST.forge.version}
        </Badge>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="font-serif text-5xl tracking-[0.14em] text-balance md:text-6xl">
              AETHERION
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl text-balance">
              Baixe o launcher oficial para Windows, entre com sua conta local e jogue com
              Forge, mods, shaders, Java e integridade preparados pelo Aetherion.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="h-12 gap-2 px-6 aetherion-gold-glow aetherion-sheen">
                <a href={WINDOWS_DOWNLOAD_URL}>
                  <Download className="size-4" />
                  Baixar launcher para Windows
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-5 bg-transparent"
              >
                <a href={LAUNCHER_RELEASE_URL}>Ver release</a>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Launcher v{LAUNCHER_VERSION} • Modpack v{MOCK_MANIFEST.version} •{" "}
              {WINDOWS_INSTALLER_FILENAME}
            </p>
          </div>

          <div className="aetherion-glass rounded-2xl p-5">
            <p className="font-serif text-xl tracking-wide">Download Windows</p>
            <div className="mt-5 grid gap-3 text-sm">
              <DownloadRow label="Sistema" value="Windows 10/11 x64" />
              <DownloadRow label="Arquivo" value={WINDOWS_INSTALLER_FILENAME} />
              <DownloadRow label="Instalador" value="NSIS, atalho e desinstalador" />
              <DownloadRow label="Modpack" value={`${REQUIRED_MODS.length} obrigatorios`} />
              <DownloadRow label="Opcionais" value={`${OPTIONAL_MODS.length} selecionaveis`} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/40 bg-card/20">
        <div className="max-w-5xl mx-auto px-6 py-14 grid gap-8 md:grid-cols-3">
          <Feature
            icon={<Shield className="size-5" />}
            title="Integridade por SHA-256"
            description="Arquivos do modpack sao conferidos antes do Minecraft iniciar."
          />
          <Feature
            icon={<Settings className="size-5" />}
            title="Configuracoes locais"
            description="Resolucao, RAM, Java, logs, cache e pasta da instancia ficam no seu PC."
          />
          <Feature
            icon={<Server className="size-5" />}
            title="Servidor pronto"
            description="A inicializacao pode conectar direto em left-fcc.gl.joinmc.link."
          />
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <h2 className="font-serif text-2xl tracking-wide">Modpack Incluso</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Obrigatorios ficam travados; opcionais podem ser ligados nas configuracoes.
            </p>
          </div>
          <a href={MODPACK_RELEASE_URL} className="text-sm text-primary hover:underline">
            Assets do modpack
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_MODS.map((mod) => (
            <div key={mod.path} className="rounded-xl border border-white/8 bg-card/50 p-4">
              <div className="flex items-start gap-3">
                <Package className="size-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{mod.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Obrigatorio</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {OPTIONAL_MODS.map((mod) => (
            <Badge
              key={mod.path}
              variant="outline"
              className="border-primary/30 text-primary bg-primary/5"
            >
              {mod.name}
            </Badge>
          ))}
        </div>
      </section>

      {MOCK_MANIFEST.changelog && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-2xl tracking-wide">Changelog</h2>
            <a href={MODPACK_RELEASE_URL} className="text-sm text-primary hover:underline">
              GitHub
            </a>
          </div>
          <div className="aetherion-glass rounded-2xl p-6">
            <p className="font-serif text-lg tracking-wide">
              v{MOCK_MANIFEST.version}{" "}
              <span className="text-muted-foreground text-sm font-sans">
                •{" "}
                {MOCK_MANIFEST.publishedAt &&
                  new Date(MOCK_MANIFEST.publishedAt).toLocaleDateString("pt-BR")}
              </span>
            </p>
            <pre className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {MOCK_MANIFEST.changelog}
            </pre>
          </div>
        </section>
      )}

      <footer className="border-t border-border/40">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 Aetherion Network • Nao afiliado a Mojang Studios
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a
              href={`https://github.com/${LAUNCHER_REPO.owner}/${LAUNCHER_REPO.repo}`}
              className="hover:text-foreground"
            >
              GitHub
            </a>
            <a href={MOCK_MANIFEST.endpoints?.discord} className="hover:text-foreground">
              Discord
            </a>
            <a href={MOCK_MANIFEST.endpoints?.youtube} className="hover:text-foreground">
              YouTube
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DownloadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium inline-flex items-start gap-2">
        <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
        {value}
      </span>
    </div>
  )
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div>
      <div className="size-10 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary mb-3">
        {icon}
      </div>
      <p className="font-serif text-lg mb-1">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}
