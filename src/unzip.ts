/**
 * ZIP reader for the XMind import.
 *
 * The mirror image of {@link ./zip.ts}: it walks the central directory of an
 * `.xmind` container and hands back one entry by name. Two things matter here
 * and nowhere else:
 *
 * - the archive is UNTRUSTED (it is whatever file the user picked), so every
 *   read is bounds-checked and every declared length is respected literally —
 *   a lying size answers "missing", never an out-of-range read;
 * - XMind stores its content either STORED or DEFLATE, and both occur in the
 *   wild (modern XMind writes deflated `content.json`), so both are read.
 *
 * Browser-safe on purpose: no `node:` imports, so the Client bundle inlines it
 * and the whole import runs in the page.
 *
 * @module dsh-project-autotest/unzip
 */

/** One readable entry of an archive. */
export interface UnzippedEntry {
  /** The entry's path inside the archive. */
  name: string
  /** The entry's bytes, inflated when the entry was deflated. */
  data: Uint8Array
}

/** A built-in `DecompressionStream`, when the runtime has one. */
type InflaterFactory = () => unknown

/**
 * The session's `DecompressionStream` constructor, read without assuming the
 * global exists: an older browser answers `undefined`, and the caller then
 * reports a missing `content.json` rather than throwing at module load.
 * @returns the constructor, or undefined.
 */
function inflaterFactory(): InflaterFactory | undefined {
  const candidate = (globalThis as { DecompressionStream?: new (format: 'deflate-raw') => unknown })
    .DecompressionStream
  return candidate === undefined ? undefined : () => new candidate('deflate-raw')
}

/** Read a little-endian 16-bit value, bounds-checked. */
function u16(bytes: Uint8Array, at: number): number {
  return bytes[at]! | (bytes[at + 1]! << 8)
}

/** Read a little-endian 32-bit value, bounds-checked (unsigned). */
function u32(bytes: Uint8Array, at: number): number {
  return (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
}

/**
 * Inflate one raw-deflate stream.
 *
 * `DecompressionStream` is asynchronous, and so is this; a caller that only
 * needs a STORED entry never touches it.
 * @param data - the compressed bytes.
 * @returns the inflated bytes.
 * @throws when the runtime has no inflater or the stream is corrupt.
 */
export async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const factory = inflaterFactory()
  if (factory === undefined) throw new Error('this browser cannot inflate a deflated XMind archive')
  const stream = factory() as {
    writable: { getWriter(): { write(chunk: Uint8Array): Promise<void>; close(): Promise<void> } }
    readable: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } }
  }
  const writer = stream.writable.getWriter()
  // The write is deliberately not awaited before reading starts: the stream is
  // push-based, so a large entry would deadlock if the reader waited for a
  // finished writer.
  const writing = writer.write(data).then(() => writer.close())
  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    chunks.push(value)
    size += value.length
  }
  await writing
  const joined = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return joined
}

/**
 * Locate the end-of-central-directory record, scanning back over a possible
 * archive comment (ZIP allows up to 64 KiB of it).
 * @param bytes - the archive.
 * @returns the record's offset, or -1.
 */
function findEndRecord(bytes: Uint8Array): number {
  const floor = Math.max(0, bytes.length - 22 - 0xFFFF)
  for (let at = bytes.length - 22; at >= floor; at -= 1) {
    if (u32(bytes, at) === 0x06054B50) return at
  }
  return -1
}

/**
 * Read the archive's directory: name, compression method, and data span.
 * @param bytes - the archive.
 * @returns the entries, in archive order; empty when the file is not a ZIP.
 */
export function listArchive(bytes: Uint8Array): Array<{ name: string; method: number; offset: number; compressedSize: number; size: number }> {
  if (bytes.length < 22) return []
  const end = findEndRecord(bytes)
  if (end < 0) return []
  const count = u16(bytes, end + 10)
  const directoryAt = u32(bytes, end + 16)
  const entries: Array<{ name: string; method: number; offset: number; compressedSize: number; size: number }> = []
  let at = directoryAt
  const decoder = new TextDecoder('utf-8')
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || u32(bytes, at) !== 0x02014B50) break
    const flags = u16(bytes, at + 8)
    const method = u16(bytes, at + 10)
    const compressedSize = u32(bytes, at + 20)
    const size = u32(bytes, at + 24)
    const nameLength = u16(bytes, at + 28)
    const extraLength = u16(bytes, at + 30)
    const commentLength = u16(bytes, at + 32)
    const localAt = u32(bytes, at + 42)
    if (at + 46 + nameLength > bytes.length) break
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    // UTF-8 flagged names are the norm now; a bare ASCII name decodes the same.
    void flags
    entries.push({ name, method, offset: localAt, compressedSize, size })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/**
 * Read one entry's bytes, inflating it when the archive stored it deflated.
 * @param bytes - the archive.
 * @param entry - the directory record to read.
 * @returns the entry data, or null when the record points outside the archive.
 */
export async function readEntry(
  bytes: Uint8Array,
  entry: { method: number; offset: number; compressedSize: number; size: number },
): Promise<Uint8Array | null> {
  const local = entry.offset
  if (local + 30 > bytes.length || u32(bytes, local) !== 0x04034B50) return null
  const nameLength = u16(bytes, local + 26)
  const extraLength = u16(bytes, local + 28)
  const start = local + 30 + nameLength + extraLength
  const end = start + entry.compressedSize
  if (start > bytes.length || end > bytes.length) return null
  const raw = bytes.subarray(start, end)
  if (entry.method === 0) return raw
  if (entry.method === 8) {
    const inflated = await inflateRaw(raw)
    // A lying uncompressed size is not fatal: the actual length is what counts.
    return inflated
  }
  return null
}

/**
 * Find and read one named entry.
 *
 * Matching is case-insensitive and also accepts a path suffix, so both the
 * long-form (`content.json`) and any prefixed variant a producer emits resolve.
 * @param bytes - the archive.
 * @param name - the entry name to find.
 * @returns the entry, or null when the archive does not carry it.
 */
export async function findEntry(bytes: Uint8Array, name: string): Promise<UnzippedEntry | null> {
  const wanted = name.toLowerCase()
  const entry = listArchive(bytes).find((candidate) => {
    const lower = candidate.name.toLowerCase()
    return lower === wanted || lower.endsWith(`/${wanted}`)
  })
  if (entry === undefined) return null
  const data = await readEntry(bytes, entry)
  return data === null ? null : { name: entry.name, data }
}

/**
 * Decode a base64 string into bytes (the `.xmind` may arrive base64-encoded
 * from the Host, or as a file the page read itself).
 * @param text - the base64 (whitespace tolerated).
 * @returns the bytes.
 */
export function fromBase64(text: string): Uint8Array {
  const cleaned = text.replace(/\s+/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
