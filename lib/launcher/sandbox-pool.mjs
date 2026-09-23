/** Spare capacity for every sandbox together. Production keeps the rest of the host. */
export const SPARE_POOL_GB = 24
export const SPARE_POOL_CORES = 6

export const SANDBOX_PRESETS = [
  { value: "tiny", label: "Tiny", blurb: "Quick test", ramGb: 1, cpuCores: 1 },
  { value: "easy", label: "Easy", blurb: "Small world", ramGb: 2, cpuCores: 1 },
  { value: "medium", label: "Medium", blurb: "A few friends", ramGb: 4, cpuCores: 2 },
  { value: "large", label: "Large", blurb: "Heaviest spare size", ramGb: 8, cpuCores: 2 },
]

export function resolveSparePool(options = {}) {
  const known = typeof options.usedRamGb === "number" || typeof options.poolGb === "number"
  const totalRamGb = Math.min(options.poolGb ?? SPARE_POOL_GB, SPARE_POOL_GB)
  const totalCores = Math.min(options.poolCores ?? SPARE_POOL_CORES, SPARE_POOL_CORES)
  const usedRamGb = Math.max(0, options.usedRamGb ?? 0)
  const usedCores = Math.max(0, options.usedCores ?? 0)
  const remainingRam = Math.max(0, totalRamGb - usedRamGb)
  const remainingCores = Math.max(0, totalCores - usedCores)
  return {
    known,
    totalRamGb,
    totalCores,
    usedRamGb,
    usedCores,
    remainingRamGb: Math.max(0, Math.min(options.remainingRamGb ?? remainingRam, remainingRam)),
    remainingCores: Math.max(0, Math.min(options.remainingCores ?? remainingCores, remainingCores)),
  }
}

export function tierFits(tier, pool, limits = {}) {
  if (limits.maxRamGb != null && tier.ramGb > limits.maxRamGb) return false
  if (limits.maxCores != null && tier.cpuCores > limits.maxCores) return false
  if (!pool.known) return true
  return tier.ramGb <= pool.remainingRamGb && tier.cpuCores <= pool.remainingCores
}
