/**
 * Host half of dsh-project-autotest: the automation-test workbench's storage
 * and its fenced HTTP routes.
 *
 * The test setup is per WORKSPACE and lives INSIDE the workspace, at
 * `<workspace>/docs/autotest/`:
 *
 * - `project.json` — the machine document the page edits;
 * - `report.md`    — a human-readable conclusion report, regenerated on every
 *                    save so it can never describe a stale state.
 *
 * Being inside the project rather than in `$DSH_HOME` makes the plan reviewable
 * beside the code and durable across a Harness reinstall. Nothing is written
 * until the user edits something.
 *
 * Routes, all under `POST /project-autotest/api/*`:
 *
 * - `workspaces` — the workspace list the page's picker renders, with each
 *   workspace's case count.
 * - `project`    — read one workspace's project, creating a fresh one in
 *   memory when none exists (nothing is written until the first save).
 * - `save`       — replace one project document and rewrite its report. The page
 *   sends the whole document; every field is re-validated by `normalizeProject`.
 * - `export`     — render XMind / TestLink XML / CSV / Markdown and return the
 *   bytes, so the browser gets a finished file rather than raw data.
 *
 * The routes are fenced with the same loopback Host + same-origin rule the
 * /api gateway applies (copied, not imported): an unfenced route would let any
 * page the user visits rewrite their test plans through their browser.
 *
 * @module dsh-project-autotest
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { API_PREFIX, createProject, normalizeProject, type ExportFormat, type ProjectSnapshot, type WorkspaceSummary } from './wire.ts'
import { renderExport } from './export.ts'
import { renderReport } from './report.ts'
import { importCases, ImportError, type ImportedCase, type ImportResult } from './importers.ts'
import { fromBase64 } from './unzip.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-project-autotest'

/**
 * Services required before mounting.
 *
 * `webServer` carries the routes. The workspace registry is probed with
 * `ctx.get` rather than injected: a Host-only profile without it still mounts
 * and answers from its storage alone.
 */
export const inject = ['webServer']

/**
 * The request face route handlers see (structural subset of node's
 * IncomingMessage).
 *
 * Deliberately NOT `AsyncIterable`: current Node no longer implements
 * `Symbol.asyncIterator` on `http.IncomingMessage` (it was removed with the
 * stream refactor), so `for await` over a request throws `TypeError` — and the
 * webserver answers such a throw with an empty 400. Bodies are read through the
 * `data`/`end`/`error` events below.
 */
export interface PluginHttpRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  once(event: 'data', listener: (chunk: string | Uint8Array) => void): this
  once(event: 'end', listener: () => void): this
  once(event: 'error', listener: (error: Error) => void): this
  removeListener?(event: string, listener: (...args: never[]) => void): this
}

