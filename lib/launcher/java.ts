/**
 * Aetherion Launcher — Java Runtime
 *
 * Detecção + download automático via Adoptium (Eclipse Temurin).
 * Adoptium é 100% gratuito, open-source e distribuído via GitHub Releases
 * no próprio repositório deles (sem precisar de CDN pago).
 *
 * Minecraft 1.21.1 + Fabric uses Java 21.
 * A função `adoptiumUrl` monta URLs estáveis da Adoptium API.
 */

import type {
  JavaInstallation,
  JavaPlan,
  Manifest,
  PlatformKey,
} from "./types"

/* -------------------------------------------------------------------------- */
/*  Escolha da melhor instalação local                                         */
/* -------------------------------------------------------------------------- */

export function pickBestJava(
  installations: JavaInstallation[],
  manifest: Manifest,
): JavaInstallation | null {
  const { recommendedMajor, minMajor } = manifest.java

  const compatible = installations.filter((j) => j.major >= minMajor)
  if (compatible.length === 0) return null

  return compatible.sort((a, b) => {
    // 1) Match exato ganha
    const aExact = a.major === recommendedMajor ? 0 : 1
    const bExact = b.major === recommendedMajor ? 0 : 1
    if (aExact !== bExact) return aExact - bExact

    // 2) Mais próximo do recomendado
    const aDist = Math.abs(a.major - recommendedMajor)
    const bDist = Math.abs(b.major - recommendedMajor)
    if (aDist !== bDist) return aDist - bDist

    // 3) 64-bit sempre ganha do 32-bit
    if (a.arch !== b.arch) return a.arch === "x64" ? -1 : 1

    // 4) Vendor score (Temurin/Adoptium é o mais estável para Minecraft)
    return vendorScore(b.vendor) - vendorScore(a.vendor)
  })[0]
}

function vendorScore(vendor: string): number {
  const v = vendor.toLowerCase()
  if (v.includes("temurin") || v.includes("adoptium") || v.includes("eclipse")) return 3
  if (v.includes("corretto") || v.includes("zulu")) return 2
  if (v.includes("openjdk") || v.includes("oracle")) return 2
  return 1
}

/* -------------------------------------------------------------------------- */
/*  Adoptium API (URLs públicas gratuitas)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Gera a URL do binário Adoptium mais recente (JRE).
 *
 * Exemplo resolvido automaticamente pela API:
 *   https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse
 *
 * A API responde com 302 para o asset real no GitHub Releases — então funciona
 * 100% gratuito, direto do repositório oficial da Eclipse Foundation.
 */
export function adoptiumUrl(major: number, platform: PlatformKey): string {
  const [os, archRaw] = platform.split("-")
  const arch = archRaw === "arm64" ? "aarch64" : archRaw // Adoptium usa "aarch64"
  const osName = os === "macos" ? "mac" : os
  return (
    `https://api.adoptium.net/v3/binary/latest/${major}/ga/` +
    `${osName}/${arch}/jre/hotspot/normal/eclipse`
  )
}

export function adoptiumArchiveType(platform: PlatformKey): "zip" | "tar.gz" {
  return platform.startsWith("windows") ? "zip" : "tar.gz"
}

/* -------------------------------------------------------------------------- */
/*  Plano de download                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Se o manifest especifica runtimes próprias, usa elas (mais confiável,
 * porque o hash está fixo). Senão, cai para a Adoptium API.
 */
export function planJavaDownload(
  manifest: Manifest,
  platform: PlatformKey,
): JavaPlan {
  const major = manifest.java.recommendedMajor
  const runtime = manifest.java.runtimes?.[platform]

  if (runtime) {
    return {
      action: "download",
      url: runtime.url,
      sha256: runtime.sha256,
      size: runtime.size,
      archiveType: runtime.archiveType,
      target: `runtime/java-${major}-${platform}`,
    }
  }

  // Fallback Adoptium — sem hash conhecido a priori.
  // O main process valida baixando o `.sha256.txt` adjacente da mesma API.
  return {
    action: "download",
    url: adoptiumUrl(major, platform),
    sha256: "", // a ser resolvido pelo main (fetch do .sha256.txt do Adoptium)
    size: 0,
    archiveType: adoptiumArchiveType(platform),
    target: `runtime/java-${major}-${platform}`,
  }
}

/**
 * Decisão de alto nível.
 */
export function resolveJava(
  installations: JavaInstallation[],
  manifest: Manifest,
  platform: PlatformKey,
): JavaPlan {
  const best = pickBestJava(installations, manifest)
  if (best) return { action: "use-local", installation: best }
  return planJavaDownload(manifest, platform)
}
