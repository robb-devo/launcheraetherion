/**
 * Minimal ZIP reader for Modrinth .mrpack files.
 * Supports stored and deflate entries. Rejects encryption and zip bombs.
 */

const zlib = require("node:zlib")

const MAX_ENTRY_BYTES = 256 * 1024 * 1024
const MAX_TOTAL_BYTES = 512 * 1024 * 1024

function readZip(buffer) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  const eocd = findEndOfCentralDirectory(input)
  const count = input.readUInt16LE(eocd + 10)
  const centralSize = input.readUInt32LE(eocd + 12)
  const centralOffset = input.readUInt32LE(eocd + 16)
  if (centralOffset + centralSize > input.length) {
    throw new Error("Modpack archive is truncated.")
  }

  const entries = []
  let offset = centralOffset
  let total = 0
  for (let index = 0; index < count; index += 1) {
    if (input.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Modpack archive directory is invalid.")
    }
    const flags = input.readUInt16LE(offset + 8)
    const method = input.readUInt16LE(offset + 10)
    const compressedSize = input.readUInt32LE(offset + 20)
    const uncompressedSize = input.readUInt32LE(offset + 24)
    const nameLength = input.readUInt16LE(offset + 28)
    const extraLength = input.readUInt16LE(offset + 30)
    const commentLength = input.readUInt16LE(offset + 32)
    const localOffset = input.readUInt32LE(offset + 42)
    const name = input.slice(offset + 46, offset + 46 + nameLength).toString("utf8")
    offset += 46 + nameLength + extraLength + commentLength

    if (flags & 0x1) throw new Error("Encrypted modpack archives are not supported.")
    if (uncompressedSize > MAX_ENTRY_BYTES || compressedSize > MAX_ENTRY_BYTES) {
      throw new Error("A file in this modpack is too large.")
    }
    total += uncompressedSize
    if (total > MAX_TOTAL_BYTES) throw new Error("This modpack is too large to install.")

    const data = readLocalEntry(input, localOffset, method, compressedSize)
    entries.push({ name, data })
  }
  return entries
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 22 - 65535)
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset
  }
  throw new Error("Modpack archive is not a zip file.")
}

function readLocalEntry(buffer, localOffset, method, compressedSize) {
  if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error("Modpack archive entry is invalid.")
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26)
  const extraLength = buffer.readUInt16LE(localOffset + 28)
  const start = localOffset + 30 + nameLength + extraLength
  const end = start + compressedSize
  if (end > buffer.length) throw new Error("Modpack archive entry is truncated.")
  const compressed = buffer.subarray(start, end)
  if (method === 0) return Buffer.from(compressed)
  if (method === 8) return zlib.inflateRawSync(compressed)
  throw new Error(`Modpack compression method ${method} is not supported.`)
}

module.exports = {
  readZip,
  MAX_ENTRY_BYTES,
  MAX_TOTAL_BYTES,
}