/** The response face route handlers write to (structural subset of ServerResponse). */
export interface PluginHttpResponse {
  statusCode: number
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

/** One named webserver route. */
export interface WebRoute {
  kind: 'prefix' | 'exact'
  path: string
  handler: (req: PluginHttpRequest, res: PluginHttpResponse) => void | Promise<void>
}

/** The host webserver service (`ctx.webServer`). */
export interface WebServerService {
  register(route: WebRoute): () => void
}

/** One workspace as the Host registry reports it. */
interface WorkspaceEntityLike {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

/** The durable workspace registry (`ctx.workspaceRegistry`). */
interface WorkspaceRegistryService {
  list(): WorkspaceEntityLike[]
  get?(id: string): WorkspaceEntityLike | undefined
}

/** The context this half is typed against. */
interface HostContext {
  webServer: WebServerService
  get(name: string): unknown
  effect(callback: () => (() => void) | void, label?: string): void
}

/** The fence's own defaults: a loopback-only deployment trusts no foreign authority. */
const NO_TRUSTED_HOSTS: readonly string[] = Object.freeze([])

/**
 * Non-loopback authorities this deployment serves (`--trusted-host`).
 *
 * Read behind a guard because Cordis turns ANY un-injected property read on the
 * plugin context into a thrown `cannot get property "trustedHosts" without
 * inject` — the same exception for a missing service and for an ordinary data
 * field. That throw happened while fencing inside the route handler, the
 * webserver caught it and answered an empty 400, which is exactly the failure
 * this function must never repeat: a fence that cannot read its configuration
 * degrades to loopback-only, it does not take the route down.
 * @param ctx - the Host context.
 * @returns the trusted authorities, or none.
 */
function trustedHosts(ctx: HostContext): readonly string[] {
  let value: unknown
  try {
    value = (ctx as { trustedHosts?: unknown }).trustedHosts
  } catch {
    return NO_TRUSTED_HOSTS
  }
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : NO_TRUSTED_HOSTS
}

function header(request: PluginHttpRequest, key: string): string | undefined {
  const value = request.headers[key]
  return typeof value === 'string' ? value : undefined
}

/** Whether a hostname names the loopback authority. */
function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Decide whether one request may reach the routes: loopback (or a trusted)
 * Host header, and a same-origin `Origin` when the browser attached one.
 * @param request - the request headers.
 * @param trusted - non-loopback authorities this deployment serves.
 * @returns whether the request is trusted.
 */
export function isTrustedRequest(request: PluginHttpRequest, trusted: readonly string[]): boolean {
  const host = header(request, 'host')
  if (host === undefined) return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname) && !trusted.includes(host)) return false
  if (header(request, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).hostname === hostUrl.hostname
  } catch {
    return false
  }
}

/**
 * The per-workspace storage directory: `<workspace>/docs/autotest/`.
 *
 * Deliberately INSIDE the workspace and not in `$DSH_HOME`: a test plan is
 * project documentation, so it belongs beside the code, is reviewable in a PR,
 * and survives a reinstall of Harness. Nothing here is written unless the user
 * edits something.
 * @param workspacePath - the workspace's absolute directory.
 * @returns the storage directory for that workspace.
 */
export function autotestDir(workspacePath: string): string {
  return join(workspacePath, 'docs', 'autotest')
}

/**
 * The project document's path.
 *
 * Fixed children only: the directory comes from the registry, never from the
 * request, so a crafted id cannot steer a write outside the workspace.
 * @param workspacePath - the workspace's absolute directory.
 * @returns the path of `project.json`.
 */
export function projectFile(workspacePath: string): string {
  if (!isAbsolute(workspacePath)) throw new Error('workspace path must be absolute')
  return join(autotestDir(workspacePath), 'project.json')
}

/**
 * The human-readable conclusion report's path.
 * @param workspacePath - the workspace's absolute directory.
 * @returns the path of `report.md`.
 */
export function reportFile(workspacePath: string): string {
  if (!isAbsolute(workspacePath)) throw new Error('workspace path must be absolute')
  return join(autotestDir(workspacePath), 'report.md')
}

/**
 * Read one request body as text through the stream's events, bounded so a
 * crafted body cannot exhaust memory.
 *
 * Event-based on purpose: see {@link PluginHttpRequest} — `for await` over an
 * `IncomingMessage` is not supported by this Node, and its throw becomes the
 * webserver's body-less 400.
 * @param request - the node request.
 * @param limit - maximum body size in bytes.
 * @returns the decoded body.
 */
export function readBody(request: PluginHttpRequest, limit = 4 * 1024 * 1024): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    let settled = false
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      reject(error)
    }
    request.once('error', fail)
    request.once('data', (chunk) => {
      if (settled) return
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
      size += bytes.length
      if (size > limit) {
        fail(new Error('request body too large'))
        return
      }
      chunks.push(bytes)
    })
    request.once('end', () => {
      if (settled) return
      settled = true
      const joined = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        joined.set(chunk, offset)
        offset += chunk.length
      }
      resolve(new TextDecoder().decode(joined))
    })
  })
}

