const net = require("node:net")

const STATUS_PROTOCOL = 760

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
  if (typeof value === "string") return value.replace(/§./g, "").trim()
  if (value && Array.isArray(value.extra)) {
    return value.extra.map((part) => stripMotd(part)).join("").trim()
  }
  if (value && typeof value.text === "string") return stripMotd(value.text)
  return ""
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
      try {
        const buffer = Buffer.concat(chunks)
        const cursor = { offset: 0 }
        const length = readVarInt(buffer, cursor)
        if (length == null || buffer.length < cursor.offset + length) return
        const packetId = readVarInt(buffer, cursor)
        if (packetId !== 0) return
        const jsonLength = readVarInt(buffer, cursor)
        if (jsonLength == null || buffer.length < cursor.offset + jsonLength) return
        const json = JSON.parse(buffer.subarray(cursor.offset, cursor.offset + jsonLength).toString("utf8"))
        clearTimeout(timer)
        const players = json.players || {}
        finish({
          state: "online",
          players:
            Number.isFinite(players.online) && Number.isFinite(players.max)
              ? { current: players.online, max: players.max }
              : null,
          motd: stripMotd(json.description) || null,
          ping: Date.now() - started,
        })
      } catch {
        clearTimeout(timer)
        finish({ state: "unknown" })
      }
    })
  })
}

async function probeMojang(timeoutMs = 4000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch("https://sessionserver.mojang.com/", {
      method: "GET",
      signal: controller.signal,
    })
    return response.status < 500 ? "online" : "unknown"
  } catch {
    return "unknown"
  } finally {
    clearTimeout(timer)
  }
}

async function probeRealm(host, port = 25565) {
  const [realm, mojang] = await Promise.all([pingMinecraft(host, port), probeMojang()])
  return {
    host,
    port,
    state: realm.state,
    online: realm.state === "online" ? true : realm.state === "offline" ? false : null,
    players: realm.players || null,
    ping: Number.isFinite(realm.ping) ? realm.ping : null,
    motd: realm.motd || null,
    mojang,
  }
}

module.exports = { probeRealm, pingMinecraft }
