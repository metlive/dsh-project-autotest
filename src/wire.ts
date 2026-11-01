/**
 * The plugin's wire vocabulary: the route prefix, the persisted project model,
 * and the export formats. Shared by the Host handlers (which validate and
 * render it) and the Client page (which edits and displays it), so both halves
 * cannot disagree about a field name or a status enum.
 *
 * Browser-safe on purpose: no `node:` imports, so the client bundle may inline
 * this module.
 *
 * @module dsh-project-autotest/wire
 */

/** Route path prefix; the API method is the final segment. */
export const API_PREFIX = '/project-autotest/api'

/** The sidebar row id, which is also the `main` panel's key. */
export const PANEL_ID = 'automation-flow'

/**
 * The pipeline stages, in order. The array IS the canonical order.
 *
 * Four stages, matching how the work actually divides:
 *
 * - ① `requirement` — the input: product docs and the technical design.
 * - ② `cases`       — the human craft: turning them into test cases.
 * - ③ `execution`   — the model's job: write and run the scripts, report back.
 * - ④ `bugs`        — the loop: triage, fix, regress, close.
 *
 * Two stages the seven-step textbook still lists are deliberately gone:
 * 「搭建测试环境」 is not a tester's deliverable when execution is automated,
 * and 「制订测试计划」 was a document nobody re-read once the cases existed.
 * A saved project written against the old seven stages is migrated on load
 * (see {@link migrateStages}), so no case or defect is lost.
 */
export const STEP_IDS = ['requirement', 'cases', 'execution', 'bugs'] as const

/** One pipeline stage id. */
export type StepId = (typeof STEP_IDS)[number]

/** How far a stage has progressed. */
export type StepStatus = 'todo' | 'doing' | 'done'

/** Positive cases implement first; negative cases are the filtered remainder. */
export type CaseKind = 'positive' | 'negative'

/** Case design technique, the reason a negative case exists. */
export type CaseTechnique = 'functional' | 'boundary' | 'equivalence' | 'negative' | 'performance' | 'security'

/** A case's own verdict after a run. */
export type CaseResult = 'untested' | 'passed' | 'failed' | 'blocked'

/** A defect's lifecycle (the seventh stage's state machine). */
export type DefectStatus = 'open' | 'in-progress' | 'resolved' | 'regressing' | 'closed'

/** The automation granularity step ① commits to. */
export type AutomationLevel = 'api' | 'ui' | 'both'

/**
 * Who a failing case blames — step ⑥'s triage.
 *
 * Only `product` may become a defect: a script or environment failure is the
 * tester's own to fix, and filing it as a bug is exactly the trap the flow
 * warns about.
 */
export type FailReason = 'none' | 'product' | 'script' | 'environment'

/** The regression verdict of a defect fix — step ⑦. */
export type RegressionResult = 'pending' | 'passed' | 'failed'

/** One automation coverage index over one project. */
export interface StepProgress {
  /** Todo / doing / done. */
  status: StepStatus
  /** Free-form note the tester keeps on this stage. */
  note: string
  /** Last time this stage's status changed, epoch ms; 0 when never touched. */
  updatedAt: number
}

/** One test case. */
export interface TestCase {
  /** Stable id: `c-<timestamp>-<rand>`; unique within its project. */
  id: string
  /** Human title, required for a usable export. */
  title: string
  /** Positive implements first; negative is analysis-filtered. */
  kind: CaseKind
  /** The design technique the case came from. */
  technique: CaseTechnique
  /** Preconditions the automation must arrange. */
  preconditions: string
  /** Ordered steps. */
  steps: string[]
  /** The expected outcome; the assertion the script must make. */
  expected: string
  /** Last execution verdict. */
  result: CaseResult
  /** Who the last failure blames; only `product` may open a defect. */
  failReason: FailReason
  /**
   * Script self-check — step ⑤'s guard.
   *
   * A script is only trustworthy once it PASSES on a good build and FAILS on a
   * build with the defect; without both ticks a red run proves nothing.
   */
  selfCheck: {
    /** The script passes on the correct build. */
    passOnGood: boolean
    /** The script fails on the build carrying the defect. */
    failOnBad: boolean
  }
  /** Optional free-form note (a script path, a defect link). */
  note: string
}

/** One submitted defect — stage seven. */
export interface Defect {
  /** Stable id. */
  id: string
  /** One-line description. */
  title: string
  /** Lifecycle state. */
  status: DefectStatus
  /** The case that found it, when known. */
  caseId: string
  /** Where the fix stands / what the customer agreed. */
  note: string
  /** Whether regression after the fix passed. */
  regression: RegressionResult
  /** The fix departs from the original requirement, so the script was updated. */
  requirementChanged: boolean
  /** Creation time, epoch ms. */
  createdAt: number
}

