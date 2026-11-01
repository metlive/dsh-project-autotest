/**
 * The four export formats: XMind mind map, TestLink XML, spreadsheet CSV, and
 * a review Markdown page.
 *
 * Each renderer takes the SAME project and returns one artifact, so the formats
 * cannot drift: the XMind map, the TestLink suite and the CSV all bucket cases
 * by stage → positive/negative → case, with the same leaves beneath the case.
 *
 * These are pure functions of the project (no clock, no filesystem), which is
 * what makes them testable byte for byte.
 *
 * @module dsh-project-autotest/export
 */
import {
  splitCases,
  STEP_IDS,
  type ExportArtifact,
  type ExportFormat,
  type ProjectState,
  type StepId,
  type TestCase,
} from './wire.ts'
import { buildZip, toBase64 } from './zip.ts'

/** Stage titles per locale, so an export reads in the user's language. */
const STEP_TITLES: Record<'zh' | 'en', Record<StepId, string>> = {
  zh: {
    requirement: '产品文档 / 技术方案',
    cases: '设计测试用例',
    execution: '编写并执行测试脚本',
    bugs: '跟踪测试 Bug',
  },
  en: {
    requirement: 'Product docs / technical design',
    cases: 'Design test cases',
    execution: 'Write and run scripts',
    bugs: 'Track bugs',
  },
}

/** Case-technique labels per locale. */
const TECHNIQUE_TITLES: Record<'zh' | 'en', Record<string, string>> = {
  zh: { functional: '功能', boundary: '边界值', equivalence: '等价类', negative: '异常', performance: '性能', security: '安全' },
  en: { functional: 'Functional', boundary: 'Boundary', equivalence: 'Equivalence', negative: 'Negative', performance: 'Performance', security: 'Security' },
}

