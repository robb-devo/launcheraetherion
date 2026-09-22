/**
 * Aetherion Launcher — Type System
 *
 * Fonte única da verdade. Usado tanto pela UI (Next.js) quanto pelo main
 * process do Electron (Fase 5). Zero dependências de runtime aqui.
 *
 * Arquitetura de distribuição: GitHub Releases + GitHub Pages (gratuito).
 *   - manifest.json é publicado em GitHub Pages (ou como asset do release)
 *   - arquivos pesados (mods, forge, runtimes) ficam em GitHub Releases assets
 *   - versionamento do manifest é semver simples (0.3, 0.4...)
 */

// ==========================================================================
// CONTAS
// ==========================================================================

export type AccountType = "offline" | "microsoft"

export interface BaseAccount {
  id: string
  type: AccountType
  username: string
  uuid: string
  avatarUrl?: string
  addedAt?: string
  lastUsedAt?: string
}

export interface OfflineAccount extends BaseAccount {
  type: "offline"
}

export interface MicrosoftAccount extends BaseAccount {
  type: "microsoft"
  /**
   * ATENÇÃO: tokens NUNCA ficam em texto puro em disco.
   * No Electron guardamos via `safeStorage` (criptografia nativa do OS) ou
   * `keytar` (keychain). Aqui é só uma referência opcional em memória.
   */
  accessTokenRef?: string
  refreshTokenRef?: string
  expiresAt?: string
}

export type Account = OfflineAccount | MicrosoftAccount

export interface AccountsState {
  activeId: string | null
  accounts: Account[]
}

export interface MicrosoftTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

// ==========================================================================
// MANIFEST REMOTO — NOVO FORMATO ACHATADO (GitHub Releases)
// ==========================================================================

/**
 * Formato plano, compatível com a spec pedida pelo usuário.
 *
 * Exemplo mínimo:
 * {
 *   "version": "0.3",
 *   "minecraft": "1.19.2",
 *   "forge": { "version": "43.3.13", "url": "...", "sha256": "..." },
 *   "files": [
 *     { "path": "mods/create.jar", "url": "...", "sha256": "...", "size": 1234, "type": "required" }
 *   ]
 * }
 */
export interface Manifest {
  /** Versão do modpack. Usamos como "v{version}" nas URLs de release. */
  version: string
  /** Versão do Minecraft (ex: "1.19.2") */
  minecraft: string
  /** Nome legível exibido no launcher */
  name?: string
  /** ID estável da instância (ex: "aetherion-main") */
  instanceId?: string
  /** Changelog em Markdown curto */
  changelog?: string
  /** ISO timestamp de publicação */
  publishedAt?: string

  /** Forge installer — baixado para /forge/ e executado no primeiro run */
  forge?: ForgeEntry

  /** Todos os arquivos do modpack (mods, configs, resourcepacks) */
  files: ManifestFile[]

  /** Configuração de Java */
  java: JavaRequirement

  /** Versão mínima do launcher que entende este manifest */
  requiredLauncherVersion?: string

  /** Endpoints opcionais usados pelo dashboard */
  endpoints?: ManifestEndpoints

  /** Padrões de nomes que o launcher NUNCA deleta (para drop-in mods) */
  protectedPatterns?: string[]
}

export interface ForgeEntry {
  version: string // "43.3.13"
  url: string // GitHub Release asset URL
  sha256: string
  size?: number
  /** Nome da versão instalada pelo Forge (ex: "1.19.2-forge-43.3.13") */
  installedProfile?: string
}

export interface ManifestFile {
  /** Caminho relativo à raiz da instância (ex: "mods/create.jar" ou "config/create-common.toml") */
  path: string
  url: string
  sha256: string
  size: number
  type: "required" | "optional" | "config" | "resourcepack" | "shaderpack"

  /* ---------- Metadados opcionais para UI (não afetam o updater) ---------- */
  id?: string
  name?: string
  version?: string
  author?: string
  description?: string
  tag?: string
  /** Para type "optional": se vem ligado por padrão */
  defaultEnabled?: boolean
}

export interface JavaRequirement {
  recommendedMajor: number // 17 para 1.19.2
  minMajor: number
  /** Runtimes prontas para download — se ausente, cai no Adoptium API */
  runtimes?: Partial<Record<PlatformKey, RuntimeAsset>>
}

export interface ManifestEndpoints {
  serverHost?: string // "play.aetherion.gg"
  serverPort?: number
  news?: string
  site?: string
  discord?: string
  youtube?: string
}