/** One project's whole test setup — the unit persisted per workspace. */
export interface ProjectState {
  /** Schema version of this document; bumped when the model changes shape. */
  version: 1
  /** The workspace id this project belongs to (also the storage key). */
  workspaceId: string
  /** Display title, normally the registry title. */
  title: string
  /** Absolute workspace path, for display and exports. */
  path: string
  /** The coverage target the analysis stage committed to, in percent. */
  coverageTarget: number
  /** The automation granularity: API-only, UI-only, or both. */
  automationLevel: AutomationLevel
  /** The seven stage records, keyed by step id. */
  steps: Record<StepId, StepProgress>
  /** Every test case, in creation order. */
  cases: TestCase[]
  /** Every defect, in creation order. */
  defects: Defect[]
  /** Creation time, epoch ms. */
  createdAt: number
  /** Last mutation time, epoch ms. */
  updatedAt: number
}

/** The snapshot the page renders: the project plus its storage facts. */
export interface ProjectSnapshot {
  /** The project. A fresh one is created on first read, never persisted empty. */
  project: ProjectState
  /** Absolute directory of the persisted JSON, for display. */
  storagePath: string
  /** Whether the project existed on disk before this read. */
  existed: boolean
}

/** One workspace entry the page's picker lists. */
export interface WorkspaceSummary {
  workspaceId: string
  title: string
  path: string
  /** Whether this workspace already has a project document. */
  hasProject: boolean
  /** Cases in that project, for the picker's badge. */
  caseCount: number
}

/** Export formats the Host renders. */
export type ExportFormat = 'xmind' | 'testlink-xml' | 'csv' | 'markdown'

/** One exported artifact. */
export interface ExportArtifact {
  /** Suggested file name. */
  filename: string
  /** MIME type, used for the Blob download. */
  mime: string
  /** The file's text. XMind is a ZIP, so it is base64 in {@link ExportArtifact.base64}. */
  text?: string
  /** Base64 body for binary formats. */
  base64?: string
}

/** A success envelope. */
export interface OkResult<T> {
  ok: true
  value: T
}

/** A failure envelope; `message` is written for the user. */
export interface ErrResult {
  ok: false
  error: { code: string; message: string }
}

/** Every route's envelope. */
export type Envelope<T> = OkResult<T> | ErrResult

