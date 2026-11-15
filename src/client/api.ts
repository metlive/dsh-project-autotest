/**
 * The Client side of this plugin's wire: one thin RPC layer over the Host
 * routes and the download helper exports use.
 *
 * Every call answers the Host's `{ ok, value } | { ok, error }` envelope, and
 * the failure branch throws an `Error` carrying the Host's user-facing message,
 * so a caller renders one string instead of branching on status codes.
 *
 * @module dsh-project-autotest/client/api
 */
import {
  API_PREFIX,
  type ExportArtifact,
  type ExportFormat,
  type ProjectSnapshot,
  type WorkspaceSummary,
} from '../wire.ts'
import type { ImportedCase, ImportResult } from '../importers.ts'

/** A failed RPC, with the Host's message already fit for display. */
export class ApiError extends Error {
  /** The Host's error code, when it sent one. */
  readonly code: string

  /**
   * @param message - the user-facing message.
   * @param code - the Host's error code.
   */
  constructor(message: string, code = 'error') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * Call one Host route.
 * @param method - the route's last path segment.
 * @param body - the JSON payload.
 * @returns the envelope's `value`.
 * @throws {ApiError} when the Host reports a failure.
 */
async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_PREFIX}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new ApiError(`The plugin's Host half is unreachable: ${(error as Error).message}`, 'network')
  }
  const payload: unknown = await response.json().catch(() => null)
  if (payload === null || typeof payload !== 'object') {
    throw new ApiError(`The plugin's Host route answered HTTP ${response.status} without a body.`, 'bad-response')
  }
  const envelope = payload as { ok?: boolean; error?: { code?: string; message?: string } } & { value?: T }
  if (envelope.ok !== true) {
    throw new ApiError(envelope.error?.message ?? `HTTP ${response.status}`, envelope.error?.code ?? 'error')
  }
  return envelope.value as T
}

/**
 * List the workspaces the picker offers.
 * @returns every registered workspace with its project facts.
 */
export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const value = await call<{ workspaces: WorkspaceSummary[] }>('workspaces', {})
  return value.workspaces
}

/**
 * Read one workspace's project.
 * @param workspaceId - the workspace.
 * @returns the project, its storage path, and whether it already existed.
 */
export function loadProject(workspaceId: string): Promise<ProjectSnapshot> {
  return call<ProjectSnapshot>('project', { workspaceId })
}

/**
 * Replace one workspace's project document.
 * @param workspaceId - the workspace.
 * @param project - the whole document as the page holds it.
 * @returns the normalized project the Host persisted.
 */
export function saveProject(workspaceId: string, project: unknown, locale = 'zh'): Promise<ProjectSnapshot> {
  return call<ProjectSnapshot>('save', { workspaceId, project, locale })
}

/**
 * Render one export on the Host.
 * @param workspaceId - the workspace whose SAVED project is exported.
 * @param format - the file format.
 * @param locale - the locale for human-readable labels.
 * @returns the artifact (text, or base64 for XMind).
 */
export async function exportProject(workspaceId: string, format: ExportFormat, locale: string): Promise<ExportArtifact> {
  const value = await call<{ artifact: ExportArtifact }>('export', { workspaceId, format, locale })
  return value.artifact
}

/**
 * Turn a byte string into a Blob for download.
 * @param artifact - the Host-rendered artifact.
 * @returns a Blob with the artifact's MIME type.
 */
export function artifactBlob(artifact: ExportArtifact): Blob {
  if (artifact.base64 !== undefined) {
    const binary = atob(artifact.base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: artifact.mime })
  }
  return new Blob([artifact.text ?? ''], { type: artifact.mime })
}

/**
 * Hand one artifact to the browser as a file download.
 * @param artifact - the Host-rendered artifact.
 */
export function downloadArtifact(artifact: ExportArtifact): void {
  const url = URL.createObjectURL(artifactBlob(artifact))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = artifact.filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next task: revoking synchronously can cancel the download in
  // some browsers before it reads the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}


/** The import route's success payload. */
export interface ImportPreview {
  /** Which importer read the file. */
  format: ImportResult['format']
  /** The cases the file carries. */
  cases: ImportedCase[]
  /** What was dropped or degraded while parsing. */
  warnings: string[]
}

/**
 * Ask the Host to parse one file into cases (nothing is written).
 * @param workspaceId - the project the cases would join.
 * @param file - the file the user picked.
 * @returns the preview.
 */
export async function importPreview(workspaceId: string, file: File): Promise<ImportPreview> {
  const payload: Record<string, unknown> = { workspaceId, filename: file.name }
  // An .xmind is a ZIP: it travels base64 so the JSON route carries it intact.
  if (/\.(xmind|zip)$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    const chunk = 0x8000
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
    }
    payload.base64 = btoa(binary)
  } else {
    payload.text = await file.text()
  }
  const value = await call<{ import: ImportPreview }>('import', payload)
  return value.import
}


