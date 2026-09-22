export type SandboxType = "vanilla" | "paper" | "fabric" | "purpur"
export type SandboxPreset = "light" | "balanced" | "performance" | "max" | "custom"

export interface SandboxPresetOption {
  value: Exclude<SandboxPreset, "custom">
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
  address: string
  onlineMode?: boolean
  running?: boolean | null
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
  { value: "light", label: "Light", blurb: "Quick tests", ramGb: 2, cpuCores: 1 },
  { value: "balanced", label: "Balanced", blurb: "Friends", ramGb: 4, cpuCores: 2 },
  { value: "performance", label: "Performance", blurb: "Heavier worlds", ramGb: 6, cpuCores: 3 },
  { value: "max", label: "Max", blurb: "Largest sandbox", ramGb: 8, cpuCores: 4 },
]

export const SANDBOX_TYPES: SandboxTypeOption[] = [
  { value: "vanilla", label: "Vanilla", blurb: "Stock Minecraft" },
  { value: "paper", label: "Paper", blurb: "Fast and plugin-ready" },
  { value: "fabric", label: "Fabric", blurb: "Modded ecosystem" },
  { value: "purpur", label: "Purpur", blurb: "Paper fork" },
]