/** Write a JSON reply. */
function reply(res: PluginHttpResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

/** Write a failure envelope with a user-facing message. */
function fail(res: PluginHttpResponse, status: number, code: string, message: string): void {
  reply(res, status, { ok: false, error: { code, message } })
}

/** Resolve the workspace registry, when this profile has one. */
function registryOf(ctx: HostContext): WorkspaceRegistryService | undefined {
  const candidate = ctx.get('workspaceRegistry')
  return candidate !== undefined && typeof (candidate as WorkspaceRegistryService).list === 'function'
    ? (candidate as WorkspaceRegistryService)
    : undefined
}

/**
 * Load one workspace's project from `<workspace>/docs/autotest/project.json`,
 * or build a fresh, unsaved one.
 * @param workspaceId - the workspace id (stored inside the document).
 * @param title - the registry title, authoritative over the stored copy.
 * @param workspacePath - the registry path; also the storage location.
 * @returns the project, its file path, and whether it existed.
 */
async function loadProject(workspaceId: string, title: string, workspacePath: string): Promise<ProjectSnapshot> {
  const file = projectFile(workspacePath)
  try {
    const text = await readFile(file, 'utf8')
    const project = normalizeProject(JSON.parse(text), workspaceId)
    // The registry is authoritative for a workspace's live title and path.
    if (title !== '') project.title = title
    if (workspacePath !== '') project.path = workspacePath
    return { project, storagePath: file, existed: true }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return {
      project: createProject(workspaceId, title, workspacePath),
      storagePath: file,
      existed: false,
    }
  }
}

/** Write one file atomically (temp file in the same directory, then rename). */
async function writeAtomic(file: string, content: string): Promise<void> {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, content, 'utf8')
  await rename(temp, file)
}

/**
 * Persist one project: the machine document and the human report.
 *
 * Both files are regenerated on every save so `report.md` can never describe a
 * state the project is no longer in.
 * @param project - the normalized project.
 * @param locale - the language the report is written in.
 * @returns the project file path.
 */
async function saveProject(project: ReturnType<typeof normalizeProject>, locale: string): Promise<string> {
  const dir = autotestDir(project.path)
  await mkdir(dir, { recursive: true })
  const file = projectFile(project.path)
  await writeAtomic(file, JSON.stringify(project, null, 2))
  await writeAtomic(reportFile(project.path), renderReport(project, locale))
  return file
}

/**
 * Whether one workspace already has a project document.
 * @param workspacePath - the workspace's absolute directory.
 * @returns true when `docs/autotest/project.json` exists.
 */
async function hasProject(workspacePath: string): Promise<boolean> {
  try {
    const info = await stat(projectFile(workspacePath))
    return info.isFile()
  } catch {
    return false
  }
}

/** Build the picker's workspace list. */
async function listWorkspaces(ctx: HostContext): Promise<WorkspaceSummary[]> {
  const registry = registryOf(ctx)
  if (registry === undefined) return []
  const summaries: WorkspaceSummary[] = []
  for (const workspace of registry.list()) {
    const saved = await hasProject(workspace.path)
    let caseCount = 0
    if (saved) {
      try {
        const text = await readFile(projectFile(workspace.path), 'utf8')
        caseCount = normalizeProject(JSON.parse(text), workspace.id).cases.length
      } catch {
        caseCount = 0
      }
    }
    summaries.push({ workspaceId: workspace.id, title: workspace.title, path: workspace.path, hasProject: saved, caseCount })
  }
  return summaries
}

/**
 * Resolve one workspace's display facts.
 *
 * The PATH is the storage root now, so it is never taken on faith: an id the
 * registry does not know has no path, which refuses the request instead of
 * writing into whatever the caller named.
 * @param ctx - the Host context.
 * @param workspaceId - the requested workspace id.
 * @returns the registry's title and absolute path.
 * @throws when no registry is mounted, the id is unknown, or its path is relative.
 */