/** Status labels per locale. */
const STATUS_TITLES: Record<'zh' | 'en', Record<string, string>> = {
  zh: { todo: '未开始', doing: '进行中', done: '已完成', untested: '未执行', passed: '通过', failed: '失败', blocked: '阻塞', open: '待处理', 'in-progress': '处理中', resolved: '已解决', regressing: '回归中', closed: '已关闭', positive: '正向', negative: '反向' },
  en: { todo: 'To do', doing: 'In progress', done: 'Done', untested: 'Untested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked', open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved', regressing: 'Regressing', closed: 'Closed', positive: 'Positive', negative: 'Negative' },
}

/** Pick the language the export is written in from a locale id. */
function language(localeId: string): 'zh' | 'en' {
  return localeId.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** XML-escape a value for text content or an attribute. */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** A URL-safe file-name stem from the project title. */
function stem(project: ProjectState): string {
  const title = project.title.trim() === '' ? project.workspaceId : project.title.trim()
  return title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'test-project'
}

/** XMind topic ids must be unique; a counter keeps them stable and readable. */
function makeTopicIds(): () => string {
  let next = 0
  return () => `t${(next += 1)}`
}

/** One XMind topic node. */
interface TopicShape {
  title: string
  note?: string
  labels?: string[]
  marked?: 'done' | 'cross' | 'question'
  children?: TopicShape[]
}

/** Convert a `TopicShape` tree to XMind's JSON topic form. */
function toXmindTopic(topic: TopicShape, ids: () => string): Record<string, unknown> {
  const node: Record<string, unknown> = {
    id: ids(),
    title: topic.title,
    structureClass: 'org.xmind.ui.logic.right',
  }
  if (topic.note !== undefined && topic.note !== '') node.notes = { plain: { content: topic.note } }
  if (topic.labels !== undefined && topic.labels.length > 0) node.labels = topic.labels
  if (topic.marked !== undefined) node.markers = [{ markerId: `priority-${topic.marked === 'done' ? 1 : topic.marked === 'cross' ? 5 : 3}` }]
  if (topic.children !== undefined && topic.children.length > 0) {
    node.children = { attached: topic.children.map((child) => toXmindTopic(child, ids)) }
  }
  return node
}

/** The leaves every case carries, shared by XMind and the tree-shaped formats. */
function caseLeaves(item: TestCase, lang: 'zh' | 'en'): TopicShape[] {
  const t = TECHNIQUE_TITLES[lang]
  const leaves: TopicShape[] = []
  if (item.preconditions.trim() !== '') leaves.push({ title: `${lang === 'zh' ? '前置条件' : 'Preconditions'}: ${item.preconditions}` })
  for (const step of item.steps) leaves.push({ title: lang === 'zh' ? `步骤: ${step}` : `Step: ${step}` })
  if (item.expected.trim() !== '') leaves.push({ title: `${lang === 'zh' ? '预期' : 'Expected'}: ${item.expected}` })
  leaves.push({ title: `${lang === 'zh' ? '设计方法' : 'Technique'}: ${t[item.technique] ?? item.technique}` })
  leaves.push({ title: `${lang === 'zh' ? '执行' : 'Result'}: ${STATUS_TITLES[lang][item.result] ?? item.result}` })
  if (item.note.trim() !== '') leaves.push({ title: `${lang === 'zh' ? '备注' : 'Note'}: ${item.note}` })
  return leaves
}

/** Render the XMind `content.json` document for one project. */
export function renderXmindContent(project: ProjectState, localeId: string): string {
  const lang = language(localeId)
  const titles = STEP_TITLES[lang]
  const ids = makeTopicIds()
  const buckets = splitCases(project.cases)

  const root: TopicShape = {
    title: `${project.title} ${lang === 'zh' ? '测试用例' : 'test cases'}`,
    note: `${lang === 'zh' ? '工作区' : 'Workspace'}: ${project.path}\n${lang === 'zh' ? '覆盖率目标' : 'Coverage target'}: ${project.coverageTarget}%\n${lang === 'zh' ? '用例总数' : 'Cases'}: ${project.cases.length}`,
    children: [],
  }

  // Every stage is a branch, so the map mirrors the seven-step pipeline even
  // when a stage has no cases yet (an empty branch is information here).
  for (const id of STEP_IDS) {
    const stage = project.steps[id]
    const branch: TopicShape = {
      title: titles[id],
      labels: [STATUS_TITLES[lang][stage.status] ?? stage.status],
      children: [],
    }
    if (stage.note.trim() !== '') branch.note = stage.note
    if (id === 'cases') {
      const kinds: Array<'positive' | 'negative'> = ['positive', 'negative']
      for (const kind of kinds) {
        const items = kind === 'positive' ? buckets.positive : buckets.negative
        const kindBranch: TopicShape = {
          title: `${STATUS_TITLES[lang][kind] ?? kind} (${items.length})`,
          children: items.map((item) => ({
            title: item.title,
            labels: [STATUS_TITLES[lang][item.result] ?? item.result],
            children: caseLeaves(item, lang),
          })),
        }
        branch.children?.push(kindBranch)
      }
    }
    root.children?.push(branch)
  }

  const document = [
    {
      id: ids(),
      class: 'sheet',
      title: lang === 'zh' ? '测试用例' : 'Test cases',
      rootTopic: toXmindTopic(root, ids),
    },
  ]
  return JSON.stringify(document, null, 2)
}

/** Render the `.xmind` archive (a ZIP with `content.json` and `metadata.json`). */
export function renderXmind(project: ProjectState, localeId: string): ExportArtifact {
  const encoder = new TextEncoder()
  const content = renderXmindContent(project, localeId)
  const metadata = JSON.stringify({ creator: { name: 'dsh-project-autotest' }, activeSheetId: 'sheet-1' })
  const archive = buildZip([
    { name: 'content.json', data: encoder.encode(content) },
    { name: 'metadata.json', data: encoder.encode(metadata) },
  ])
  return {
    filename: `${stem(project)}-xmind.xmind`,
    mime: 'application/vnd.xmind.workbook',
    base64: toBase64(archive),
  }
}

/**
 * Render TestLink's import XML.
 *
 * The shape TestLink's "import test cases" expects: `<testsuite>` → `<testcase>`
 * with `<steps><step><step_number/><actions/><expectedresults/></step></steps>`.
 * Stage and kind ride as `<custom_fields>` so the suite keeps its pipeline
 * structure after import.
 */
export function renderTestLink(project: ProjectState): ExportArtifact {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<testsuite name="${xml(project.title)}">`)
  lines.push(`  <details><![CDATA[Workspace: ${project.path}\nCoverage target: ${project.coverageTarget}%]]></details>`)
  for (const item of project.cases) {
    lines.push('  <testcase name="' + xml(item.title) + '">')
    lines.push(`    <summary><![CDATA[${item.preconditions}]]></summary>`)
    lines.push('    <custom_fields>')
    lines.push(`      <custom_field><name>stage</name><value>${xml('cases')}</value></custom_field>`)
    lines.push(`      <custom_field><name>case_kind</name><value>${xml(item.kind)}</value></custom_field>`)
    lines.push(`      <custom_field><name>technique</name><value>${xml(item.technique)}</value></custom_field>`)
    lines.push('    </custom_fields>')
    lines.push('    <steps>')
    const steps = item.steps.length > 0 ? item.steps : ['']
    steps.forEach((step, index) => {
      lines.push('      <step>')
      lines.push(`        <step_number>${index + 1}</step_number>`)
      lines.push(`        <actions><![CDATA[${step}]]></actions>`)
      lines.push(`        <expectedresults><![CDATA[${index === steps.length - 1 ? item.expected : ''}]]></expectedresults>`)
      lines.push('      </step>')
    })
    lines.push('    </steps>')
    lines.push('  </testcase>')
  }
  lines.push('</testsuite>')
  return {
    filename: `${stem(project)}-testlink.xml`,
    mime: 'application/xml',
    text: lines.join('\n'),
  }
}

/** Quote one CSV cell: RFC 4180, always quoted (safe for any content). */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** Render a spreadsheet-friendly CSV: one row per case, one column per field. */
export function renderCsv(project: ProjectState): ExportArtifact {
  const header = ['case_id', 'stage', 'case_kind', 'technique', 'title', 'preconditions', 'steps', 'expected', 'result', 'note']
  const rows = project.cases.map((item) => [
    item.id,
    'cases',
    item.kind,
    item.technique,
    item.title,
    item.preconditions,
    item.steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    item.expected,
    item.result,
    item.note,
  ])
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  return { filename: `${stem(project)}-cases.csv`, mime: 'text/csv', text: `\uFEFF${csv}` }
}

/** Render a review Markdown page: the plan, the counts, and every case. */
export function renderMarkdown(project: ProjectState, localeId: string): ExportArtifact {
  const lang = language(localeId)
  const t = STEP_TITLES[lang]
  const buckets = splitCases(project.cases)
  const lines: string[] = []
  lines.push(`# ${project.title} — ${lang === 'zh' ? '自动化测试用例' : 'Automated test cases'}`)
  lines.push('')
  lines.push(`- ${lang === 'zh' ? '工作区' : 'Workspace'}: \`${project.path}\``)
  lines.push(`- ${lang === 'zh' ? '覆盖率目标' : 'Coverage target'}: ${project.coverageTarget}%`)
  lines.push(`- ${lang === 'zh' ? '用例' : 'Cases'}: ${project.cases.length} (${lang === 'zh' ? '正向' : 'positive'} ${buckets.positive.length} / ${lang === 'zh' ? '反向' : 'negative'} ${buckets.negative.length})`)
  lines.push('')
  lines.push(`## ${lang === 'zh' ? '流程状态' : 'Pipeline status'}`)
  lines.push('')
  for (const id of STEP_IDS) {
    const stage = project.steps[id]
    lines.push(`- [${stage.status === 'done' ? 'x' : ' '}] **${t[id]}** — ${STATUS_TITLES[lang][stage.status] ?? stage.status}${stage.note.trim() === '' ? '' : `: ${stage.note}`}`)
  }
  for (const [kind, items, label] of [
    ['positive', buckets.positive, lang === 'zh' ? '正向用例（优先实现）' : 'Positive cases (implement first)'],
    ['negative', buckets.negative, lang === 'zh' ? '反向用例（分析筛选）' : 'Negative cases (filtered by analysis)'],
  ] as const) {
    lines.push('')
    lines.push(`## ${label} (${items.length})`)
    for (const item of items) {
      lines.push('')
      lines.push(`### ${item.title}`)
      lines.push('')
      if (item.preconditions.trim() !== '') lines.push(`- **${lang === 'zh' ? '前置条件' : 'Preconditions'}**: ${item.preconditions}`)
      item.steps.forEach((step, index) => lines.push(`- ${index + 1}. ${step}`))
      if (item.expected.trim() !== '') lines.push(`- **${lang === 'zh' ? '预期' : 'Expected'}**: ${item.expected}`)
      lines.push(`- **${lang === 'zh' ? '设计方法' : 'Technique'}**: ${TECHNIQUE_TITLES[lang][item.technique] ?? item.technique}`)
      lines.push(`- **${lang === 'zh' ? '执行' : 'Result'}**: ${STATUS_TITLES[lang][item.result] ?? item.result}`)
      void kind
    }
  }
  return { filename: `${stem(project)}-cases.md`, mime: 'text/markdown', text: lines.join('\n') }
}

/**
 * Render one artifact for a format.
 * @param project - the project to export.
 * @param format - which format.
 * @param localeId - the locale the human-readable labels use.
 * @returns the artifact.
 */
export function renderExport(project: ProjectState, format: ExportFormat, localeId: string): ExportArtifact {
  switch (format) {
    case 'xmind':
      return renderXmind(project, localeId)
    case 'testlink-xml':
      return renderTestLink(project)
    case 'csv':
      return renderCsv(project)
    case 'markdown':
      return renderMarkdown(project, localeId)
    default:
      throw new Error(`unknown export format "${String(format)}"`)
  }
}
