/**
 * Simulador do pipeline de launch — usado no preview.
 *
 * No Electron, o Dashboard chama `window.aetherion.launch({ ... })` e recebe
 * os mesmos eventos `LaunchProgress` via IPC. Aqui simulamos o fluxo com
 * timers para que o preview mostre a UX real (barra, fases, % , contagem).
 *
 * O importante: a FORMA dos eventos é idêntica à do main process real.
 */

import type { LaunchPhase, LaunchProgress, Manifest } from "./types"
import { computeUpdatePlan } from "./manifest"
import { MOCK_MANIFEST } from "./mock-data"

interface SimulateOptions {
  onProgress: (p: LaunchProgress) => void
  signal?: AbortSignal
  /** Se true, força uma falha em "downloading-files" para testar o erro UI */
  forceError?: boolean
}

export async function simulateLaunch(opts: SimulateOptions): Promise<void> {
  const { onProgress, signal } = opts
  const manifest = MOCK_MANIFEST

  const step = async (
    phase: LaunchPhase,
    message: string,
    duration = 600,
    extra: Partial<LaunchProgress> = {},
  ) => {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
    onProgress({ phase, message, ...extra })
    await sleep(duration, signal)
  }

  await step("fetching-manifest", "Fetching manifest.json...", 700)
  await step(
    "computing-plan",
    `Manifest v${manifest.version} — comparing with the local instance...`,
    500,
  )

  // Simula um plano: primeira vez instalando, tudo para baixar
  const plan = computeUpdatePlan({
    manifest,
    local: {
      instanceId: manifest.instanceId ?? "aetherion-main",
      installedManifestVersion: null,
      enabledOptionalMods: {},
      dropinMods: [],
    },
    installedHashes: {},
  })

  await step("checking-java", "Looking for Java 17 on this PC...", 500)
  await step("downloading-java", "Java 17 found (Temurin). Skipping download.", 400)

  if (plan.needsForgeInstall) {
    await step("installing-forge", `Installing Forge ${manifest.forge.version}...`, 900)
  }

  // Fase de downloads com progresso real baseado no plano
  const totalBytes = plan.totalBytes
  const filesTotal = plan.downloadCount
  let loadedBytes = 0
  let filesDone = 0

  const downloads = plan.actions.filter(
    (a): a is Extract<(typeof plan.actions)[number], { kind: "download" }> =>
      a.kind === "download" && a.category !== "forge",
  )

  for (const action of downloads) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")

    // Simula download em 3 "ticks" por arquivo
    const chunk = action.size / 3
    for (let i = 0; i < 3; i++) {
      await sleep(120 + Math.random() * 180, signal)
      loadedBytes += chunk
      onProgress({
        phase: "downloading-files",
        message: `Downloading ${displayName(action.path)}...`,
        totalBytes,
        loadedBytes: Math.min(loadedBytes, totalBytes),
        filesDone,
        filesTotal,
      })
    }
    filesDone++

    // Dispara um erro de exemplo em 20% do caminho quando pedido
    if (opts.forceError && filesDone === Math.ceil(filesTotal * 0.3)) {
      throw new Error(
        `HashMismatchError: SHA-256 does not match for ${action.path}\n` +
          `  expected: ${action.sha256.slice(0, 16)}...\n` +
          `  received: 000000000000...`,
      )
    }
  }

  await step(
    "verifying",
    `${filesTotal} files downloaded. Verifying integrity...`,
    700,
    { totalBytes, loadedBytes: totalBytes, filesDone: filesTotal, filesTotal },
  )
  await step("launching", "Starting the javaw process...", 600)
  onProgress({ phase: "running", message: "Minecraft is running" })
}

/* -------------------------------------------------------------------------- */

function displayName(path: string): string {
  return path.split("/").pop() ?? path
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"))
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id)
        reject(new DOMException("Cancelled", "AbortError"))
      },
      { once: true },
    )
  })
}

/** Exportado para quem quiser usar o manifest em outras telas */
export { MOCK_MANIFEST as PREVIEW_MANIFEST }
export type { Manifest }
