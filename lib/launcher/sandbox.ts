export type SandboxType = "vanilla" | "paper" | "fabric" | "purpur"

export interface SandboxServer {
  id: string
  name: string
  serverType: SandboxType
  version: string
  ramGb: number
  cpuCores: number
  address: string
  running?: boolean | null
}

export interface SandboxCreateInput {
  name: string
  version: string
  ramGb: 16 | 24
  serverType?: SandboxType
  startAfterCreate?: boolean
}

export const SANDBOX_RAM_GB = [16, 24] as const
export const SANDBOX_DEFAULT_RAM_GB = 16
export const SANDBOX_DEFAULT_TYPE: SandboxType = "paper"

export function sanitizeSandboxName(value: string): string | null {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (cleaned.length < 2 || cleaned.length > 24) return null
  return cleaned
}
