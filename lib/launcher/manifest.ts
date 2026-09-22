/**
 * Aetherion Launcher — Manifest & Updater
 *
 * Biblioteca pura: recebe o manifest remoto + estado local + hashes em disco
 * e produz um `UpdatePlan` com a lista de ações (download / skip / remove).
 *
 * Arquitetura GitHub Releases:
 *   - manifest.json é fetched via HTTPS público (GitHub Pages ou raw GitHub)
 *   - cada `file.url` aponta para um asset de release
 *   - comparação por SHA-256 garante idempotência (só baixa o que mudou)
 */

import type {
  LocalInstanceState,
  Manifest,
  ManifestFile,
  UpdateAction,
  UpdatePlan,
} from "./types"

/* -------------------------------------------------------------------------- */
/*  Fetch                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Busca o manifest remoto. Cache-bust via query string para garantir que
 * o GitHub Pages / CDN entregue a versão mais nova.
 */
export async function fetchManifest(
  url: string,
  signal?: AbortSignal,
): Promise<Manifest> {
  const cacheBust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`
  const res = await fetch(cacheBust, {
    signal,
    headers: { Accept: "application/json" },
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`Could not fetch the manifest (${res.status} ${res.statusText})`)
  }

  const json = (await res.json()) as Manifest
  validateManifest(json)
  return json
}

export function validateManifest(m: Manifest): void {
  if (!m.version) throw new Error("Invalid manifest: missing 'version'.")
  if (!m.minecraft) throw new Error("Invalid manifest: missing 'minecraft'.")
  if (!m.forge?.url || !m.forge?.sha256) {
    throw new Error("Invalid manifest: incomplete 'forge' block.")
  }
  if (!Array.isArray(m.files)) {
    throw new Error("Invalid manifest: 'files' must be an array.")
  }
  for (const f of m.files) {
    if (!f.path || !f.url || !f.sha256 || typeof f.size !== "number") {
      throw new Error(`Invalid manifest: file '${f.path}' is incomplete.`)
    }
  }
}

export function isLauncherCompatible(
  manifest: Manifest,
  launcherVersion: string,
): boolean {
  if (!manifest.requiredLauncherVersion) return true
  return semverGte(launcherVersion, manifest.requiredLauncherVersion)
}

/* -------------------------------------------------------------------------- */
/*  Update plan                                                                */
/* -------------------------------------------------------------------------- */

export interface ComputePlanInput {
  manifest: Manifest
  /** Estado local persistido em instance-state.json */
  local: LocalInstanceState
  /**
   * Mapa path → sha256 dos arquivos presentes no disco (mods/, config/...).
   * O main process escaneia e passa esse mapa.
   */
  installedHashes: Record<string, string>
}

export function computeUpdatePlan(input: ComputePlanInput): UpdatePlan {
  const { manifest, local, installedHashes } = input
  const actions: UpdateAction[] = []

  // ---- 1) Forge ---------------------------------------------------------
  const forge = manifest.forge
  const needsForgeInstall = Boolean(
    forge?.sha256 && local.installedForgeSha?.toLowerCase() !== forge.sha256.toLowerCase(),
  )

  if (forge?.sha256 && needsForgeInstall) {
    const forgePath = `forge/forge-${forge.version}-installer.jar`
    if (installedHashes[forgePath] === forge.sha256.toLowerCase()) {
      actions.push({ kind: "skip", path: forgePath, reason: "hash-match" })
    } else {
      actions.push({
        kind: "download",
        path: forgePath,
        url: forge.url,
        sha256: forge.sha256,
        size: forge.size ?? 0,
        category: "forge",
      })
    }
  }

  // ---- 2) Files ---------------------------------------------------------
  const validPaths = new Set<string>()

  for (const file of manifest.files) {
    validPaths.add(file.path)

    // Mods opcionais respeitam a preferência do usuário
    if (file.type === "optional") {
      const enabled = resolveOptionalEnabled(file, local)
      if (!enabled) {
        if (installedHashes[file.path]) {
          actions.push({
            kind: "remove",
            path: file.path,
            reason: "optional-disabled",
          })
        }
        continue
      }
    }

    actions.push(resolveFileAction(file, installedHashes))
  }

  // ---- 3) Órfãos (arquivos que saíram do manifest) ----------------------
  const protectedPatterns = manifest.protectedPatterns ?? []
  const dropinSet = new Set(local.dropinMods.map((m) => `mods/${m.filename}`))

  for (const path of Object.keys(installedHashes)) {
    if (validPaths.has(path)) continue
    if (path.startsWith("forge/")) continue // protege installer já usado
    if (dropinSet.has(path)) continue
    if (isProtected(path, protectedPatterns)) continue

    actions.push({ kind: "remove", path, reason: "orphan" })
  }

  // ---- 4) Agregados -----------------------------------------------------
  const downloadActions = actions.filter(
    (a): a is Extract<UpdateAction, { kind: "download" }> => a.kind === "download",
  )
  const totalBytes = downloadActions.reduce((sum, a) => sum + a.size, 0)

  return {
    manifestVersion: manifest.version,
    fromVersion: local.installedManifestVersion,
    actions,
    totalBytes,
    downloadCount: downloadActions.length,
    removeCount: actions.filter((a) => a.kind === "remove").length,
    needsForgeInstall,
  }
}

function resolveOptionalEnabled(
  file: ManifestFile,
  local: LocalInstanceState,
): boolean {
  const userPref = local.enabledOptionalMods[file.path]
  if (userPref !== undefined) return userPref
  return file.defaultEnabled ?? false
}

function resolveFileAction(
  file: ManifestFile,
  installed: Record<string, string>,
): UpdateAction {
  const current = installed[file.path]
  if (current && current.toLowerCase() === file.sha256.toLowerCase()) {
    return { kind: "skip", path: file.path, reason: "hash-match" }
  }
  return {
    kind: "download",
    path: file.path,
    url: file.url,
    sha256: file.sha256,
    size: file.size,
    category: file.type,
  }
}

function isProtected(path: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(path))
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`, "i")
}

/* -------------------------------------------------------------------------- */
/*  Semver simples                                                             */
/* -------------------------------------------------------------------------- */

/** Compara "0.3" >= "0.2" etc. Aceita "v" prefixado e qualquer nº de partes. */
export function semverGte(a: string, b: string): boolean {
  const parse = (v: string) =>
    v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0
    const bv = pb[i] ?? 0
    if (av !== bv) return av > bv
  }
  return true
}

/** Retorna true se a versão local está atrás da remota. */
export function needsUpdate(local: LocalInstanceState, remote: Manifest): boolean {
  if (!local.installedManifestVersion) return true
  return !semverGte(local.installedManifestVersion, remote.version)
}