function workspaceFacts(ctx: HostContext, workspaceId: string): { title: string; path: string } {
  const registry = registryOf(ctx)
  if (registry === undefined) {
    throw Object.assign(new Error('this Host has no workspace registry, so there is no project to read'), { status: 400 })
  }
  const entity = registry.get?.(workspaceId)
  if (entity === undefined) {
    throw Object.assign(new Error(`unknown workspace "${workspaceId}"`), { status: 404 })
  }
  if (typeof entity.path !== 'string' || !isAbsolute(entity.path)) {
    throw Object.assign(new Error(`workspace "${workspaceId}" has no usable directory`), { status: 400 })
  }
  return { title: entity.title, path: entity.path }
}

/** The request body shape every method accepts. */
interface RequestBody {
  workspaceId?: unknown
  project?: unknown
  format?: unknown
  locale?: unknown
  /** Uploaded file name, for the importer's format detection. */
  filename?: unknown
  /** Uploaded text content (Markdown, CSV, JSON). */
  text?: unknown
  /** Uploaded binary content, base64 (an `.xmind` archive). */
  base64?: unknown
  /** Deterministic alternate for `base64`: the incoming request itself carries the file. */
  isRequest?: unknown
}

/**
 * The document inputs' directory inside a workspace:
 * `<workspace>/docs/autotest/inputs/`.
 *
 * Requirement documents are project documentation, so they live beside the
 * plan (and in its version control), never in `$DSH_HOME`. Names are
 * sanitized to a single path segment, so an upload can only ever create a file
 * DIRECTLY under this directory.
 */
const INPUTS_DIR = 'inputs'

/** A file name safe to join under the inputs directory. */
function safeInputName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').replace(/^\.+/, '').trim()
  return cleaned === '' ? `document-${Date.now()}.txt` : cleaned.slice(0, 160)
}

/**
 * The stored length of one document: an editable body plus its file listing.
 *
 * The files themselves are listed from the directory on every read, so the
 * page can never show a document the disk no longer has.
 */
interface DocumentInput {
  /** The stored file name. */
  name: string
  /** Size in bytes. */
  size: number
  /** Last modification, epoch ms. */
  modifiedAt: number
}

