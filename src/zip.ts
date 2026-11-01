/**
 * ZIP writer for the XMind export.
 *
 * XMind's `.xmind` file is a ZIP container holding `content.json` (plus a
 * `metadata.json`). There is no compression requirement a reader relies on, so
 * this writer emits STORED entries: the format stays small and dependency-free,
 * and any ZIP-tool or XMind build reads it. A deflate implementation would only
 * buy bytes we can afford to spend.
 *
 * The output is a real ZIP: local file header, data, central directory, end of
 * central directory. A reader that rejects it (zipinfo, `unzip -t`) is the test.
 *
 * @module dsh-project-autotest/zip
 */

/** One file inside the archive. */
export interface ZipEntry {
  /** Archive path, always `/`-separated. */
  name: string
  /** The file contents. */
  data: Uint8Array
}

/** CRC-32 (IEEE 802.3) table, built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

/**
 * Compute the CRC-32 of a byte array.
 * @param bytes - the data.
 * @returns the checksum as an unsigned 32-bit integer.
 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xFF] as number) ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** MS-DOS date and time for "now", as ZIP headers store them. */
function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  }
}

/**
 * Build a ZIP archive from entries, uncompressed.
 *
 * @param entries - the files to store, in order.
 * @param now - timestamp for every entry (kept injectable for deterministic tests).
 * @returns the archive bytes.
 */
export function buildZip(entries: readonly ZipEntry[], now = new Date()): Uint8Array {
  const encoder = new TextEncoder()
  const { date, time } = dosDateTime(now)
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)

    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034B50, true) // local file header signature
    localView.setUint16(4, 20, true) // version needed (2.0)
    localView.setUint16(6, 0, true) // flags: none (binary, not UTF-8-flagged)
    localView.setUint16(8, 0, true) // method: stored
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true) // extra field length
    local.set(name, 30)

    const centralHeader = new Uint8Array(46 + name.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014B50, true) // central directory signature
    centralView.setUint16(4, 20, true) // version made by
    centralView.setUint16(6, 20, true) // version needed
    centralView.setUint16(8, 0, true) // flags
    centralView.setUint16(10, 0, true) // method: stored
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true) // extra length
    centralView.setUint16(32, 0, true) // comment length
    centralView.setUint16(34, 0, true) // disk number
    centralView.setUint16(36, 0, true) // internal attributes
    centralView.setUint32(38, 0, true) // external attributes
    centralView.setUint32(42, offset, true) // local header offset
    centralHeader.set(name, 46)

    chunks.push(local, data)
    central.push(centralHeader)
    offset += local.length + data.length
  }

  const centralSize = central.reduce((size, chunk) => size + chunk.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054B50, true) // end of central directory signature
  endView.setUint16(8, entries.length, true) // entries on this disk
  endView.setUint16(10, entries.length, true) // entries total
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true) // comment length

  const total = offset + centralSize + end.length
  const archive = new Uint8Array(total)
  let position = 0
  for (const chunk of [...chunks, ...central, end]) {
    archive.set(chunk, position)
    position += chunk.length
  }
  return archive
}

/**
 * Base64-encode bytes without Node's Buffer, so this module stays browser-safe.
 * @param bytes - the data.
 * @returns the base64 string.
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  // `btoa` exists in browsers; Node's global `btoa` has been available since 16.
  return btoa(binary)
}
