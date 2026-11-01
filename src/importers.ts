/**
 * Turning files a tester already has into workbench cases.
 *
 * Four importers, one output shape:
 *
 * - **XMind** (`.xmind`) — the same map {@link ./export.ts} writes, and the
 *   shape testers actually draw by hand: a sheet whose leaves are cases.
 * - **Markdown** — the review page the export writes (`## 正向用例` buckets and
 *   `### 用例` sections), which is also a plausible hand-written spec.
 * - **CSV** — the spreadsheet export, and anything else with a header row.
 * - **XMind-like JSON** — a bare `content.json`, for a map extracted by hand.
 *
 * All four are dependency-free and browser-safe: the page parses the file it
 * was handed and shows a preview, and the Host renders the same preview for
 * its own importer route. One implementation, so a preview can never differ
 * from what an import would produce.
 *
 * @module dsh-project-autotest/importers
 */
import { findEntry } from './unzip.ts'
import type { CaseKind, CaseTechnique, TestCase } from './wire.ts'

/**
 * A file this plugin cannot read, with a message written for the person who
 * picked it. The Host maps it to a 400, so a wrong file reads as "this file is
 * not usable" rather than as a server fault.
 */
export class ImportError extends Error {
  /** The failing file's name, for the message. */
  readonly filename: string

  /**
   * @param filename - the file that could not be read.
   * @param message - why, in one sentence.
   */
  constructor(filename: string, message: string) {
    super(`${filename}: ${message}`)
    this.name = 'ImportError'
    this.filename = filename
  }
}

/** A case as the importer sees it: the fields a file can carry, all strings. */
export interface ImportedCase {
  title: string
  kind: CaseKind
  technique: CaseTechnique
  preconditions: string
  steps: string[]
  expected: string
  note: string
}

/** The result of parsing one file. */
export interface ImportResult {
  /** Which importer consumed the file. */
  format: 'xmind' | 'markdown' | 'csv' | 'json'
  /** The cases, deduplicated by title and ready to append. */
  cases: ImportedCase[]
  /** Non-fatal notes: a dropped branch, an ignored row (shown to the user). */
  warnings: string[]
}

/** Techniques a case may claim, for the `technique` column and leaf. */
const TECHNIQUE_ALIASES: Record<string, CaseTechnique> = {
  functional: 'functional', 功能: 'functional', 功能测试: 'functional',
  boundary: 'boundary', 边界值: 'boundary', 边界: 'boundary',
  equivalence: 'equivalence', 等价类: 'equivalence',
  negative: 'negative', 异常: 'negative', 逆向: 'negative',
  performance: 'performance', 性能: 'performance',
  security: 'security', 安全: 'security',
}

/** Normalize a free-text technique; unknown text means "functional". */
function techniqueOf(text: string): CaseTechnique {
  const key = text.trim().toLowerCase()
  return TECHNIQUE_ALIASES[key] ?? TECHNIQUE_ALIASES[text.trim()] ?? 'functional'
}

/**
 * Normalize a free-text bucket word into a case kind.
 *
 * Only the exact words count, never a substring: a tester's stage heading can
 * legitimately be "正常流程" ("happy path"), and treating any title that merely
 * contains a bucket word as a bucket would re-type every topic beneath it.
 */
function kindOf(text: string): CaseKind | undefined {
  const key = text.trim().toLowerCase()
  if (key === 'negative' || key === '反向' || key === '负向' || key === '逆向' || key === '异常' || key === '反向用例') return 'negative'
  if (key === 'positive' || key === '正向' || key === '正常' || key === '正向用例' || key === '正常用例') return 'positive'
  return undefined
}

/** Collapse whitespace and trim: map titles and CSV cells arrive noisy. */
function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Split a `Label: value` leaf into its two halves, when it has the shape. */
function labelled(text: string): { label: string; value: string } | null {
  const match = /^([^:：]{1,24})[:：]\s*([\s\S]*)$/.exec(text)
  return match === null ? null : { label: match[1]!.trim(), value: match[2]!.trim() }
}

/** Drop duplicate titles, keeping the first, and count what was dropped. */
function dedupe(cases: ImportedCase[], warnings: string[]): ImportedCase[] {
  const seen = new Set<string>()
  const kept: ImportedCase[] = []
  for (const item of cases) {
    const key = item.title.toLowerCase()
    if (seen.has(key)) {
      warnings.push(`duplicate case skipped: ${item.title}`)
      continue
    }
    seen.add(key)
    kept.push(item)
  }
  return kept
}

