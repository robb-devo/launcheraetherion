const { test } = require("node:test")
const assert = require("node:assert/strict")
const { playersFromStatus, decodeStatusResponse, encodeStatusResponse } = require("./realm-status.cjs")

test("a status response keeps the reported player count", () => {
  const packet = encodeStatusResponse({
    version: { name: "Paper 1.21.1", protocol: 767 },
    players: { online: 12, max: 80, sample: [{ name: "Ada", id: "0" }] },
    description: { text: "AETHERION" },
  })
  const decoded = decodeStatusResponse(packet)
  assert.equal(decoded.complete, true)
  assert.equal(decoded.state, "online")
  assert.deepEqual(decoded.players, { current: 12, max: 80 })
  assert.equal(decoded.motd, "AETHERION")
})

test("a split packet is not treated as zero players", () => {
  const packet = encodeStatusResponse({
    players: { online: 4, max: 20 },
    description: { text: "AETHERION" },
  })
  const partial = decodeStatusResponse(packet.subarray(0, 3))
  assert.equal(partial.complete, false)
  assert.equal(partial.players, undefined)
  const full = decodeStatusResponse(packet)
  assert.deepEqual(full.players, { current: 4, max: 20 })
})

test("missing player fields stay unknown instead of a fake zero", () => {
  assert.equal(playersFromStatus({}), null)
  assert.equal(playersFromStatus({ players: { max: 20 } }), null)
  assert.equal(playersFromStatus({ players: { online: "no", max: 20 } }), null)
  const decoded = decodeStatusResponse(encodeStatusResponse({ description: "offline banner" }))
  assert.equal(decoded.state, "online")
  assert.equal(decoded.players, null)
})

test("a zero count is kept when the server really reports nobody", () => {
  assert.deepEqual(playersFromStatus({ players: { online: 0, max: 500, sample: [] } }), {
    current: 0,
    max: 500,
  })
})

test("a hidden online count falls back to the player sample", () => {
  assert.deepEqual(
    playersFromStatus({
      players: {
        online: 0,
        max: 500,
        sample: [{ name: "Ada" }, { name: "Bea" }],
      },
    }),
    { current: 2, max: 500 },
  )
})
