const { test } = require("node:test")
const assert = require("node:assert/strict")
const {
  FEED,
  feedUrl,
  compareVersions,
  isNewerVersion,
  parseLatestYml,
  validateLatestYml,
  classifyUpdaterError,
  reduceUpdate,
  installerName,
} = require("./update-feed.cjs")

test("the updater feed is the public GitHub latest.yml", () => {
  assert.equal(FEED.owner, "robb-devo")
  assert.equal(FEED.repo, "launcheraetherion")
  assert.equal(FEED.provider, "github")
  assert.equal(feedUrl(), "https://github.com/robb-devo/launcheraetherion/releases/latest/download/latest.yml")
  assert.equal(installerName("0.3.9"), "Aetherion.Launcher.Setup.0.3.9.exe")
})

test("version compare treats a higher GitHub release as an update", () => {
  assert.equal(compareVersions("0.3.9", "0.3.8"), 1)
  assert.equal(compareVersions("0.3.4", "0.3.9"), -1)
  assert.equal(compareVersions("v0.3.9", "0.3.9"), 0)
  assert.equal(isNewerVersion("0.3.9", "0.3.8"), true)
  assert.equal(isNewerVersion("0.3.4", "0.3.8"), false)
})

test("latest.yml must name the NSIS installer for that version", () => {
  const text = [
    "version: 0.3.9",
    "files:",
    "  - url: Aetherion.Launcher.Setup.0.3.9.exe",
    "    sha512: abcdef==",
    "    size: 10",
    "path: Aetherion.Launcher.Setup.0.3.9.exe",
    "sha512: abcdef==",
    "",
  ].join("\n")
  const parsed = parseLatestYml(text)
  assert.equal(parsed.version, "0.3.9")
  assert.equal(parsed.path, installerName("0.3.9"))
  assert.equal(validateLatestYml(text, "0.3.9").ok, true)
  const mismatch = validateLatestYml(text, "0.3.8")
  assert.equal(mismatch.ok, false)
  assert.match(mismatch.errors.join(" "), /0\.3\.9/)
})

test("a missing latest.yml is an error, not a silent up-to-date", () => {
  const message = classifyUpdaterError("HttpError: 404 latest.yml")
  assert.match(message, /latest\.yml/)
  const state = reduceUpdate(
    { status: "checking", version: null, percent: 0, message: "Checking GitHub Releases..." },
    { type: "error", detail: "404 No latest.yml" },
  )
  assert.equal(state.status, "error")
  assert.match(state.message, /latest\.yml/)
})

test("update events move through check, download, and ready", () => {
  let state = { status: "idle", version: null, percent: 0, message: "" }
  state = reduceUpdate(state, { type: "checking" })
  assert.equal(state.status, "checking")
  state = reduceUpdate(state, { type: "available", version: "0.3.9" })
  assert.equal(state.status, "available")
  assert.equal(state.version, "0.3.9")
  state = reduceUpdate(state, { type: "progress", percent: 41.2 })
  assert.equal(state.status, "downloading")
  assert.equal(state.percent, 41)
  state = reduceUpdate(state, { type: "ready", version: "0.3.9" })
  assert.equal(state.status, "ready")
  assert.equal(state.percent, 100)
  state = reduceUpdate(state, { type: "none" })
  assert.equal(state.status, "none")
  assert.match(state.message, /up to date/)
})