/** Build one case with every field present, whatever the source filled in. */
function caseOf(partial: Partial<ImportedCase> & { title: string }): ImportedCase {
  return {
    title: clean(partial.title),
    kind: partial.kind ?? 'positive',
    technique: partial.technique ?? 'functional',
    preconditions: partial.preconditions ?? '',
    steps: (partial.steps ?? []).map((step) => step.trim()).filter((step) => step !== ''),
    expected: partial.expected ?? '',
    note: partial.note ?? '',
  }
}

// ---------------------------------------------------------------------------
// XMind
// ---------------------------------------------------------------------------

/** The subset of an XMind topic this reader understands. */
export interface XmindTopic {
  title?: string
  notes?: { plain?: { content?: string } } | string
  labels?: string[]
  children?: { attached?: XmindTopic[] }
}

/** A topic's plain text, from either JSON or an `.xmind` legacy attribute. */
function topicText(topic: XmindTopic): string {
  if (typeof topic.title === 'string') return topic.title
  return ''
}

/** A topic's note text, whichever of the two shapes it carries. */
function topicNote(topic: XmindTopic): string {
  const notes = topic.notes
  if (typeof notes === 'string') return notes
  return typeof notes?.plain?.content === 'string' ? notes.plain.content : ''
}

/**
 * The label aliases a case leaf may carry, per field.
 *
 * The first list is the export's own vocabulary (`前置条件: …`, `步骤: …`,
 * `预期: …`); the rest is what a tester writes by hand. Matching is on the
 * label PREFIX for the long forms so `前置条件` and `前置` both land.
 */
const LEAF_FIELDS: Record<'preconditions' | 'step' | 'expected' | 'technique' | 'note' | 'result', string[]> = {
  preconditions: ['前置', 'precondition'],
  step: ['步骤', '操作', 'action', 'step'],
  expected: ['预期', 'expected'],
  technique: ['设计方法', '方法', 'technique'],
  note: ['备注', '说明', 'note'],
  result: ['执行', 'result'],
}

/** Which field a leaf label names, when it names one. */
function leafField(label: string): keyof typeof LEAF_FIELDS | undefined {
  const key = label.toLowerCase()
  for (const name of Object.keys(LEAF_FIELDS) as Array<keyof typeof LEAF_FIELDS>) {
    if (LEAF_FIELDS[name].some((alias) => key === alias || key.startsWith(alias))) return name
  }
  return undefined
}

/**
 * Read one case topic: its title is the case, its leaves carry the fields.
 *
 * An unrecognised leaf is appended to the steps, so a hand-drawn "3. 点击登录"
 * never disappears.
 * @param topic - the case topic.
 * @param kind - the bucket the topic sat in.
 * @param warnings - sink for notes about what could not be read.
 * @returns the case.
 */
export function caseFromTopic(topic: XmindTopic, kind: CaseKind, warnings: string[]): ImportedCase {
  const title = clean(topicText(topic))
  const preconditions: string[] = []
  const steps: string[] = []
  const expected: string[] = []
  const notes: string[] = []
  const note = topicNote(topic).trim()
  if (note !== '') notes.push(note)
  const collected = {
    technique: kind === 'negative' ? ('boundary' as CaseTechnique) : ('functional' as CaseTechnique),
  }

  /** File one labelled leaf into its field. */
  const place = (label: string, value: string, raw: string): void => {
    switch (leafField(label)) {
      case 'preconditions':
        preconditions.push(value)
        return
      case 'step':
        steps.push(value)
        return
      case 'expected':
        expected.push(value)
        return
      case 'technique':
        collected.technique = techniqueOf(value)
        return
      case 'note':
        notes.push(value)
        return
      case 'result':
        // The export stamps a case leaf with its last run's verdict. It is
        // re-runnable metadata, not a step: importing it as one would put
        // "执行: 通过" into the script's instructions.
        return
      default:
        steps.push(raw)
    }
  }

  for (const child of topic.children?.attached ?? []) {
    const text = clean(topicText(child))
    if (text === '') continue
    // A nested case (a sub-test) is kept as a step link rather than dropped:
    // half a case is worse than a step mentioning the rest.
    if ((child.children?.attached ?? []).length > 0) {
      warnings.push(`nested topic flattened into a step: ${text}`)
      steps.push(text)
      continue
    }
    const parts = labelled(text)
    if (parts === null) place('', text, text)
    else place(parts.label, parts.value, text)
  }

  if (title === '') warnings.push('a case topic had no title and was skipped')
  return caseOf({
    title,
    kind,
    technique: collected.technique,
    preconditions: preconditions.join('\n'),
    steps,
    expected: expected.join(' | '),
    note: notes.join('\n'),
  })
}