export type PlatformKey = "windows-x64" | "linux-x64" | "macos-arm64" | "macos-x64"

export interface RuntimeAsset {
  url: string
  sha256: string
  size: number
  /** Tipo de arquivo: "zip" (Windows) ou "tar.gz" (Linux/macOS) */
  archiveType: "zip" | "tar.gz"
}

// ==========================================================================
// ESTADO LOCAL (instance-state.json na máquina do usuário)
// ==========================================================================

export interface LocalInstanceState {
  instanceId: string
  installedManifestVersion: string | null
  /**
   * Estado dos mods opcionais. Chave = file.path (ex: "mods/journeymap.jar").
   * Ausência = usar o `defaultEnabled` do manifest.
   */
  enabledOptionalMods: Record<string, boolean>
  /** Drop-in mods (adicionados manualmente pelo usuário à pasta mods/) */
  dropinMods: DropinMod[]
  /** Último check de atualização (ISO) */
  lastCheckedAt?: string
  /** SHA-256 do forge installer já executado — evita reinstalar */
  installedForgeSha?: string
}

export interface DropinMod {
  filename: string
  size: number
  enabled: boolean
  addedAt: string
}

// ==========================================================================
// CONFIGURAÇÕES DO USUÁRIO
// ==========================================================================

export interface LauncherSettings {
  minecraft: MinecraftSettings
  java: JavaSettings
  launcher: LauncherPreferences
}

export interface MinecraftSettings {
  resolution: { width: number; height: number }
  fullscreen: boolean
  autoConnectServer: boolean
  detachProcess: boolean
  closeOnLaunch: boolean
  gameDirectory?: string
}

export interface JavaSettings {
  minRamMb: number
  maxRamMb: number
  executablePath?: string
  jvmArgs: string
  autoDownloadRuntime: boolean
}

export interface LauncherPreferences {
  updateChannel: "stable" | "beta"
  manifestUrl?: string
  dataDirectory?: string
  minimizeToTray: boolean
  telemetry: boolean
}

// ==========================================================================
// DASHBOARD STATUS
// ==========================================================================

export interface ServerStatus {
  online: boolean
  players: { current: number; max: number }
  motd?: string
  ping?: number
}

export interface MojangStatus {
  auth: "green" | "yellow" | "red"
  session: "green" | "yellow" | "red"
}

// ==========================================================================
// UPDATER — PLANO DE ATUALIZAÇÃO
// ==========================================================================

export type UpdateAction =
  | {
      kind: "download"
      path: string
      url: string
      sha256: string
      size: number
      category: ManifestFile["type"] | "forge"
    }
  | {
      kind: "skip"
      path: string
      reason: "hash-match"
    }
  | {
      kind: "remove"
      path: string
      reason: "optional-disabled" | "orphan"
    }

export interface UpdatePlan {
  manifestVersion: string
  /** Versão previamente instalada (null na primeira execução) */
  fromVersion: string | null
  actions: UpdateAction[]
  totalBytes: number
  downloadCount: number
  removeCount: number
  /** true se precisamos rodar o Forge installer */
  needsForgeInstall: boolean
}

// ==========================================================================
// JAVA RUNTIME
// ==========================================================================

export interface JavaInstallation {
  path: string
  major: number
  version: string
  vendor: string
  arch: "x64" | "x86" | "arm64"
  source: "path" | "java-home" | "registry" | "bundled" | "user"
}

export type JavaPlan =
  | { action: "use-local"; installation: JavaInstallation }
  | {
      action: "download"
      url: string
      sha256: string
      size: number
      archiveType: "zip" | "tar.gz"
      target: string
    }
  | { action: "error"; message: string }

// ==========================================================================
// DOWNLOAD PROGRESS (eventos emitidos pelo downloader)
// ==========================================================================

export type LaunchPhase =
  | "idle"
  | "fetching-manifest"
  | "computing-plan"
  | "checking-java"
  | "downloading-java"
  | "installing-forge"
  | "downloading-files"
  | "verifying"
  | "launching"
  | "running"
  | "error"

export interface LaunchProgress {
  phase: LaunchPhase
  /** Mensagem humana (ex: "Baixando Create 0.5.1f...") */
  message: string
  /** Total de bytes a baixar (nesta fase) */
  totalBytes?: number
  /** Bytes já baixados (nesta fase) */
  loadedBytes?: number
  /** Quantidade de arquivos já concluídos */
  filesDone?: number
  /** Total de arquivos na fase */
  filesTotal?: number
  /** Erro, se phase === "error" */
  error?: string
}
