/**
 * The live realm is play.donnernet.de:25565.
 * Sandbox joins are spare-capacity servers and must not use that endpoint.
 */

const PRODUCTION_HOST = "play.donnernet.de"
const PRODUCTION_PORT = 25565

function isProductionHost(host) {
  const name = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
  return name === PRODUCTION_HOST || name.endsWith(`.${PRODUCTION_HOST}`)
}

function assertSandboxJoin(host, port) {
  const name = String(host || "").trim()
  const parsed = Number(port)
  if (!name || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("This sandbox has no address yet.")
  }
  if (isProductionHost(name) || parsed === PRODUCTION_PORT) {
    throw new Error("Sandboxes stay off the live Aetherion realm.")
  }
  return { host: name, port: parsed }
}

module.exports = {
  PRODUCTION_HOST,
  PRODUCTION_PORT,
  isProductionHost,
  assertSandboxJoin,
}
