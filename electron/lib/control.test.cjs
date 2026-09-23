const { test } = require("node:test")
const assert = require("node:assert/strict")
const control = require("./control.cjs")

test("player header is 32 hex with no dashes", () => {
  assert.equal(
    control.playerHeader("AABBCCDD-EEFF-0011-2233-445566778899"),
    "aabbccddeeff00112233445566778899",
  )
  assert.equal(control.playerHeader("aabbccddeeff00112233445566778899").includes("-"), false)
})

test("player header rejects an empty id", () => {
  assert.throws(() => control.playerHeader(""), /Microsoft/)
})

test("bearer defaults to the friend key and can be overridden by env", () => {
  const previousControl = process.env.AETHERION_CONTROL_KEY
  const previousLauncher = process.env.LAUNCHER_SERVICE_KEY
  delete process.env.AETHERION_CONTROL_KEY
  delete process.env.LAUNCHER_SERVICE_KEY
  assert.equal(control.serviceKey(), control.BAKED_SERVICE_KEY)
  process.env.LAUNCHER_SERVICE_KEY = "rotated-key"
  assert.equal(control.serviceKey(), "rotated-key")
  process.env.AETHERION_CONTROL_KEY = "machine-key"
  assert.equal(control.serviceKey(), "machine-key")
  if (previousControl == null) delete process.env.AETHERION_CONTROL_KEY
  else process.env.AETHERION_CONTROL_KEY = previousControl
  if (previousLauncher == null) delete process.env.LAUNCHER_SERVICE_KEY
  else process.env.LAUNCHER_SERVICE_KEY = previousLauncher
})

test("playtime stays hidden until a body includes totalSeconds", async () => {
  const result = await control.playerPlaytime("aabbccddeeff00112233445566778899")
  assert.deepEqual(result, { totalSeconds: null, available: false, label: null })
  assert.equal(control.sandboxPlugins().supported, false)
})

test("sandbox routes match the control contract", () => {
  assert.equal(control.apiBase(), control.DEFAULT_API_BASE)
  assert.equal(control.apiUrl("/sandbox/options"), `${control.DEFAULT_API_BASE}/api/sandbox/options`)
  assert.equal(control.apiUrl("/sandbox/servers"), `${control.DEFAULT_API_BASE}/api/sandbox/servers`)
  assert.equal(
    control.apiUrl("/sandbox/servers/abc/start"),
    `${control.DEFAULT_API_BASE}/api/sandbox/servers/abc/start`,
  )
  assert.equal(
    control.apiUrl("/sandbox/servers/abc/stop"),
    `${control.DEFAULT_API_BASE}/api/sandbox/servers/abc/stop`,
  )
  assert.equal(
    control.apiUrl(`/sandbox/servers/${encodeURIComponent("id/1")}`),
    `${control.DEFAULT_API_BASE}/api/sandbox/servers/id%2F1`,
  )
})

test("a 401 before the host restarts stays a human message", () => {
  assert.equal(control.failureMessage(401, { error: "Unauthorized" }), control.UNAVAILABLE)
  assert.equal(
    control.failureMessage(401, { error: "friend credentials refused" }),
    control.UNAVAILABLE,
  )
  assert.equal(
    control.failureMessage(401, { error: "Sign in with Microsoft before using sandboxes." }),
    "Sign in with Microsoft before using sandboxes.",
  )
  assert.equal(control.failureMessage(502, { error: "Crafty down" }), control.UNAVAILABLE)
  assert.match(control.failureMessage(400, { error: "Version is required." }), /Version is required/)
})
