export type SandboxType = "vanilla" | "paper" | "fabric" | "purpur"
export type SandboxPreset = "light" | "balanced" | "performance" | "max" | "custom"

export interface SandboxPresetOption {
  value: string
  label: string
  blurb: string
  ramGb: number
  cpuCores: number
}

export interface SandboxTypeOption {
  value: SandboxType
  label: string
  blurb: string
}

export interface SandboxOptions {
  poolGb?: number
  poolCores?: number
  /** Per-server ceiling from SANDBOX_MAX_GB. Not the shared pool. */
  maxRamGb?: number
  maxCores?: number
  usedRamGb?: number
  remainingRamGb?: number
  usedCores?: number
  remainingCores?: number
  publicIp?: string
  presets: SandboxPresetOption[]
  serverTypes: SandboxTypeOption[]
  versions: Partial<Record<SandboxType, string[]>>
  defaults?: {
    onlineMode?: boolean
    motd?: string
  }
}

export interface SandboxServer {
  id: string
  name: string
  serverType: SandboxType
  version: string
  ramGb: number
  cpuCores: number
  preset?: SandboxPreset
  maxPlayers?: number
  viewDistance?: number
  simulationDistance?: number
  difficulty?: string
  gamemode?: string
  motd?: string
  port?: number
  createdAt?: string
  address: string
  onlineMode?: boolean
  running?: boolean | null
}

export interface SandboxLiveStatus {
  state: "online" | "offline" | "unknown"
  players: { current: number; max: number } | null
  ping: number | null
  motd?: string | null
}

export interface SandboxCreateInput {
  name: string
  serverType: SandboxType
  version: string
  ramGb: number
  cpuCores: number
  preset: SandboxPreset
  onlineMode?: boolean
  startAfterCreate?: boolean
}

export {
  SPARE_POOL_GB,
  SPARE_POOL_CORES,
  SANDBOX_PRESETS,
  resolveSparePool,
  tierFits,
} from "./sandbox-pool.mjs"

export interface SparePool {
  known: boolean
  totalRamGb: number
  totalCores: number
  usedRamGb: number
  usedCores: number
  remainingRamGb: number
  remainingCores: number
}

export const SANDBOX_TYPES: SandboxTypeOption[] = [
  { value: "vanilla", label: "Vanilla", blurb: "Stock Minecraft" },
  { value: "paper", label: "Paper", blurb: "Fast and plugin-ready" },
  { value: "fabric", label: "Fabric", blurb: "Modded ecosystem" },
  { value: "purpur", label: "Purpur", blurb: "Paper fork" },
]
