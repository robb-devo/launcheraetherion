const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readTotalSeconds, formatPlaytime, presentPlaytime } = require("./playtime.cjs")

test("totalSeconds is read only when it is a real non-negative number", () => {
  assert.equal(readTotalSeconds({ totalSeconds: 3661 }), 3661)
  assert.equal(readTotalSeconds({ totalSeconds: "90" }), 90)
  assert.equal(readTotalSeconds({ playtime: { totalSeconds: 10 } }), 10)
  assert.equal(readTotalSeconds({ player: { totalSeconds: 0 } }), 0)
  assert.equal(readTotalSeconds({}), null)
  assert.equal(readTotalSeconds(null), null)
  assert.equal(readTotalSeconds({ totalSeconds: -1 }), null)
  assert.equal(readTotalSeconds({ totalSeconds: "soon" }), null)
  assert.equal(readTotalSeconds({ hours: 4 }), null)
})

test("missing playtime is not formatted as zero", () => {
  assert.equal(formatPlaytime(null), null)
  assert.equal(presentPlaytime({}).available, false)
  assert.equal(presentPlaytime({}).label, null)
  assert.equal(presentPlaytime({}).totalSeconds, null)
})

test("a reported duration formats without inventing extra time", () => {
  assert.equal(formatPlaytime(0), "0s")
  assert.equal(formatPlaytime(45), "45s")
  assert.equal(formatPlaytime(90), "1m")
  assert.equal(formatPlaytime(3661), "1h 1m")
  assert.deepEqual(presentPlaytime({ totalSeconds: 3661 }), {
    totalSeconds: 3661,
    available: true,
    label: "1h 1m",
  })
})