/** Read every stored document, newest first. */
async function listInputs(workspacePath: string): Promise<DocumentInput[]> {
  const dir = join(autotestDir(workspacePath), INPUTS_DIR)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const entries: DocumentInput[] = []
  for (const name of names) {
    if (name.startsWith('.')) continue
    try {
      const info = await stat(join(dir, name))
      if (info.isFile()) entries.push({ name, size: info.size, modifiedAt: info.mtimeMs })
    } catch {
      // A file that vanished between readdir and stat is simply not listed.
    }
  }
  return entries.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

/** Guard the workspace id field. */
function workspaceIdOf(body: RequestBody): string {
  const value = body.workspaceId
  if (typeof value !== 'string' || value.trim() === '') throw Object.assign(new Error('workspaceId is required'), { status: 400 })
  return value
}

/** Validate an export format. */
function formatOf(body: RequestBody): ExportFormat {
  const value = body.format
  if (value === 'xmind' || value === 'testlink-xml' || value === 'csv' || value === 'markdown') return value
  throw Object.assign(new Error(`unsupported export format "${String(value)}"`), { status: 400 })
}

/** The `import` route's success payload. */
interface ImportPayload {
  /** Which importer read the file. */
  format: ImportResult['format']
  /** The cases the file carries, ready to append. */
  cases: ImportedCase[]
  /** What was dropped or degraded, as one line each. */
  warnings: string[]
}

/**
 * Run the importer over one uploaded file.
 *
 * The file arrives as base64 (an `.xmind` is binary) or as text, and the
 * importer decides by name first, content second — so a renamed file still
 * reads. Every failure is a 400 the page can show verbatim.
 * @param filename - the uploaded file's name.
 * @param body - the request body carrying `base64` or `text`.
 * @returns the parsed cases.
 */
async function importFile(filename: string, body: RequestBody): Promise<ImportPayload> {
  try {
    return await parseUpload(filename, body)
  } catch (error) {
    // Every importer failure is the CALLER's file, not a server fault: report
    // it as a 400 the page can show verbatim.
    if (error instanceof ImportError) throw Object.assign(new Error(error.message), { status: 400 })
    if (typeof (error as { status?: unknown }).status === 'number') throw error
    throw Object.assign(new Error(`"${filename}" could not be read: ${(error as Error).message}`), { status: 400 })
  }
}

/**
 * Read an uploaded file into cases.
 * @param filename - the uploaded file's name.
 * @param body - the request body carrying `base64` or `text`.
 * @returns the parsed cases.
 */
async function parseUpload(filename: string, body: RequestBody): Promise<ImportPayload> {
  if (typeof body.base64 === 'string' && body.base64 !== '') {
    let bytes: Uint8Array
    try {
      bytes = fromBase64(body.base64)
    } catch {
      throw Object.assign(new Error('the uploaded file is not valid base64'), { status: 400 })
    }
    // A text file the page sent as bytes is decoded by the importer itself.
    const text = /^\.(xmind|zip)$/i.test(filename) ? undefined : new TextDecoder('utf-8').decode(bytes)
    const result = await importCases({ filename, bytes, text })
    return { format: result.format, cases: result.cases, warnings: result.warnings }
  }
  if (typeof body.text === 'string') {
    const result = await importCases({ filename, text: body.text })
    return { format: result.format, cases: result.cases, warnings: result.warnings }
  }
  throw Object.assign(new Error('the import needs a file: send "text" or "base64"'), { status: 400 })
}

/**
 * The route table: one handler per method, sharing the request plumbing.
 * @param ctx - the Host context.
 * @returns the prefix route handler.
 */
export function createApi(ctx: HostContext) {
  /**
   * The whole handler, with one outer net: the webserver answers ANY exception
   * escaping a route with an empty 400, which the page can only render as
   * "answered HTTP 400 without a body". Every branch below already reports its
   * own failure, so a throw reaching here is a bug in the fence or the
   * plumbing; it is logged with its stack and still answered as an envelope.
   */
  const dispatch = async (request: PluginHttpRequest, res: PluginHttpResponse): Promise<void> => {
    console.error(`[dsh-project-autotest] request ${request.method ?? '?'} ${request.url ?? '?'}`)
    if (request.method !== 'POST') {
      fail(res, 405, 'method-not-allowed', 'POST only')
      return
    }
    if (!isTrustedRequest(request, trustedHosts(ctx))) {
      fail(res, 403, 'untrusted', 'this route only answers the local page')
      return
    }
    const url = request.url ?? ''
    const method = url.split('?')[0]?.split('/').pop() ?? ''
    // The document upload's alternate form: the file IS the request body. It is
    // signalled in the query string because the body cannot describe itself.
    const query = new URLSearchParams(url.split('?')[1] ?? '')
    if (method === 'document' && query.get('isRequest') === '1') {
      try {
        const workspaceId = workspaceIdOf({ workspaceId: query.get('workspaceId') ?? '' })
        const facts = workspaceFacts(ctx, workspaceId)
        const filename = safeInputName(query.get('filename') ?? 'document.txt')
        const bytes = new TextEncoder().encode(await readBody(request, 8 * 1024 * 1024))
        const dir = join(autotestDir(facts.path), INPUTS_DIR)
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, filename), bytes)
        reply(res, 200, { ok: true, value: { name: filename, size: bytes.length, documents: await listInputs(facts.path) } })
      } catch (error) {
        const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 400
        fail(res, status, 'bad-request', (error as Error).message)
      }
      return
    }
    let body: RequestBody
    try {
      const text = await readBody(request)
      body = text === '' ? {} : (JSON.parse(text) as RequestBody)
    } catch (error) {
      // Log the cause: the client only carries the message, and the webserver
      // would turn an uncaught throw into a body-less 400.
      console.error('[dsh-project-autotest] request rejected', method, error instanceof Error ? error.message : error)
      fail(res, 400, 'bad-request', (error as Error).message)
      return
    }

    try {
      switch (method) {
        case 'version': {
          // Read by the PAGE at mount. The page and the Host load separately
          // (the browser bundle reloads on a refresh; the Host module does
          // not), so the page compares its own build with this one and warns
          // when they differ — the failure that made every route answer 400
          // while looking like a plugin bug.
          reply(res, 200, { ok: true, value: { build: BUILD_STAMP } })
          return
        }
        case 'ping': {
          // Answers without touching anything: the page uses it to tell
          // "this Host never loaded the plugin" apart from "the request was
          // refused", which both look like a 400 without a body from outside.
          reply(res, 200, { ok: true, value: { build: BUILD_STAMP, pid: process.pid, plugin: 'dsh-project-autotest' } })
          return
        }
        case 'workspaces': {
          reply(res, 200, { ok: true, value: { workspaces: await listWorkspaces(ctx) } })
          return
        }
        case 'project': {
          const workspaceId = workspaceIdOf(body)
          const facts = workspaceFacts(ctx, workspaceId)
          reply(res, 200, { ok: true, value: await loadProject(workspaceId, facts.title, facts.path) })
          return
        }
        case 'save': {
          const workspaceId = workspaceIdOf(body)
          const facts = workspaceFacts(ctx, workspaceId)
          const current = await loadProject(workspaceId, facts.title, facts.path)
          const project = normalizeProject(body.project, workspaceId)
          // Title and path come from the registry, never from the page.
          project.title = facts.title !== '' ? facts.title : current.project.title
          project.path = facts.path !== '' ? facts.path : current.project.path
          project.createdAt = current.project.createdAt
          project.updatedAt = Date.now()
          const locale = typeof body.locale === 'string' ? body.locale : 'zh'
          const file = await saveProject(project, locale)
          reply(res, 200, { ok: true, value: { project, storagePath: file } satisfies ProjectSnapshot })
          return
        }
        case 'export': {
          const workspaceId = workspaceIdOf(body)
          const format = formatOf(body)
          const locale = typeof body.locale === 'string' ? body.locale : 'zh'
          const facts = workspaceFacts(ctx, workspaceId)
          // An export renders the SAVED project: the page saves before it
          // exports, so the file always matches what is on disk.
          const snapshot = await loadProject(workspaceId, facts.title, facts.path)
          const artifact = renderExport(snapshot.project, format, locale)
          reply(res, 200, { ok: true, value: { artifact } })
          return
        }
        case 'documents': {
          // The stage-① input. Reading lists what is on disk; nothing is created
          // by looking.
          const workspaceId = workspaceIdOf(body)
          const facts = workspaceFacts(ctx, workspaceId)
          reply(res, 200, { ok: true, value: { documents: await listInputs(facts.path) } })
          return
        }
        case 'document': {
          // Store one requirement document under the workspace. Same contract
          // as `import`, but the bytes are PERSISTED, so the alternate
          // `isRequest: true` form makes the page POST the file as the request
          // body itself instead of base64 inside JSON.
          const workspaceId = workspaceIdOf(body)
          const facts = workspaceFacts(ctx, workspaceId)
          const filename = safeInputName(typeof body.filename === 'string' && body.filename !== '' ? body.filename : 'document.txt')
          let bytes: Uint8Array
          if (body.isRequest === true) {
            const raw = await readBody(request, 8 * 1024 * 1024)
            bytes = new TextEncoder().encode(raw)
          } else if (typeof body.base64 === 'string') {
            bytes = fromBase64(body.base64)
          } else if (typeof body.text === 'string') {
            bytes = new TextEncoder().encode(body.text)
          } else {
            throw Object.assign(new Error('the upload needs "base64", "text" or isRequest'), { status: 400 })
          }
          const dir = join(autotestDir(facts.path), INPUTS_DIR)
          await mkdir(dir, { recursive: true })
          const file = join(dir, filename)
          await writeFile(file, bytes)
          reply(res, 200, { ok: true, value: { name: filename, size: bytes.length, documents: await listInputs(facts.path) } })
          return
        }
        case 'documentDelete': {
          const workspaceId = workspaceIdOf(body)
          const facts = workspaceFacts(ctx, workspaceId)
          const name = safeInputName(typeof body.filename === 'string' ? body.filename : '')
          await rm(join(autotestDir(facts.path), INPUTS_DIR, name), { force: true })
          reply(res, 200, { ok: true, value: { documents: await listInputs(facts.path) } })
          return
        }
        case 'import': {
          // Parsing is stateless: the page previews what WOULD be imported and
          // then saves the document it decides on. Nothing is written here, so
          // a mis-picked file can never touch the stored project.
          const filename = typeof body.filename === 'string' && body.filename !== '' ? body.filename : 'import'
          const result = await importFile(filename, body)
          reply(res, 200, { ok: true, value: { import: result } satisfies ImportPayload })
          return
        }
        default:
          fail(res, 404, 'not-found', `unknown method "${method}"`)
          return
      }
    } catch (error) {
      const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500
      // A 500 is OUR fault, not the caller's: log it with its stack so the Host
      // console names the failing line instead of leaving a bare status.
      if (status >= 500) {
        console.error('[dsh-project-autotest] route failed', method, error instanceof Error ? error.stack : error)
      }
      fail(res, status, status === 500 ? 'internal' : 'bad-request', (error as Error).message)
    }
  }

  return async (request: PluginHttpRequest, res: PluginHttpResponse): Promise<void> => {
    try {
      await dispatch(request, res)
    } catch (error) {
      console.error('[dsh-project-autotest] handler failed before replying', error instanceof Error ? error.stack : error)
      // Headers may already be on the wire; only an unstarted reply can be rescued.
      try {
        fail(res, 500, 'internal', error instanceof Error ? error.message : String(error))
      } catch {
        // The socket is gone: nothing left to answer on.
      }
    }
  }
}