/**
 * Every stage title the export has written, in both languages — the current
 * four and the seven it replaced. Both are containers, never cases: a map
 * exported before the stages were folded still reads correctly.
 */
const STAGE_TITLES = new Set([
  '产品文档 / 技术方案', '设计测试用例', '编写并执行测试脚本', '跟踪测试 bug',
  '分析测试需求', '制订测试计划', '搭建测试环境', '分析测试结果、记录测试问题',
  'product docs / technical design', 'design test cases', 'write and run scripts', 'track test bugs',
  'analyse requirements', 'draw up a test plan', 'build the environment', 'analyse results, log defects',
])

/**
 * Whether a topic's title is one of the exported pipeline stage branches.
 * @param topic - the topic to inspect.
 * @returns true for a stage branch.
 */
function isStageBranch(topic: XmindTopic): boolean {
  return STAGE_TITLES.has(clean(topicText(topic)).toLowerCase())
}

/**
 * Whether a topic's leaves name its own fields (rather than further cases).
 * @param topic - the topic to inspect.
 * @returns true when at least one leaf carries a field label.
 */
function isCaseHead(topic: XmindTopic): boolean {
  return (topic.children?.attached ?? []).some((child) => {
    const parts = labelled(clean(topicText(child)))
    return parts !== null && leafField(parts.label) !== undefined
  })
}

/**
 * Walk one XMind sheet's root topic for cases.
 *
 * Two map shapes arrive here and they differ POSITIONALLY, not by title:
 *
 * - the map this plugin exports — root → seven stage branches → `正向 (n)` /
 *   `反向 (n)` buckets → cases → field leaves. A stage branch is a container,
 *   never a case;
 * - a map a tester drew by hand — root → the thing being tested → cases →
 *   field leaves. The first level below the root is the case list.
 *
 * So a topic directly below the root is a case unless it is a stage branch or
 * a bucket; below that, only leaves under a bucket are cases. A stage branch
 * may also hold a case directly (a hand-drawn map that names its stage), which
 * the between-levels rule covers.
 * @param root - the sheet's root topic.
 * @param warnings - sink for notes about what could not be read.
 * @returns the cases found.
 */
export function casesFromXmindRoot(root: XmindTopic, warnings: string[]): ImportedCase[] {
  const cases: ImportedCase[] = []

  /** Whether a topic's title names a case bucket. */
  const bucketOf = (topic: XmindTopic): CaseKind | undefined => {
    // The export labels a bucket `正向 (3)`; the word survives the count.
    return kindOf(clean(topicText(topic)).replace(/\(\s*\d+\s*\)/g, ''))
  }

  /** File a bucket's children, or its grandchildren when it holds case lists. */
  const fileBucket = (bucket: XmindTopic, kind: CaseKind): void => {
    for (const entry of bucket.children?.attached ?? []) {
      if (clean(topicText(entry)) === '') continue
      const nested = entry.children?.attached ?? []
      // `正向 (2)` → cases directly. A stage → bucket → CASE → leaves shape
      // puts the case one level lower, where its leaves are its fields.
      if (nested.length > 0 && nested.every((child) => (child.children?.attached ?? []).length === 0) && !isCaseHead(entry)) {
        cases.push(caseFromTopic(entry, kind, warnings))
        continue
      }
      if (nested.length > 0 && bucketOf(entry) === undefined && !isStageBranch(entry)) {
        cases.push(caseFromTopic(entry, kind, warnings))
        continue
      }
      for (const child of nested) {
        if (clean(topicText(child)) !== '') cases.push(caseFromTopic(child, kind, warnings))
      }
    }
  }

  const walk = (topic: XmindTopic, inherited: CaseKind | undefined): void => {
    const children = topic.children?.attached ?? []
    const bucket = bucketOf(topic) ?? inherited
    const title = clean(topicText(topic))
    // A bucket's children are its case list.
    if (bucket !== undefined) {
      fileBucket(topic, bucket)
      return
    }
    if (children.length === 0) return
    for (const child of children) {
      if (child.children === undefined || (child.children.attached ?? []).length === 0) continue
      const childBucket = bucketOf(child)
      if (childBucket !== undefined) {
        fileBucket(child, childBucket)
        continue
      }
      if (isStageBranch(child)) {
        // A stage branch: its buckets are below it, or its cases directly.
        for (const grandchild of child.children?.attached ?? []) {
          const kind = bucketOf(grandchild)
          if (kind !== undefined) fileBucket(grandchild, kind)
          else if (clean(topicText(grandchild)) !== '') cases.push(caseFromTopic(grandchild, 'positive', warnings))
        }
        continue
      }
      // A plain first level is the case list: each child is a case.
      if (clean(topicText(child)) !== '') cases.push(caseFromTopic(child, 'positive', warnings))
    }
    void title
  }

  walk(root, undefined)
  return cases
}

