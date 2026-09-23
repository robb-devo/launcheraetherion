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

export const SANDBOX_PRESETS: SandboxPresetOption[] = [
  { value: "16", label: "16 GB", blurb: "Default", ramGb: 16, cpuCores: 4 },
  { value: "24", label: "24 GB", blurb: "Larger worlds", ramGb: 24, cpuCores: 4 },
]

export const SANDBOX_TYPES: SandboxTypeOption[] = [
  { value: "vanilla", label: "Vanilla", blurb: "Stock Minecraft" },
  { value: "paper", label: "Paper", blurb: "Fast and plugin-ready" },
  { value: "fabric", label: "Fabric", blurb: "Modded ecosystem" },
  { value: "purpur", label: "Purpur", blurb: "Paper fork" },
]
