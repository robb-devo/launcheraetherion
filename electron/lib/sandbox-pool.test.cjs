const test = require("node:test")
const assert = require("node:assert/strict")

test("small sandbox tiers stay inside the spare pool", async () => {
  const { SANDBOX_PRESETS, SPARE_POOL_GB, SPARE_POOL_CORES, resolveSparePool, tierFits } = await import(
    "../../lib/launcher/sandbox-pool.mjs"
  )
  assert.deepEqual(
    SANDBOX_PRESETS.map((tier) => [tier.ramGb, tier.cpuCores]),
    [
      [1, 1],
      [2, 1],
      [4, 2],
      [8, 2],
    ],
  )
  assert.ok(SANDBOX_PRESETS.every((tier) => tier.ramGb <= 8 && tier.cpuCores <= 2))
  assert.equal(SPARE_POOL_GB, 24)
  assert.equal(SPARE_POOL_CORES, 6)

  const live = resolveSparePool({
    poolGb: 64,
    poolCores: 8,
    maxRamGb: 24,
    maxCores: 4,
    usedRamGb: 2,
    remainingRamGb: 62,
    usedCores: 1,
    remainingCores: 7,
  })
  assert.equal(live.totalRamGb, 24)
  assert.equal(live.totalCores, 6)
  assert.equal(live.usedRamGb, 2)
  assert.equal(live.remainingRamGb, 22)
  assert.equal(live.remainingCores, 5)
  assert.ok(SANDBOX_PRESETS.every((tier) => tierFits(tier, live, { maxRamGb: 24, maxCores: 4 })))

  const tightRam = resolveSparePool({ poolGb: 64, poolCores: 8, usedRamGb: 22, usedCores: 1, remainingRamGb: 42, remainingCores: 7 })
  assert.equal(tightRam.remainingRamGb, 2)
  assert.equal(tierFits(SANDBOX_PRESETS[1], tightRam), true)
  assert.equal(tierFits(SANDBOX_PRESETS[2], tightRam), false)
  assert.equal(tierFits(SANDBOX_PRESETS[3], tightRam), false)

  const tightCores = resolveSparePool({ poolGb: 24, poolCores: 6, usedRamGb: 2, usedCores: 5, remainingRamGb: 22, remainingCores: 1 })
  assert.equal(tightCores.remainingCores, 1)
  assert.equal(tierFits(SANDBOX_PRESETS[1], tightCores), true)
  assert.equal(tierFits(SANDBOX_PRESETS[2], tightCores), false)

  const smallerHost = resolveSparePool({ poolGb: 16, poolCores: 4, usedRamGb: 0, usedCores: 0 })
  assert.equal(smallerHost.totalRamGb, 16)
  assert.equal(smallerHost.totalCores, 4)

  const unknown = resolveSparePool({})
  assert.equal(unknown.known, false)
  assert.equal(tierFits(SANDBOX_PRESETS[3], unknown), true)
  assert.equal(tierFits(SANDBOX_PRESETS[3], unknown, { maxRamGb: 4 }), false)
})