/**
 * Parse an XMind map.
 *
 * Accepts the sheet array of a `content.json`, a bare root topic, or an object
 * with either under its usual keys — the three shapes a caller can hold.
 * @param parsed - the parsed JSON.
 * @param warnings - sink for notes about what could not be read.
 * @returns the cases found.
 */
export function casesFromXmindJson(parsed: unknown, warnings: string[]): ImportedCase[] {
  const roots = sheetRoots(parsed)
  if (roots.length === 0) {
    warnings.push('no topic tree found: the file does not look like an XMind content.json')
    return []
  }
  const cases: ImportedCase[] = []
  for (const root of roots) cases.push(...casesFromXmindRoot(root, warnings))
  return cases
}

/**
 * Collect every root topic a parsed document carries.
 * @param parsed - the parsed JSON.
 * @returns the roots, in document order.
 */
function sheetRoots(parsed: unknown): XmindTopic[] {
  if (parsed === null || typeof parsed !== 'object') return []
  if (Array.isArray(parsed)) {
    return parsed
      .map((sheet) => (typeof sheet === 'object' && sheet !== null ? (sheet as { rootTopic?: unknown }).rootTopic : undefined))
      .filter((root): root is XmindTopic => typeof root === 'object' && root !== null)
  }
  const record = parsed as { rootTopic?: unknown; sheets?: unknown[] }
  if (typeof record.rootTopic === 'object' && record.rootTopic !== null) return [record.rootTopic as XmindTopic]
  if (Array.isArray(record.sheets)) return sheetRoots(record.sheets)
  return []
}

/**
 * Read a `.xmind` archive into cases.
 * @param bytes - the archive bytes.
 * @param warnings - sink for notes about what could not be read.
 * @returns the cases, or null when the archive has no readable `content.json`.
 */
export async function casesFromXmind(bytes: Uint8Array, warnings: string[]): Promise<ImportedCase[] | null> {
  const entry = await findEntry(bytes, 'content.json')
  if (entry === null) {
    warnings.push('the archive has no content.json: not an XMind 8+ workbook?')
    return null
  }
  const text = new TextDecoder('utf-8').decode(entry.data)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    warnings.push(`content.json is not valid JSON: ${(error as Error).message}`)
    return null
  }
  return casesFromXmindJson(parsed, warnings)
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/** Headings that structure a review page but never introduce a case. */
const NON_CASE_HEADINGS = new Set(['流程状态', 'pipeline status', '用例概览', 'overview', 'metrics'])

/**
 * Read a Markdown case page.
 *
 * The export's own shape is the grammar: `##` buckets, `###` cases, then a
 * bullet list of `前置条件` / numbered steps / `预期` / `设计方法` / `备注`.
 * A heading level other than `###` still works — any heading deeper than the
 * bucket heading starts a case — so a hand-written spec with `##` cases under
 * `#` sections imports too.
 * @param text - the Markdown.
 * @param warnings - sink for notes about what could not be read.
 * @returns the cases found.
 */
