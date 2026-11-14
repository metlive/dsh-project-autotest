/**
 * DOM tests: the workbench as the user actually operates it.
 *
 *   node test/dom.test.mjs
 *
 * The panel is mounted in jsdom with `react-dom/client`, so effects run, the
 * route fixtures resolve, and every assertion below is made against the real
 * DOM after a real click. This is the file that proves the FEATURES work —
 * switching workspaces, editing cases, saving, exporting — rather than that
 * some markup exists.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHELL_DEPS = process.env.DSH_TEST_DEPS ?? '/Users/metlive/wwwroot/dsh-project-notes/package.json'
const require = createRequire(SHELL_DEPS)
// jsdom is resolved from the same checkout as React: the plugin ships no
// dependencies, and resolvers below act as the version-pinned test peer set.
const { JSDOM } = require('jsdom')
const React = require('react')
const { act } = React

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:49344/',
  pretendToBeVisual: true,
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.Node = window.Node
globalThis.MouseEvent = window.MouseEvent
globalThis.Event = window.Event
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: window.navigator.userAgent, language: 'zh-CN', languages: ['zh-CN'] },
  configurable: true,
  writable: true,
})
// The download helper needs these; jsdom has neither for Blob URLs.
window.URL.createObjectURL = () => 'blob:fixture'
window.URL.revokeObjectURL = () => {}
globalThis.URL = window.URL

let registered
window.__ModuleLoader__ = { load(spec) { registered = spec } }
new Function('window', readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8'))(window)
const loaded = registered.factory((specifier) => {
  if (specifier === 'react') return React
  if (specifier === 'react/jsx-runtime') return require('react/jsx-runtime')
  throw new Error('unexpected external: ' + specifier)
})

// ---------------------------------------------------------------------------
// Route fixtures: a tiny in-memory Host
// ---------------------------------------------------------------------------

const BASE = {
  version: 1,
  workspaceId: 'ws-alpha',
  title: 'alpha',
  path: '/Users/x/projects/alpha',
  coverageTarget: 85,
  automationLevel: 'api',
  steps: {
    requirement: { status: 'done', note: '需求已拆解', updatedAt: 1 },
    cases: { status: 'doing', note: '', updatedAt: 0 },
    execution: { status: 'doing', note: '', updatedAt: 0 },
    bugs: { status: 'todo', note: '', updatedAt: 0 },
  },
  cases: [
    { id: 'c1', title: '正常登录', kind: 'positive', technique: 'functional', preconditions: '已注册', steps: ['输入用户名'], expected: '进入首页', result: 'passed', failReason: 'none', selfCheck: { passOnGood: true, failOnBad: true }, note: '' },
    { id: 'c2', title: '密码为空', kind: 'negative', technique: 'boundary', preconditions: '', steps: ['点击登录'], expected: '提示必填', result: 'failed', failReason: 'product', selfCheck: { passOnGood: true, failOnBad: true }, note: '' },
  ],
  defects: [{ id: 'd1', title: '空密码未提示', status: 'open', caseId: 'c2', note: '', regression: 'pending', requirementChanged: false, createdAt: 1 }],
  createdAt: 1,
  updatedAt: 1,
}

const stored = new Map([['ws-alpha', structuredClone(BASE)]])
const requests = []
const imported = []
const documents = []

// The route prefix the Host half registers, read from its built bundle: the
// fixture only answers requests that the shell would actually dispatch to it.
const HOST_PREFIX = (() => {
  const match = /const API_PREFIX = '([^']+)'/.exec(readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8'))
  if (match === null) throw new Error('the Host bundle must define API_PREFIX')
  return match[1]
})()

globalThis.fetch = window.fetch = async (url, init) => {
  // The upload addresses `/document?isRequest=1&…`, so the method is the last
  // URL PATH segment, not the last text after the final slash.
  const method = new URL(String(url), 'http://127.0.0.1:49344').pathname.split('/').pop()
  // The raw-body upload sends the file itself, not JSON: the query carries
  // its name and project, and the body is the document text.
  const query = new URL(String(url), 'http://127.0.0.1:49344').searchParams
  const body = query.get('isRequest') === '1'
    ? { workspaceId: query.get('workspaceId'), filename: query.get('filename'), text: init?.body }
    : init?.body === undefined ? {} : JSON.parse(init.body)
  requests.push({ method, body, url: String(url) })
  // Shell dispatch rule: `pathname === prefix || pathname.startsWith(prefix + '/')`.
  const pathname = new URL(String(url), 'http://127.0.0.1:49344').pathname
  if (pathname !== HOST_PREFIX && !pathname.startsWith(`${HOST_PREFIX}/`)) {
    throw new Error(`route not dispatched: ${pathname} is outside ${HOST_PREFIX}`)
  }
  const ok = (value) => ({ ok: true, status: 200, json: async () => ({ ok: true, value }) })
  if (method === 'workspaces') {
    return ok({
      workspaces: [
        { workspaceId: 'ws-alpha', title: 'alpha', path: '/Users/x/projects/alpha', caseCount: stored.get('ws-alpha')?.cases.length ?? 0, hasProject: true },
        { workspaceId: 'ws-beta', title: 'beta', path: '/Users/x/projects/beta', caseCount: 0, hasProject: false },
      ],
    })
  }
  if (method === 'project') {
    const project = stored.get(body.workspaceId)
    const fresh = structuredClone(project ?? { ...BASE, workspaceId: body.workspaceId, title: body.workspaceId, path: `/Users/x/projects/${body.workspaceId}`, cases: [], defects: [] })
    return ok({ project: fresh, storagePath: `/tmp/projects/${body.workspaceId}.json`, existed: project !== undefined })
  }
  if (method === 'save') {
    stored.set(body.workspaceId, structuredClone(body.project))
    return ok({ project: body.project, storagePath: `/tmp/projects/${body.workspaceId}.json`, existed: true })
  }
  if (method === 'export') {
    return ok({ artifact: { filename: `alpha-${body.format}.xmind`, mime: 'application/x', base64: 'UEsDBAo=' } })
  }
  if (method === 'documents') {
    return ok({ documents: documents.slice() })
  }
  if (method === 'document') {
    documents.unshift({ name: body.filename, size: 3, modifiedAt: Date.now() })
    return ok({ name: body.filename, size: 3, documents: documents.slice() })
  }
  if (method === 'documentDelete') {
    const at = documents.findIndex((doc) => doc.name === body.filename)
    if (at >= 0) documents.splice(at, 1)
    return ok({ documents: documents.slice() })
  }
  if (method === 'version') {
    return ok({ build: 'test' })
  }
  if (method === 'run') {
    return ok({ sessionId: 'session-live', cases: stored.get(body.workspaceId)?.cases.length ?? 0, prompt: 'Run the automated tests' })
  }
  if (method === 'import') {
    // The fixture answers like the Host's importer would: it reports the cases
    // the uploaded file carries, and writes nothing.
    imported.push(body)
    if (body.filename === 'bad.txt') {
      return { ok: false, status: 400, json: async () => ({ ok: false, error: { code: 'bad-request', message: 'bad.txt: unsupported file' } }) }
    }
    const cases = [
      { title: '登录成功', kind: 'positive', technique: 'functional', preconditions: '已注册', steps: ['打开登录页', '提交'], expected: '进入首页', note: '' },
      { title: '空密码', kind: 'negative', technique: 'boundary', preconditions: '', steps: ['直接提交'], expected: '提示必填', note: '' },
    ]
    return ok({ import: { format: body.filename?.endsWith('.xmind') ? 'xmind' : 'markdown', cases, warnings: ['a nested topic was flattened'] } })
  }
  return { ok: false, status: 404, json: async () => ({ ok: false, error: { code: 'not-found', message: method } }) }
}

// ---------------------------------------------------------------------------
// Mount the real panel through its real registration
// ---------------------------------------------------------------------------

const registrations = []
const injections = {}
const ctx = {
  locale: {
    getSnapshot: () => ({ active: 'zh' }),
    subscribe: () => () => {},
    register: () => () => {},
    bind: () => (key, params) => (params === undefined ? key : key.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match))),
  },
  slots: {
    register(options, component) { registrations.push({ options, component }); return () => {} },
    inject(key, callback) { injections[key] = callback; return () => {} },
  },
  layout: { selectPanel() {} },
  get: (name) => (name === 'layout' ? ctx.layout : undefined),
  effect(callback) { callback() },
}
loaded.apply(ctx)
for (const callback of Object.values(injections)) callback()

const page = registrations.find((entry) => entry.options.name === 'main')
const container = document.getElementById('root')
const root = require('react-dom/client').createRoot(container)

const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)) }) }

await act(async () => { root.render(React.createElement(page.component, {})) })
await settle()

// ---------------------------------------------------------------------------
// Helpers that drive the page the way a person does
// ---------------------------------------------------------------------------

/** Print where a thrown test stopped, before the process dies. */
function stage() {
  const done = results.map((entry) => `${entry.ok ? '✓' : '✗'} ${entry.name}`)
  console.log(done.join('\n'))
  console.log('FAILED AT:', typeof currentStage === 'string' ? currentStage : 'unknown')
  process.exit(0)
}
let currentStage = ''

