const net = require("node:net")

const STATUS_PROTOCOL = -1

function writeVarInt(value) {
  const bytes = []
  let current = value >>> 0
  if (value < 0) {
    let remaining = value
    for (let i = 0; i < 5; i++) {
      let part = remaining & 0x7f
      remaining >>= 7
      if (i < 4) part |= 0x80
      bytes.push(part & 0xff)
    }
    return Buffer.from(bytes)
  }
  while (true) {
    if ((current & ~0x7f) === 0) {
      bytes.push(current)
      break
    }
    bytes.push((current & 0x7f) | 0x80)
    current >>>= 7
  }
  return Buffer.from(bytes)
}

function writeString(value) {
  const body = Buffer.from(value, "utf8")
  return Buffer.concat([writeVarInt(body.length), body])
}

function framePacket(id, payload) {
  const body = Buffer.concat([writeVarInt(id), payload])
  return Buffer.concat([writeVarInt(body.length), body])
}

function readVarInt(buffer, cursor) {
  let num = 0
  let shift = 0
  for (let i = 0; i < 5; i++) {
    if (cursor.offset >= buffer.length) return null
    const byte = buffer[cursor.offset++]
    num |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return num
    shift += 7
  }
  throw new Error("VarInt is too long.")
}

function stripMotd(value) {
  return stripMotdParts(value).replace(/§./g, "").replace(/[ \t]+\n/g, "\n").trim()
}

function stripMotdParts(value) {
  if (typeof value === "string") return value.replace(/§./g, "")
  if (!value || typeof value !== "object") return ""
  const text = typeof value.text === "string" ? value.text.replace(/§./g, "") : ""
  const extra = Array.isArray(value.extra) ? value.extra.map((part) => stripMotdParts(part)).join("") : ""
  return `${text}${extra}`
}

function playersFromStatus(json) {
  const players = json?.players
  if (!players || typeof players !== "object") return null
  const max = Number(players.max)
  const reported = Number(players.online)
  if (!Number.isFinite(reported) || !Number.isFinite(max)) return null
  const sample = Array.isArray(players.sample) ? players.sample.length : 0
  const current = reported === 0 && sample > 0 ? sample : reported
  return { current, max }
}

function statusFromJson(json) {
  return {
    state: "online",
    players: playersFromStatus(json),
    motd: stripMotd(json?.description) || null,
    versionName: typeof json?.version?.name === "string" ? json.version.name : null,
  }
}

function encodeStatusResponse(json) {
  const body = Buffer.from(JSON.stringify(json), "utf8")
  const payload = Buffer.concat([writeVarInt(0), writeVarInt(body.length), body])
  return Buffer.concat([writeVarInt(payload.length), payload])
}

function decodeStatusResponse(buffer) {
  const cursor = { offset: 0 }
  const length = readVarInt(buffer, cursor)
  if (length == null || buffer.length < cursor.offset + length) return { complete: false }
  const packetId = readVarInt(buffer, cursor)
  if (packetId == null) return { complete: false }
  if (packetId !== 0) return { complete: true, state: "unknown", players: null, motd: null }
  const jsonLength = readVarInt(buffer, cursor)
  if (jsonLength == null || buffer.length < cursor.offset + jsonLength) return { complete: false }
  try {
    const json = JSON.parse(buffer.subarray(cursor.offset, cursor.offset + jsonLength).toString("utf8"))
    return { complete: true, ...statusFromJson(json) }
  } catch {
    return { complete: true, state: "unknown", players: null, motd: null }
  }
}

function pingMinecraft(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = net.connect({ host, port })
    const chunks = []
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    const timer = setTimeout(() => finish({ state: "unknown" }), timeoutMs)

    socket.on("error", (error) => {
      clearTimeout(timer)
      const code = error && error.code
      finish({ state: code === "ECONNREFUSED" ? "offline" : "unknown" })
    })

    socket.on("connect", () => {
      const handshake = Buffer.concat([
        writeVarInt(STATUS_PROTOCOL),
        writeString(host),
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        writeVarInt(1),
      ])
      socket.write(Buffer.concat([framePacket(0, handshake), framePacket(0, Buffer.alloc(0))]))
    })

    socket.on("data", (chunk) => {
      chunks.push(chunk)
      const decoded = decodeStatusResponse(Buffer.concat(chunks))
      if (!decoded.complete) return
      clearTimeout(timer)
      if (decoded.state !== "online") {
        finish({ state: "unknown" })
        return
      }
      finish({
        state: "online",
        players: decoded.players,
        motd: decoded.motd,
        versionName: decoded.versionName,
        ping: Date.now() - started,
      })
    })
  })
}

async function probeRealm(host, port = 25565) {
  const realm = await pingMinecraft(host, port)
  return {
    host,
    port,
    state: realm.state,
    online: realm.state === "online" ? true : realm.state === "offline" ? false : null,
    players: realm.players || null,
    ping: Number.isFinite(realm.ping) ? realm.ping : null,
    motd: realm.motd || null,
  }
}

module.exports = {
  probeRealm,
  pingMinecraft,
  playersFromStatus,
  decodeStatusResponse,
  encodeStatusResponse,
}