export function casesFromMarkdown(text: string, warnings: string[]): ImportedCase[] {
  const lines = text.split(/\r?\n/)
  const cases: ImportedCase[] = []
  let kind: CaseKind = 'positive'
  let current: { title: string; kind: CaseKind; body: string[] } | null = null

  const flush = (): void => {
    if (current === null) return
    cases.push(caseFromMarkdownBlock(current.title, current.kind, current.body, warnings))
    current = null
  }

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (heading !== null) {
      const level = heading[1]!.length
      const title = clean(heading[2]!.replace(/\*\*/g, ''))
      const named = kindOf(title.replace(/\(\s*\d+\s*\)/g, ''))
      if (named !== undefined) {
        // A bucket heading: everything after it belongs to that bucket.
        flush()
        kind = named
        continue
      }
      if (level >= 2) {
        flush()
        // The export's pipeline-status summary is a list, not a case block.
        if (NON_CASE_HEADINGS.has(title.toLowerCase())) continue
        current = { title, kind, body: [] }
      }
      // A level-1 heading is the document title, not a case.
      continue
    }
    if (current !== null && line.trim() !== '') current.body.push(line)
  }
  flush()
  return cases
}

/** Read one case block's bullet list into case fields. */
function caseFromMarkdownBlock(title: string, kind: CaseKind, body: string[], warnings: string[]): ImportedCase {
  const preconditions: string[] = []
  const steps: string[] = []
  const expected: string[] = []
  const notes: string[] = []
  let technique: CaseTechnique = kind === 'negative' ? 'boundary' : 'functional'
  for (const raw of body) {
    const line = raw.trim()
    if (line.startsWith('#')) continue
    const bullet = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (bullet === null) {
      // A bare paragraph is an expected-result note when no steps exist yet.
      if (steps.length > 0) expected.push(clean(line))
      else notes.push(clean(line))
      continue
    }
    const item = clean(bullet[1]!.replace(/\*\*/g, ''))
    if (item === '') continue
    const parts = labelled(item)
    const label = (parts?.label ?? '').toLowerCase()
    const value = parts?.value ?? item
    const numberedStep = /^\d+[.)]\s+/.exec(bullet[1]!.trim())
    if (numberedStep !== null && parts === null) steps.push(clean(bullet[1]!.replace(/^\d+[.)]\s+/, '')))
    else if (label.startsWith('前置') || label === 'preconditions') preconditions.push(value)
    else if (label.startsWith('步骤') || label.startsWith('操作') || label === 'steps' || label === 'step') steps.push(value)
    else if (label.startsWith('预期') || label === 'expected') expected.push(value)
    else if (label.startsWith('设计方法') || label === 'technique') technique = techniqueOf(value)
    else if (label.startsWith('备注') || label === 'note') notes.push(value)
    else if (label.startsWith('执行') || label === 'result') notes.push(`${parts!.label}: ${value}`)
    else {
      warnings.push(`unrecognised bullet in "${title}" kept as a step: ${item}`)
      steps.push(item)
    }
  }
  return caseOf({ title, kind, technique, preconditions: preconditions.join('\n'), steps, expected: expected.join(' | '), note: notes.join('\n') })
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Split CSV text into rows, honouring quotes, escaped quotes, embedded
 * newlines and an optional BOM (the export writes one for Excel).
 * @param text - the CSV text.
 * @returns the rows, each an array of cells.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  for (let at = 0; at < source.length; at += 1) {
    const char = source[at]!
    if (quoted) {
      if (char === '"') {
        if (source[at + 1] === '"') {
          cell += '"'
          at += 1
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[at + 1] === '\n') at += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

/**
 * Read a CSV table into cases.
 *
 * The header row names the columns (`title`/`用例标题`, `steps`, `expected`,
 * `case_kind` …); a table whose header cannot be read at all falls back to
 * "first column is the title", which is the one column every sheet has.
 * @param text - the CSV text.
 * @param warnings - sink for notes about what could not be read.
 * @returns the cases found.
 */
export function casesFromCsv(text: string, warnings: string[]): ImportedCase[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const header = rows[0]!.map((cell) => clean(cell).toLowerCase())
  /** Index of the first header matching any of the aliases. */
  const index = (...aliases: string[]): number => header.findIndex((name) => aliases.some((alias) => name === alias || name.includes(alias)))
  const columns = {
    title: index('title', 'name', '用例标题', '用例名称', '标题'),
    kind: index('case_kind', 'kind', 'bucket', 'type', '类型', '正反向'),
    technique: index('technique', 'method', '设计方法'),
    preconditions: index('preconditions', 'precondition', '前置条件', '前置'),
    steps: index('steps', 'step', 'actions', '操作步骤', '步骤'),
    expected: index('expected', 'expectedresult', '预期结果', '预期'),
    note: index('note', 'remark', '备注', '说明'),
  }
  const body = columns.title >= 0 ? rows.slice(1) : rows
  const titleColumn = columns.title >= 0 ? columns.title : 0
  if (columns.title < 0) warnings.push('no recognisable header: the first column was read as the case title')
  const cases: ImportedCase[] = []
  for (const row of body) {
    const title = clean(row[titleColumn] ?? '')
    if (title === '') continue
    const cell = (column: number): string => (column < 0 ? '' : (row[column] ?? '').trim())
    // The export writes steps as `1. a\n2. b` inside one quoted cell.
    const steps = cell(columns.steps)
      .split(/\r?\n|;\s*|\|\s*/)
      .map((step) => step.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter((step) => step !== '')
    cases.push(caseOf({
      title,
      kind: kindOf(cell(columns.kind)) ?? 'positive',
      technique: techniqueOf(cell(columns.technique)) ?? 'functional',
      preconditions: cell(columns.preconditions),
      steps,
      expected: cell(columns.expected),
      note: cell(columns.note),
    }))
  }
  return cases
}

// ---------------------------------------------------------------------------
// One entry point
// ---------------------------------------------------------------------------

/**
 * Pick an importer by file name, then by content.
 *
 * The name decides when it carries a known extension; otherwise the bytes are
 * sniffed (ZIP magic, a leading `#{`, a header row), so a pasted or renamed
 * file still imports. The sniffing order matters: a ZIP is checked first
 * because a `.xmind` is binary and nothing else here is.
 * @param options - the file name, the text (when it is text), and the bytes (when it is binary or base64).
 * @returns the parsed result.
 * @throws when no importer accepts the file, with a message fit for the user.
 */
export async function importCases(options: {
  filename: string
  text?: string
  bytes?: Uint8Array
}): Promise<ImportResult> {
  const warnings: string[] = []
  const lower = options.filename.toLowerCase()
  const bytes = options.bytes
  const isZip = bytes !== undefined && bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4B

  if (isZip || lower.endsWith('.xmind')) {
    if (bytes === undefined) throw new ImportError(options.filename, 'an .xmind file must be uploaded as bytes')
    const cases = await casesFromXmind(bytes, warnings)
    if (cases === null) throw new ImportError(options.filename, warnings.at(-1) ?? 'the archive could not be read')
    return { format: 'xmind', cases: dedupe(cases, warnings), warnings }
  }

  const text = options.text ?? (bytes === undefined ? '' : new TextDecoder('utf-8').decode(bytes))
  if (lower.endsWith('.json') || /^\s*[[{]/.test(text)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      throw new ImportError(options.filename, `not valid JSON: ${(error as Error).message}`)
    }
    const cases = casesFromXmindJson(parsed, warnings)
    if (cases.length === 0 && warnings.some((warning) => warning.startsWith('no topic tree'))) {
      throw new ImportError(options.filename, 'the JSON carries no XMind topic tree')
    }
    return { format: 'json', cases: dedupe(cases, warnings), warnings }
  }
  if (lower.endsWith('.csv') || (text.includes(',') && /\r?\n/.test(text) && !/^\s*#/.test(text))) {
    return { format: 'csv', cases: dedupe(casesFromCsv(text, warnings), warnings), warnings }
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || /^\s*#/.test(text)) {
    return { format: 'markdown', cases: dedupe(casesFromMarkdown(text, warnings), warnings), warnings }
  }
  throw new ImportError(options.filename, 'unsupported file: drop an .xmind, .md, .csv or XMind content.json')
}

/** A ready-to-append case with a fresh id, from an imported one. */
export function toTestCase(imported: ImportedCase, id: string): TestCase {
  return {
    id,
    title: imported.title,
    kind: imported.kind,
    technique: imported.technique,
    preconditions: imported.preconditions,
    steps: imported.steps.length > 0 ? imported.steps : [''],
    expected: imported.expected,
    result: 'untested',
    failReason: 'none',
    selfCheck: { passOnGood: false, failOnBad: false },
    note: imported.note,
  }
}