/** The build stamp the page reports, so a running Host can be identified. */
const BUILD_STAMP = '__BUILD_STAMP__'

/**
 * Activate the Host half: mount the fenced API routes.
 *
 * The FIRST thing this prints is an unmissable banner with the build stamp and
 * the process id. A plugin that fails to mount is indistinguishable from one
 * that is not installed, and that ambiguity cost a whole round of debugging:
 *   `[dsh-project-autotest] LOADED (build …)`
 * in the Host log now answers "was this build ever loaded?" without any doubt.
 * @param ctx - the Host context.
 */
export function apply(ctx: HostContext): void {
  console.error('=========================================================')
  console.error(`[dsh-project-autotest] LOADED (build ${BUILD_STAMP})`)
  console.error('=========================================================')
  try {
    // Construct the handler OUTSIDE register(): a throw in construction would
    // otherwise look like a broken route.
    const handler = createApi(ctx)
    ctx.effect(() => {
      const dispose = ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
      console.error(`[dsh-project-autotest] READY at ${API_PREFIX} (build ${BUILD_STAMP})`)
      // Cordis calls the effect's callback as `dispose(reload)`; forward it so
      // the route leaves the webserver's table on disposal instead of leaking
      // a dead handler that would answer every later request with an empty 400.
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    }, 'dsh-project-autotest: API routes')
  } catch (error) {
    console.error('[dsh-project-autotest] apply() FAILED', error instanceof Error ? error.stack : error)
    throw error
  }
}

/** The build stamp, exposed for the page and for diagnostics. */
export function buildStamp(): string {
  return BUILD_STAMP
}

/** Re-exported so the module keeps one public surface for the loader. */
export { API_PREFIX }