/** Make a fresh project for one workspace. */
export function createProject(workspaceId: string, title: string, path: string, now = Date.now()): ProjectState {
  const steps = {} as Record<StepId, StepProgress>
  for (const id of STEP_IDS) steps[id] = { status: 'todo', note: '', updatedAt: 0 }
  return {
    version: 1,
    workspaceId,
    title,
    path,
    coverageTarget: 80,
    automationLevel: 'api',
    steps,
    cases: [],
    defects: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * The old seven-stage ids and where each one's record now lives.
 *
 * Kept as data (not code paths) so {@link migrateStages} can fold a legacy
 * document: a done environment or plan still proves the work happened, so it
 * becomes a note on the stage that now owns it instead of vanishing.
 */
const LEGACY_STAGE_MAP: Record<string, StepId> = {
  analyse: 'requirement',
  plan: 'requirement',
  cases: 'cases',
  environment: 'execution',
  scripts: 'execution',
  results: 'execution',
  bugs: 'bugs',
}

/**
 * Fold a project document written against any earlier stage set into the
 * current one.
 *
 * A record whose id is current is kept as-is; a legacy id is mapped through
 * {@link LEGACY_STAGE_MAP}. When several legacy records fold into one stage,
 * the furthest-progressed status wins and their notes are joined, so a plan
 * note and an analysis note both survive on the requirement stage.
 * @param rawSteps - the `steps` object as it was stored (any shape).
 * @returns a complete record for every current stage.
 */
export function migrateStages(rawSteps: unknown): Record<StepId, StepProgress> {
  const migrated = {} as Record<StepId, StepProgress>
  for (const id of STEP_IDS) migrated[id] = { status: 'todo', note: '', updatedAt: 0 }
  if (rawSteps === null || typeof rawSteps !== 'object') return migrated
  const rank: Record<StepStatus, number> = { todo: 0, doing: 1, done: 2 }
  for (const [legacyId, value] of Object.entries(rawSteps as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue
    const target = (STEP_IDS as readonly string[]).includes(legacyId)
      ? (legacyId as StepId)
      : LEGACY_STAGE_MAP[legacyId]
    if (target === undefined) continue
    const record = value as Partial<StepProgress>
    const current = migrated[target]
    const status = record.status === 'todo' || record.status === 'doing' || record.status === 'done' ? record.status : 'todo'
    if (rank[status] > rank[current.status]) current.status = status
    if (typeof record.note === 'string' && record.note.trim() !== '') {
      current.note = current.note === '' ? record.note : `${current.note}\n${record.note}`
    }
    if (typeof record.updatedAt === 'number') current.updatedAt = Math.max(current.updatedAt, record.updatedAt)
    // A legacy stage that only mapped away leaves no trace under its old id.
  }
  return migrated
}

/** A stable id for a new case or defect. */
export function makeId(prefix: string, now = Date.now()): string {
  return `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** The case buckets every consumer agrees on: positive first, then filtered negative. */
export function splitCases(cases: readonly TestCase[]): { positive: TestCase[]; negative: TestCase[] } {
  const positive: TestCase[] = []
  const negative: TestCase[] = []
  for (const item of cases) (item.kind === 'negative' ? negative : positive).push(item)
  return { positive, negative }
}

/**
 * Coerce one untrusted project document into a valid {@link ProjectState}.
 *
 * The page sends whole documents, so every field is re-validated here rather
 * than trusted: a missing stage record is filled, an unknown enum falls back to
 * its default, and malformed entries are dropped instead of failing the save.
 * @param raw - the parsed JSON from the page or disk.
 * @param workspaceId - the workspace this document belongs to.
 * @returns a structurally valid project.
 */
export function normalizeProject(raw: unknown, workspaceId: string): ProjectState {
  const base = createProject(workspaceId, '', '', Date.now())
  if (raw === null || typeof raw !== 'object') return base
  const source = raw as Partial<ProjectState>
  const project = base
  if (typeof source.title === 'string') project.title = source.title
  if (typeof source.path === 'string') project.path = source.path
  if (typeof source.coverageTarget === 'number' && Number.isFinite(source.coverageTarget)) {
    project.coverageTarget = Math.max(0, Math.min(100, Math.round(source.coverageTarget)))
  }
  if (source.automationLevel === 'api' || source.automationLevel === 'ui' || source.automationLevel === 'both') {
    project.automationLevel = source.automationLevel
  }
  if (typeof source.createdAt === 'number') project.createdAt = source.createdAt
  if (typeof source.updatedAt === 'number') project.updatedAt = source.updatedAt

  // Any stage set ever saved folds into the current four (see migrateStages).
  project.steps = migrateStages(source.steps)

  const kinds: CaseKind[] = ['positive', 'negative']
  const failReasons: FailReason[] = ['none', 'product', 'script', 'environment']
  const regressions: RegressionResult[] = ['pending', 'passed', 'failed']
  const techniques: CaseTechnique[] = ['functional', 'boundary', 'equivalence', 'negative', 'performance', 'security']
  const results: CaseResult[] = ['untested', 'passed', 'failed', 'blocked']
  if (Array.isArray(source.cases)) {
    for (const entry of source.cases) {
      if (entry === null || typeof entry !== 'object') continue
      const item = entry as Partial<TestCase>
      if (typeof item.title !== 'string' || item.title.trim() === '') continue
      project.cases.push({
        id: typeof item.id === 'string' && item.id !== '' ? item.id : makeId('c'),
        title: item.title.trim(),
        kind: kinds.includes(item.kind as CaseKind) ? (item.kind as CaseKind) : 'positive',
        technique: techniques.includes(item.technique as CaseTechnique) ? (item.technique as CaseTechnique) : 'functional',
        preconditions: typeof item.preconditions === 'string' ? item.preconditions : '',
        steps: Array.isArray(item.steps) ? item.steps.filter((step): step is string => typeof step === 'string') : [],
        expected: typeof item.expected === 'string' ? item.expected : '',
        result: results.includes(item.result as CaseResult) ? (item.result as CaseResult) : 'untested',
        failReason: failReasons.includes(item.failReason as FailReason) ? (item.failReason as FailReason) : 'none',
        selfCheck: {
          passOnGood: item.selfCheck?.passOnGood === true,
          failOnBad: item.selfCheck?.failOnBad === true,
        },
        note: typeof item.note === 'string' ? item.note : '',
      })
    }
  }

  const statuses: DefectStatus[] = ['open', 'in-progress', 'resolved', 'regressing', 'closed']
  if (Array.isArray(source.defects)) {
    for (const entry of source.defects) {
      if (entry === null || typeof entry !== 'object') continue
      const item = entry as Partial<Defect>
      if (typeof item.title !== 'string' || item.title.trim() === '') continue
      project.defects.push({
        id: typeof item.id === 'string' && item.id !== '' ? item.id : makeId('d'),
        title: item.title.trim(),
        status: statuses.includes(item.status as DefectStatus) ? (item.status as DefectStatus) : 'open',
        caseId: typeof item.caseId === 'string' ? item.caseId : '',
        note: typeof item.note === 'string' ? item.note : '',
        regression: regressions.includes(item.regression as RegressionResult) ? (item.regression as RegressionResult) : 'pending',
        requirementChanged: item.requirementChanged === true,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      })
    }
  }
  return project
}

/** A one-line summary of where a project stands, used by the picker and header. */
export function projectProgress(project: ProjectState): { done: number; total: number; percent: number } {
  const total = STEP_IDS.length
  let done = 0
  for (const id of STEP_IDS) {
    if (project.steps[id].status === 'done') done += 1
  }
  return { done, total, percent: Math.round((done / total) * 100) }
}
