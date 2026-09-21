/**
 * Aetherion Launcher — Downloader (Fase 3)
 *
 * Baixador concorrente com:
 *   - limite de paralelismo (3-5)
 *   - retry exponencial em falhas de rede
 *   - progresso em tempo real (ReadableStream)
 *   - verificação SHA-256 imediatamente após download
 *   - abort via AbortSignal
 *
 * Funciona em browser (preview) e no main do Electron. No main, a escrita
 * em disco é feita via uma callback `writeChunks` injetada — essa lib não
 * toca no filesystem diretamente (continua bundle-safe no Next.js).
 */

import { sha256Bytes, verifyHash } from "./hash"
import type { LaunchProgress, UpdateAction, UpdatePlan } from "./types"

/* -------------------------------------------------------------------------- */
/*  Opções                                                                     */
/* -------------------------------------------------------------------------- */

export interface DownloaderOptions {
  /** Downloads paralelos máximos (default: 4) */
  concurrency?: number
  /** Tentativas por arquivo (default: 3) */
  maxRetries?: number
  /** Delay base entre retries em ms (default: 800) */
  retryBaseDelay?: number
  /** Emitido a cada update de progresso agregado */
  onProgress?: (progress: LaunchProgress) => void
  /** Escrita em disco — injetada pelo main process. Omitir no preview. */
  writeFile?: (path: string, bytes: Uint8Array) => Promise<void>
  /** Remoção de arquivo — injetada pelo main process. */
  removeFile?: (path: string) => Promise<void>
  signal?: AbortSignal
}

/* -------------------------------------------------------------------------- */
/*  API pública                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Executa o plano completo de atualização.
 * Retorna a lista de caminhos que falharam mesmo após retries.
 */
export async function executeUpdatePlan(
  plan: UpdatePlan,
  options: DownloaderOptions = {},
): Promise<{ failed: string[] }> {
  const downloads = plan.actions.filter(
    (a): a is Extract<UpdateAction, { kind: "download" }> => a.kind === "download",
  )
  const removals = plan.actions.filter(
    (a): a is Extract<UpdateAction, { kind: "remove" }> => a.kind === "remove",
  )

  const failed: string[] = []
  const totalBytes = plan.totalBytes
  let loadedBytes = 0
  let filesDone = 0

  const emit = (phase: LaunchProgress["phase"], message: string) =>
    options.onProgress?.({
      phase,
      message,
      totalBytes,
      loadedBytes,
      filesDone,
      filesTotal: downloads.length,
    })

  // --- 1) Downloads com limite de concorrência ---
  emit("downloading-files", "Downloading files...")

  await runWithConcurrency(
    downloads,
    options.concurrency ?? 4,
    async (action) => {
      try {
        const bytes = await downloadWithRetry(
          action.url,
          action.sha256,
          {
            maxRetries: options.maxRetries ?? 3,
            retryBaseDelay: options.retryBaseDelay ?? 800,
            signal: options.signal,
            onBytes: (delta) => {
              loadedBytes += delta
              options.onProgress?.({
                phase: "downloading-files",
                message: `Downloading ${displayName(action.path)}...`,
                totalBytes,
                loadedBytes,
                filesDone,
                filesTotal: downloads.length,
              })
            },
          },
        )

        if (options.writeFile) {
          await options.writeFile(action.path, bytes)
        }
        filesDone++
        emit("downloading-files", `${displayName(action.path)} complete`)
      } catch (err) {
        console.error("[v0] download failed", action.path, err)
        failed.push(action.path)
      }
    },
  )

  // --- 2) Remoções (rápidas, sequenciais) ---
  if (removals.length && options.removeFile) {
    emit("verifying", "Removing old files...")
    for (const r of removals) {
      try {
        await options.removeFile(r.path)
      } catch (err) {
        console.error("[v0] remove failed", r.path, err)
      }
    }
  }

  emit("verifying", "Verification complete")
  return { failed }
}

/* -------------------------------------------------------------------------- */
/*  Download de um único arquivo com streaming + verificação                   */
/* -------------------------------------------------------------------------- */

interface SingleDownloadOptions {
  maxRetries: number
  retryBaseDelay: number
  signal?: AbortSignal
  onBytes?: (delta: number) => void
}

export async function downloadWithRetry(
  url: string,
  expectedSha256: string,
  opts: SingleDownloadOptions,
): Promise<Uint8Array> {
  let lastError: unknown
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const bytes = await downloadStreaming(url, opts.signal, opts.onBytes)
      const actual = await sha256Bytes(bytes)
      if (!verifyHash(expectedSha256, actual)) {
        throw new HashMismatchError(url, expectedSha256, actual)
      }
      return bytes
    } catch (err) {
      lastError = err
      if (opts.signal?.aborted) throw err
      if (attempt === opts.maxRetries) break
      // backoff exponencial com jitter
      const delay = opts.retryBaseDelay * Math.pow(2, attempt - 1) + Math.random() * 200
      await sleep(delay)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to download ${url}`)
}

/**
 * Download com ReadableStream para relatar bytes em tempo real.
 * Quando o servidor retorna Content-Length, conseguimos % exata.
 */
async function downloadStreaming(
  url: string,
  signal?: AbortSignal,
  onBytes?: (delta: number) => void,
): Promise<Uint8Array> {
  const res = await fetch(url, { signal, redirect: "follow" })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} at ${url}`)
  }
  if (!res.body) {
    // Fallback: servidor sem streaming
    const buffer = await res.arrayBuffer()
    onBytes?.(buffer.byteLength)
    return new Uint8Array(buffer)
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
    onBytes?.(value.byteLength)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/* -------------------------------------------------------------------------- */
/*  Concurrency limiter — não precisa de p-limit                               */
/* -------------------------------------------------------------------------- */

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items]
  const running: Promise<void>[] = []

  const spawn = async (): Promise<void> => {
    const item = queue.shift()
    if (item === undefined) return
    await worker(item)
    return spawn()
  }

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    running.push(spawn())
  }
  await Promise.all(running)
}

/* -------------------------------------------------------------------------- */
/*  Erros e helpers                                                            */
/* -------------------------------------------------------------------------- */

export class HashMismatchError extends Error {
  constructor(url: string, expected: string, actual: string) {
    super(
      `SHA-256 does not match for ${url}\n` +
        `  expected: ${expected}\n` +
        `  received: ${actual}`,
    )
    this.name = "HashMismatchError"
  }
}

function displayName(path: string): string {
  return path.split("/").pop() ?? path
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
