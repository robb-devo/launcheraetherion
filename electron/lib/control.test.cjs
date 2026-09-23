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

test("create defaults to 16 GB paper and never forwards codes or hosts", () => {
  const body = control.normalizeCreate({
    name: "My World",
    version: "1.19.2",
    accessCode: "secret",
    apiUrl: "http://evil.example",
    ramGb: 2,
    serverType: "live",
  })
  assert.deepEqual(body, {
    name: "my-world",
    serverType: "paper",
    version: "1.19.2",
    ramGb: 16,
    cpuCores: 4,
    preset: "balanced",
    onlineMode: true,
    startAfterCreate: true,
  })
  assert.equal("accessCode" in body, false)
  assert.equal("apiUrl" in body, false)
})

test("24 GB is the only step above the default", () => {
  const body = control.normalizeCreate({ name: "large", version: "1.19.2", ramGb: 24 })
  assert.equal(body.ramGb, 24)
  assert.equal(body.preset, "large")
  assert.equal(body.cpuCores, 4)
})

test("list keeps sandbox-* rows and drops the live realm", () => {
  const servers = control.isolatedServers({
    servers: [
      { name: "sandbox-isle", address: "135.181.18.162:25610" },
      { name: "aetherion", address: "135.181.18.162:25611" },
      { name: "sandbox-live", address: "play.donnernet.de:25612" },
      { name: "sandbox-port", address: "135.181.18.162:25565" },
      { name: "sandbox-new", address: "" },
    ],
  })
  assert.deepEqual(
    servers.map((server) => server.name),
    ["sandbox-isle", "sandbox-new"],
  )
})

test("list and create send the friend key and the player uuid", async () => {
  const calls = []
  const original = global.fetch
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    const path = String(url)
    if (path.endsWith("/sandbox/servers") && init.method === "POST") {
      return new Response(
        JSON.stringify({
          id: "s1",
          name: "sandbox-my-world",
          address: "135.181.18.162:25620",
          ramGb: 16,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(
      JSON.stringify({
        servers: [{ id: "s1", name: "sandbox-my-world", address: "135.181.18.162:25620" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }
  try {
    const player = "AABBCCDD-EEFF-0011-2233-445566778899"
    const listed = await control.sandboxList(player)
    const created = await control.sandboxCreate(player, { name: "My World", version: "1.19.2" })
    assert.equal(listed.servers.length, 1)
    assert.equal(created.name, "sandbox-my-world")
    for (const call of calls) {
      assert.equal(call.init.headers.Authorization, "Bearer aetherion-launcher-friend-v1")
      assert.equal(call.init.headers["X-Aetherion-Player"], "aabbccddeeff00112233445566778899")
      assert.equal(call.init.headers.accessCode, undefined)
    }
    const createdBody = JSON.parse(calls[1].init.body)
    assert.equal(createdBody.ramGb, 16)
    assert.equal(createdBody.preset, "balanced")
    assert.equal(createdBody.accessCode, undefined)
  } finally {
    global.fetch = original
  }
})