/**
 * Read the Host half's build stamp.
 * @returns the stamp, or null when this Host never loaded the plugin.
 */
export async function hostBuild(): Promise<string | null> {
  const value = await call<{ build: string }>('version', {})
  return value.build
}

/** One stored requirement document (stage ①'s input). */
export interface DocumentInput {
  /** The stored file name. */
  name: string
  /** Size in bytes. */
  size: number
  /** Last modification, epoch ms. */
  modifiedAt: number
}

/**
 * List the requirement documents stored for one workspace.
 * @param workspaceId - the workspace.
 * @returns the documents, newest first.
 */
export async function listDocuments(workspaceId: string): Promise<DocumentInput[]> {
  const value = await call<{ documents: DocumentInput[] }>('documents', { workspaceId })
  return value.documents
}

/**
 * Store one requirement document inside the workspace.
 *
 * The file is POSTed as the request body itself (the server takes it verbatim),
 * so a large document never has to be base64-inflated inside JSON.
 * @param workspaceId - the workspace.
 * @param file - the picked or dropped file.
 * @returns the stored name and the refreshed list.
 */
export async function uploadDocument(workspaceId: string, file: File): Promise<{ name: string; documents: DocumentInput[] }> {
  const query = new URLSearchParams({ workspaceId, filename: file.name, isRequest: '1' })
  let response: Response
  try {
    response = await fetch(`${API_PREFIX}/document?${query.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: await file.text(),
    })
  } catch (error) {
    throw new ApiError(`The plugin's Host half is unreachable: ${(error as Error).message}`, 'network')
  }
  const payload: unknown = await response.json().catch(() => null)
  if (payload === null || typeof payload !== 'object') {
    throw new ApiError(`The plugin's Host route answered HTTP ${response.status} without a body.`, 'bad-response')
  }
  const envelope = payload as { ok?: boolean; error?: { message?: string; code?: string }; value?: { name: string; documents: DocumentInput[] } }
  if (envelope.ok !== true || envelope.value === undefined) {
    throw new ApiError(envelope.error?.message ?? `HTTP ${response.status}`, envelope.error?.code ?? 'error')
  }
  return envelope.value
}

/**
 * Remove one stored requirement document.
 * @param workspaceId - the workspace.
 * @param name - the stored file name.
 * @returns the refreshed list.
 */
export async function deleteDocument(workspaceId: string, name: string): Promise<DocumentInput[]> {
  const value = await call<{ documents: DocumentInput[] }>('documentDelete', { workspaceId, filename: name })
  return value.documents
}

/** What a started run reports back. */
export interface RunStart {
  /** The conversation the run was handed to. */
  sessionId: string
  /** Cases the run covers. */
  cases: number
  /** The task the agent received (shown so the user can see exactly what ran). */
  prompt: string
}

/**
 * Hand the current cases to the agent as a real test run.
 * @param workspaceId - the project to run.
 * @param locale - the instruction language.
 * @param sessionId - the conversation the page is showing, when known.
 * @returns the run facts the page displays.
 */
export function startRun(workspaceId: string, locale: string, sessionId?: string): Promise<RunStart> {
  return call<RunStart>('run', { workspaceId, locale, ...(sessionId === undefined ? {} : { sessionId }) })
}

/** Where a workspace's project is stored (mirror of the Host's StorageInfo). */
export interface StorageInfo {
  kind: 'default' | 'custom'
  dir: string
  defaultDir: string
}

/**
 * Choose where this workspace's project lives.
 * @param workspaceId - the workspace.
 * @param dir - an absolute directory, or null to return to the default.
 * @returns the resulting storage facts.
 */
export async function setStorage(workspaceId: string, dir: string | null): Promise<StorageInfo> {
  const value = await call<{ storage: StorageInfo }>('storage', { workspaceId, dir })
  return value.storage
}
