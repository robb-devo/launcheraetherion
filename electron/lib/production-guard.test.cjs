const { test } = require("node:test")
const assert = require("node:assert/strict")
const { assertSandboxJoin, isProductionHost } = require("./production-guard.cjs")

test("the live realm host is recognized", () => {
  assert.equal(isProductionHost("play.donnernet.de"), true)
  assert.equal(isProductionHost("PLAY.DONNERNET.DE."), true)
  assert.equal(isProductionHost("135.181.18.162"), false)
})

test("a spare sandbox port is allowed", () => {
  assert.deepEqual(assertSandboxJoin("135.181.18.162", 25610), {
    host: "135.181.18.162",
    port: 25610,
  })
})

test("sandbox joins cannot use the live realm", () => {
  assert.throws(() => assertSandboxJoin("play.donnernet.de", 25610), /live Aetherion realm/)
  assert.throws(() => assertSandboxJoin("135.181.18.162", 25565), /live Aetherion realm/)
  assert.throws(() => assertSandboxJoin("135.181.18.162", undefined), /no address/)
})
