/**
 * Preview-only progress sequence. The desktop launcher does not use this.
 * Electron calls the real Fabric install path in electron/main.cjs.
 */

import type { LaunchPhase, LaunchProgress } from "./types"
import { CLIENT_PACK, PACK_SHADERS, REQUIRED_MODS } from "./mock-data"

interface SimulateOptions {
  onProgress: (p: LaunchProgress) => void
  signal?: AbortSignal
  forceError?: boolean
}

export async function simulateLaunch(opts: SimulateOptions): Promise<void> {
  const { onProgress, signal } = opts

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

  await step("fetching-manifest", "Fetching the Aetherion pack...", 700)
  await step(
    "computing-plan",
    `Manifest v${CLIENT_PACK.version} — Minecraft ${CLIENT_PACK.minecraft} Fabric...`,
    500,
  )
  await step("checking-java", "Looking for Java 21 on this PC...", 500)
  await step("installing-forge", `Installing Fabric ${CLIENT_PACK.loader.version}...`, 700)

  const downloads = [
    ...REQUIRED_MODS.map((mod) => mod.path),
    ...PACK_SHADERS.map((shader) => `shaderpacks/${shader.filename}`),
  ]
  const filesTotal = downloads.length
  let filesDone = 0

  for (const filePath of downloads) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
    await sleep(40, signal)
    filesDone++
    onProgress({
      phase: "downloading-files",
      message: `Downloading ${filePath.split("/").pop()}...`,
      filesDone,
      filesTotal,
    })
    if (opts.forceError && filesDone === Math.ceil(filesTotal * 0.3)) {
      throw new Error(`Could not download ${filePath}`)
    }
  }

  await step("verifying", `${filesTotal} files ready.`, 400, { filesDone: filesTotal, filesTotal })
  await step("launching", "Starting Minecraft...", 400)
  onProgress({ phase: "running", message: "Minecraft is running" })
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