const $ = (selector) => container.querySelector(selector)
const $$ = (selector) => [...container.querySelectorAll(selector)]
const text = () => container.textContent ?? ''
const byText = (selector, value) => $$(selector).find((node) => (node.textContent ?? '').includes(value))

/** Click an element inside act(). */
async function click(node) {
  assert.ok(node !== null && node !== undefined, 'clicked element exists')
  await act(async () => { node.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  await settle()
}

/** Type into an input/textarea/select the way React sees it. */
async function type(node, value) {
  const prototype = node.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
  await act(async () => {
    setter.call(node, value)
    node.dispatchEvent(new window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

const results = []
const check = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition) })
  console.log(`  ${condition ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`)
}

currentStage = '1. Initial load'
// --- 1. Initial load ------------------------------------------------------
check('the page left its loading state', !text().includes('正在读取工作区'))
check('the workspace picker lists both workspaces', $$('select.dpat-select').length >= 1)
const picker = $$('select.dpat-select')[0]
check('the picker options name each project with its case count',
  [...picker.options].some((option) => option.textContent.includes('alpha')) && [...picker.options].some((option) => option.textContent.includes('beta')))
check('the current workspace path is shown', text().includes('/Users/x/projects/alpha'))
check('the storage path is shown', text().includes('/tmp/projects/ws-alpha.json'))
check('the four-stage rail renders', $$('.dpat-railItem').length === 4)
check('the pipeline shows the project coverage target', text().includes('85%'))
check('the first stage is open', $('.dpat-railItem[aria-current="step"]')?.getAttribute('data-step') === 'requirement')
check('the read project was requested once', requests.filter((entry) => entry.method === 'project').length === 1)

currentStage = '2. Stage status is derived, notes persist'
// --- 2. Derived status + note persistence --------------------------------
// There is no status selector any more: the four stages report what the work
// shows. A case without an expected result means stage ② is in progress.
check('no manual status control is rendered', $$('.dpat-seg[data-status]').length === 0)
const headStatus = $('.dpat-wbStageHead [data-stage-status]')
check('the stage head shows a derived status', headStatus !== null)
// The fixture's two cases both carry an expected result, so ② derives as done.
check('every case has an expected result → stage ② is done',
  $$('.dpat-railItem[data-step="cases"] .dpat-status-done').length === 1)

const noteField = $$('textarea.dpat-input').find((node) => node.closest('.dpat-card'))
await type(noteField, '覆盖率拆到 12 个功能点')
await settle()
check('a stage note is persisted', (stored.get('ws-alpha')?.steps.requirement.note ?? '').includes('12 个功能点'))
check('the Host stores the DERIVED statuses, not a clicked one',
  stored.get('ws-alpha')?.steps !== undefined)

currentStage = '3. The case editor'
// --- 3. The case editor ---------------------------------------------------
await click($('.dpat-railItem[data-step="cases"]'))
check('the case editor renders both buckets', $$('.dpat-bucket').length === 2)
check('the positive bucket holds its case', $('.dpat-bucket[data-bucket="positive"] [data-case="c1"]') !== null)
check('the negative bucket holds its case', $('.dpat-bucket[data-bucket="negative"] [data-case="c2"]') !== null)

const addButtons = $$('.dpat-bucketHead .dpat-btn')
await click(addButtons[0])
const afterAdd = stored.get('ws-alpha').cases
check('adding a positive case appends it and saves', afterAdd.length === 3 && afterAdd[2].kind === 'positive')

const newest = $$('[data-case]').find((node) => node.getAttribute('data-case') === afterAdd[2].id)
const titleInput = newest.querySelector('.dpat-caseTitle')
await type(titleInput, '搜索命中')
await settle()
check('editing a case title saves it', stored.get('ws-alpha').cases[2].title === '搜索命中')

const stepInput = newest.querySelector('.dpat-stepRow .dpat-input')
await type(stepInput, '输入关键字')
await settle()
check('editing a step saves it', stored.get('ws-alpha').cases[2].steps[0] === '输入关键字')

const addStep = newest.querySelector('.dpat-linkBtn')
await click(addStep)
check('adding a step appends an empty one', stored.get('ws-alpha').cases[2].steps.length === 2)

const resultSelects = [...newest.querySelectorAll('select.dpat-select')]
await type(resultSelects[1], 'failed')
await settle()
check('the run verdict of a case persists', stored.get('ws-alpha').cases[2].result === 'failed')

const removeButton = newest.querySelector('.dpat-iconBtn.dpat-danger')
await click(removeButton)
check('removing a case removes it from storage', stored.get('ws-alpha').cases.length === 2)

currentStage = '4. Defect tracker'
// --- 4. Defect tracker ----------------------------------------------------
await click($('.dpat-railItem[data-step="bugs"]'))
if (process.env.DEBUG_DOM === '1') {
  console.log('BUGS HTML:', container.innerHTML.slice(container.innerHTML.indexOf('dpat-wbStage'), container.innerHTML.indexOf('dpat-wbStage') + 2500))
}
check('the defect tracker lists the stored defect', $('[data-defect="d1"]') !== null)
// The defect panel's head is the only one in this stage with a button.
const defectHeadButton = $$('.dpat-wbStage .dpat-bucketHead .dpat-btn').pop()
await click(defectHeadButton)
check('logging a defect appends it', stored.get('ws-alpha').defects.length === 2)
const defectStatus = $$('[data-defect] select.dpat-select')[0]
await type(defectStatus, 'closed')
await settle()
check('a defect status change persists', stored.get('ws-alpha').defects[0].status === 'closed')

currentStage = '5. Switching workspace (the core gesture)'
// --- 4b. Step ① coverage target + automation level ------------------------
await click($('.dpat-railItem[data-step="requirement"]'))
const targetInput = $('.dpat-targetInput')
check('the coverage target is an editable number input', targetInput !== null && targetInput.type === 'number')
await type(targetInput, '92')
await settle()
check('editing the coverage target persists', stored.get('ws-alpha').coverageTarget === 92, `(${stored.get('ws-alpha').coverageTarget})`)
const levelSelect = $$('.dpat-wbStage select.dpat-select').find((n) => [...n.options].some((o) => o.value === 'ui'))
check('the automation level selector exists', levelSelect !== undefined)
await type(levelSelect, 'both')
await settle()
check('choosing the automation level persists', stored.get('ws-alpha').automationLevel === 'both', `(${stored.get('ws-alpha').automationLevel})`)
await type(targetInput, '101')
await settle()
check('an out-of-range target is clamped to 100', stored.get('ws-alpha').coverageTarget === 100, `(${stored.get('ws-alpha').coverageTarget})`)
await type(targetInput, '85')
await settle()

// --- 4c. Step ⑤ script self-check + ⑥ fail reason -> defect ---------------
await click($('.dpat-railItem[data-step="cases"]'))
const caseC2 = $('[data-case="c2"]')
// React's onChange for a checkbox is driven by the 'click' event, not 'change'.
const toggle = async (el, next) => act(async () => {
  if (el.checked !== next) el.click()
})
await toggle(caseC2.querySelector('[data-selfcheck="failOnBad"]'), false)
await settle()
check('un-ticking a self-check persists', stored.get('ws-alpha').cases[1].selfCheck.failOnBad === false,
  `(now=${stored.get('ws-alpha').cases[1].selfCheck.failOnBad})`)
await toggle($('[data-case="c2"]').querySelector('[data-selfcheck="failOnBad"]'), true)
await settle()
check('re-ticking it persists', stored.get('ws-alpha').cases[1].selfCheck.failOnBad === true)
// The fixture's translation stub returns the KEY, not the text, so assert on the hook.
check('a verified script shows the badge', $('[data-case="c2"] .dpat-badgeOk') !== null)

const fileBtn = $('[data-case="c2"] [data-action="file-defect"]')
check('a product-attributed failure offers "转为 Bug"', fileBtn !== null)
const defectsBefore = stored.get('ws-alpha').defects.length
await click(fileBtn)
check('filing the bug appends a defect linked to the case',
  stored.get('ws-alpha').defects.length === defectsBefore + 1
  && stored.get('ws-alpha').defects.at(-1).caseId === 'c2'
  && stored.get('ws-alpha').defects.at(-1).regression === 'pending')

// A script-attributed failure must NOT offer the bug action.
await click($('[data-case="c1"]'))
const reasonSelect = $$('[data-case="c1"] select.dpat-select').find((n) => [...n.options].some((o) => o.value === 'environment'))
await type(reasonSelect, 'environment')
await settle()
check('a script/environment failure persists its cause', stored.get('ws-alpha').cases[0].failReason === 'environment')

// --- 4d. Step ⑦ regression + requirement deviation ------------------------
await click($('.dpat-railItem[data-step="bugs"]'))
const regressionSelect = $$('[data-defect="d1"] select.dpat-select')
  .find((n) => [...n.options].every((o) => ['pending', 'passed', 'failed'].includes(o.value)))
check('the defect offers a regression verdict', regressionSelect !== undefined)
// Start the defect in the state a fix leaves it: resolved, awaiting regression.
const statusSelect = $$('[data-defect="d1"] select.dpat-select')
  .find((n) => [...n.options].some((o) => o.value === 'regressing'))
await type(statusSelect, 'resolved')
await settle()
await type(regressionSelect, 'passed')
await settle()
check('the regression verdict persists', stored.get('ws-alpha').defects[0].regression === 'passed')
const closeBtn = $('[data-defect="d1"] [data-action="close-defect"]')
check('a passed regression offers "关闭缺陷"', closeBtn !== null)
await click(closeBtn)
check('closing the defect persists', stored.get('ws-alpha').defects[0].status === 'closed')
await toggle($('[data-deviation="d1"]'), true)
await settle()
check('the requirement-deviation flag persists', stored.get('ws-alpha').defects[0].requirementChanged === true)
check('the deviation shows its warning', $('[data-defect="d1"] .dpat-hintWarn') !== null)

// --- 5. Switching workspace (the core gesture) ----------------------------
await type(picker, 'ws-beta')
const betaProject = stored.get('ws-beta')
check('switching workspace loads that project', betaProject !== undefined || requests.some((entry) => entry.method === 'project' && entry.body.workspaceId === 'ws-beta'))
check('the page now names the beta project', text().includes('/Users/x/projects/beta'))
check('beta starts empty', $$('[data-bucket="positive"] [data-case]').length === 0 && $$('[data-bucket="negative"] [data-case]').length === 0)

currentStage = '6. Export'
// --- 6. Export ------------------------------------------------------------
const exportButton = $('.dpat-wbHead .dpat-btnPrimary')
await click(exportButton)
check('the export menu opens with four formats', $$('[data-format]').length === 4)
await click($('[data-format="xmind"]'))
await settle()
const exportRequest = requests.filter((entry) => entry.method === 'export').pop()
check('the XMind export asks the Host for the saved beta project', exportRequest?.body.workspaceId === 'ws-beta' && exportRequest?.body.format === 'xmind')
// The stub dictionary has no `{file}` interpolation, so the key itself is the
// assertion: the notice appears, and the artifact reached the Host.
check('the export shows a success notice', $('.dpat-bannerOk') !== null)
check('the save guard ran before the export (the document was already saved)',
  requests.filter((entry) => entry.method === 'save').length >= 1)

currentStage = '7. The sidebar row action jumps to a project'
// --- 7. The sidebar row action jumps to a project -------------------------
const rowAction = registrations.find((entry) => entry.options.name === 'sidebar.workspaces.session.row.action')
const rowContainer = document.createElement('div')
document.body.appendChild(rowContainer)
const rowRoot = require('react-dom/client').createRoot(rowContainer)
const useSessions = (selector) => selector({ byId: { s1: { cwd: '/Users/x/projects/alpha/src' } } })
const useWorkspaces = (selector) => selector({ workspaces: [
  { id: 'ws-alpha', path: '/Users/x/projects/alpha', title: 'alpha' },
  { id: 'ws-beta', path: '/Users/x/projects/beta', title: 'beta' },
] })
await act(async () => {
  rowRoot.render(React.createElement(rowAction.component, { sessionId: 's1', useSessions, useWorkspaces }))
})
await settle()
const button = rowContainer.querySelector('[data-row-action="automation-test"]')
check('the session row renders the test button', button !== null)
await act(async () => { button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await settle()
const lastProjectCall = requests.filter((entry) => entry.method === 'project').pop()
check('clicking it focuses that row\'s workspace in the workbench', lastProjectCall?.body.workspaceId === 'ws-alpha')
check('the workbench switched back to alpha', text().includes('/Users/x/projects/alpha'))


currentStage = '8. Import from a file'
// --- 8. Import ------------------------------------------------------------
const importButton = $('[data-action="import"]')
check('the header offers an import button', importButton !== null)
await click(importButton)
check('the import panel opens', $('[data-import-panel="open"]') !== null)

// Drop a file the way a person does: choose it through the hidden input.
let fileInput = $('[data-import-input="file"]')
check('the panel holds a file input accepting xmind', fileInput !== null && fileInput.accept.includes('.xmind'))
const markdownFile = new window.File(['# spec'], 'spec.md', { type: 'text/markdown' })
await act(async () => {
  Object.defineProperty(fileInput, 'files', { value: [markdownFile], configurable: true })
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await settle()
check('the file is sent to the Host importer', imported.length === 1 && imported[0].filename === 'spec.md')
check('the preview lists the parsed cases', $('[data-import-cases="2"]') !== null)
check('the preview names the format', text().includes('wb.importFormat'))
check('the preview surfaces the parser warnings', $('.dpat-importWarnings') !== null)
const casesBeforeImport = stored.get('ws-alpha').cases.length
await click($('[data-import-mode="append"]'))
await settle()
const afterAppend = stored.get('ws-alpha').cases
check('appending adds every imported case', afterAppend.length === casesBeforeImport + 2)
check('an imported case keeps its bucket and steps',
  afterAppend.at(-2).title === '登录成功' && afterAppend.at(-2).kind === 'positive' && afterAppend.at(-2).steps.length === 2)
check('an imported case starts untested', afterAppend.at(-1).result === 'untested')
check('the import lands the user on the case stage', $('.dpat-railItem[data-step="cases"]').getAttribute('aria-current') === 'step')
check('stage ③ moves to in progress', stored.get('ws-alpha').steps.cases.status === 'doing')
check('the panel closes after import', $('[data-import-panel="open"]') === null)
check('a success notice names the count', $('.dpat-bannerOk') !== null)

// Replace mode drops the previous list.
await click($('[data-action="import"]'))
await act(async () => {
  const second = new window.File(['# spec'], 'spec2.xmind', { type: 'application/octet-stream' })
  Object.defineProperty(fileInput = $('[data-import-input="file"]'), 'files', { value: [second], configurable: true })
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await settle()
check('an .xmind travels as base64', typeof imported.at(-1).base64 === 'string' && imported.at(-1).text === undefined)
await click($('[data-import-mode="replace"]'))
await settle()
check('replacing leaves exactly the imported cases', stored.get('ws-alpha').cases.length === 2 && stored.get('ws-alpha').cases.every((item) => item.title === '登录成功' || item.title === '空密码'))

// A file the Host refuses shows its message and changes nothing.
await click($('[data-action="import"]'))
const casesBeforeBad = stored.get('ws-alpha').cases.length
await act(async () => {
  const bad = new window.File(['nope'], 'bad.txt', { type: 'text/plain' })
  Object.defineProperty(fileInput = $('[data-import-input="file"]'), 'files', { value: [bad], configurable: true })
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await settle()
check('a refused file shows the Host message', $('[data-import-panel="open"] [role="alert"]')?.textContent.includes('unsupported file'))
check('a refused file changes nothing', stored.get('ws-alpha').cases.length === casesBeforeBad)
await click(byText('.dpat-importHead .dpat-linkBtn', 'wb.importCancel') ?? $('.dpat-importHead .dpat-linkBtn'))
check('cancel closes the panel', $('[data-import-panel="open"]') === null)


currentStage = '9. The four stages and who does the work'
// --- 9. Stage ① documents + owner markers --------------------------------
await type(picker, 'ws-alpha')
await click($('.dpat-railItem[data-step="requirement"]'))
check('stage ① shows the document drop zone', $('[data-docs-drop="zone"]') !== null)
check('stage ① asks for the product docs and design', $('.dpat-docs') !== null)
check('stage ① is marked as human work', $('.dpat-wbStageHead .dpat-owner').getAttribute('data-owner') === 'human')
check('stage ① lists what the person must do', $('[data-stage-actions="requirement"]') !== null)

const docInput = $('[data-docs-input="file"]')
await act(async () => {
  const doc = new window.File(['# 需求\n登录流程'], 'prd.md', { type: 'text/markdown' })
  Object.defineProperty(docInput, 'files', { value: [doc], configurable: true })
  docInput.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await settle()
check('the uploaded document is stored by the Host', documents.some((doc) => doc.name === 'prd.md'))
check('the stored document is listed', $('[data-doc="prd.md"]') !== null)
await click($('[data-doc-remove="prd.md"]'))
await settle()
check('removing a document removes it from the list', $('[data-doc="prd.md"]') === null && documents.length === 0)

await click($('.dpat-railItem[data-step="execution"]'))
check('the execution stage is marked as model work', $('.dpat-wbStageHead .dpat-owner').getAttribute('data-owner') === 'model')
check('the model stage explains what it does', $('[data-model-stage="execution"]') !== null)
check('the model stage asks nothing of the person', $('[data-stage-actions="execution"]') === null)

await click($('.dpat-railItem[data-step="bugs"]'))
check('the defect stage is model-runs / you-review', $('.dpat-wbStageHead .dpat-owner').getAttribute('data-owner') === 'review')


currentStage = '10. Start a test run'
// --- 10. The run button ---------------------------------------------------
await type(picker, 'ws-alpha')
await click($('.dpat-railItem[data-step="execution"]'))
const runButton = $('[data-action="run-tests"]')
check('the execution stage offers a real start button', runButton !== null)
check('the button names how many cases will run', text().includes('wb.runCases'))
// Every edit in this suite already saved, so the page is in sync: arriving at
// the run with a saved document is the normal case, and no extra save is due.
const savedBefore = stored.get('ws-alpha')
await click(runButton)
await settle()
const runRequest = requests.filter((entry) => entry.method === 'run').pop()
check('clicking it asks the Host to start a run', runRequest !== undefined && runRequest.body.workspaceId === 'ws-alpha')
check('the run uses the document the page is showing', runRequest !== undefined && savedBefore !== undefined && runRequest.body.cases === undefined)
check('the started run is reported with its session', $('[data-run-session="session-live"]') !== null)
check('the page shows the task the model received', $('.dpat-runPrompt .dpat-pre')?.textContent.includes('Run the automated tests'))
check('a notice confirms how many cases went out', text().includes('wb.runStarted'))
check('the button returns to its idle label after starting', $('[data-action="run-tests"]').textContent.includes('wb.runStart'))

// --- Teardown -------------------------------------------------------------
await act(async () => { root.unmount() })
await act(async () => { rowRoot.unmount() })
rowContainer.remove()

const passed = results.filter((entry) => entry.ok).length
console.log('')
console.log(`${passed}/${results.length} passed`)
if (passed !== results.length) process.exitCode = 1
