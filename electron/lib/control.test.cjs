const { test } = require("node:test")
const assert = require("node:assert/strict")
const { playerHeader, apiUrl, apiBase, DEFAULT_API_BASE } = require("./control.cjs")

test("player header accepts a dashed Microsoft UUID", () => {
  assert.equal(
    playerHeader("AABBCCDD-EEFF-0011-2233-445566778899"),
    "aabbccddeeff00112233445566778899",
  )
})

test("player header rejects an empty id", () => {
  assert.throws(() => playerHeader(""), /Microsoft/)
})

test("sandbox urls use the baked control host", () => {
  assert.equal(apiBase(), DEFAULT_API_BASE)
  assert.equal(apiUrl("/sandbox/servers"), `${DEFAULT_API_BASE}/api/sandbox/servers`)
})
