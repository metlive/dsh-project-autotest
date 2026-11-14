/**
 * Host-half tests: routing, fenced access, per-workspace persistence, and the
 * four exports.
 *
 *   node test/host.test.mjs
 *
 * The exports are checked at the BYTE level where it matters: the XMind
 * artifact is unzipped with the platform `unzip`, its `content.json` parsed,
 * and the case tree walked. A plugin that "exports XMind" but ships a corrupt
 * archive would pass every DOM test and still be useless — this file is the
 * one that would catch it.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mod = await import(pathToFileURL(join(ROOT, 'lib', 'index.js')).href)

const { API_PREFIX, createApi, isTrustedRequest } = mod

// ---------------------------------------------------------------------------
// Harness: a fake Host context with a workspace registry and a temp $DSH_HOME
// ---------------------------------------------------------------------------

const HOME = mkdtempSync(join(tmpdir(), 'dpat-host-'))
process.env.DSH_HOME = HOME

/**
 * Build a fake request from a method path and a body.
 *
 * The fake is an EVENT stream, exactly like node's `IncomingMessage`: it has
 * `once('data'|'end'|'error')` and NO `Symbol.asyncIterator`. An earlier fake
 * implemented async iteration, which let the handler pass here while the real
 * server threw `TypeError` and answered an empty 400.
 */
function request(method, body = {}, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body))
  const listeners = { data: [], end: [], error: [] }
  const fake = {
    url: `${API_PREFIX}/${method}`,
    method: 'POST',
    headers: { host: '127.0.0.1:49344', ...headers },
    once(event, listener) {
      listeners[event]?.push(listener)
      return fake
    },
    removeListener() { return fake },
    /** Deliver the body on the next tick, as the socket would. */
    start() {
      setImmediate(() => {
        if (payload.length > 0) for (const listener of listeners.data.splice(0)) listener(payload)
        for (const listener of listeners.end.splice(0)) listener()
      })
    },
  }
  return fake
}

/** Build a fake response that records what the handler wrote. */
function response() {
  const state = { status: 0, headers: {}, body: '' }
  return {
    state,
    setStatusCode() {},
    writeHead(status, headers) { state.status = status; Object.assign(state.headers, headers ?? {}) },
    end(body) { state.body = typeof body === 'string' ? body : new TextDecoder().decode(body) },
  }
}

/** Call one route and parse its JSON envelope. */
async function call(api, method, body, headers) {
  const res = response()
  const req = request(method, body, headers)
  const pending = api(req, res)
  req.start()
  await pending
  if (res.state.body === '') {
    // The webserver turns a handler throw into an empty 400; surface the cause.
    throw new Error(`route ${method} answered ${res.state.status || 'nothing'} with an empty body`)
  }
  return { status: res.state.status, envelope: JSON.parse(res.state.body) }
}

/** The project file path for one workspace: `<workspace>/docs/autotest/project.json`. */
function projectFileOf(workspacePath) {
  return join(workspacePath, 'docs', 'autotest', 'project.json')
}

/** The report file path for one workspace. */
function reportFileOf(workspacePath) {
  return join(workspacePath, 'docs', 'autotest', 'report.md')
}

/** A workspace registry with two workspaces. */
// Real temp directories: the workspace IS the storage location now.
const WORKSPACES = [
  { id: 'ws-alpha', path: join(HOME, 'projects', 'alpha'), title: 'alpha', sessionIds: ['s1'] },
  { id: 'ws-beta', path: join(HOME, 'projects', 'beta'), title: 'beta', sessionIds: [] },
]

/** The workspace fixture paths, which are also the storage locations. */
const WS_ALPHA_PATH = WORKSPACES[0].path
const WS_BETA_PATH = WORKSPACES[1].path

const ctx = {
  effect(callback) { callback() },
  get(name) {
    if (name === 'workspaceRegistry') {
      return { list: () => WORKSPACES, get: (id) => WORKSPACES.find((entry) => entry.id === id) }
    }
    return undefined
  },
}

const api = createApi(ctx)

/** A project document with cases in both buckets. */
function projectBody() {
  return {
    workspaceId: 'ws-alpha',
    project: {
      version: 1,
      title: 'ignored — registry wins',
      path: '/ignored',
      coverageTarget: 85,
      // The LEGACY seven-stage shape: the migration folds these on load.
      steps: {
        analyse: { status: 'done', note: '覆盖率 85%', updatedAt: 1 },
        plan: { status: 'doing', note: '', updatedAt: 2 },
        cases: { status: 'doing', note: '', updatedAt: 0 },
        environment: { status: 'todo', note: '', updatedAt: 0 },
        scripts: { status: 'todo', note: '', updatedAt: 0 },
        results: { status: 'todo', note: '', updatedAt: 0 },
        bugs: { status: 'todo', note: '', updatedAt: 0 },
      },
      cases: [
        {
          id: 'c1',
          title: '正常登录',
          kind: 'positive',
          technique: 'functional',
          preconditions: '已注册账号',
          steps: ['输入用户名', '输入密码', '点击登录'],
          expected: '进入首页',
          result: 'passed',
          note: '',
        },
        {
          id: 'c2',
          title: '密码为空',
          kind: 'negative',
          technique: 'boundary',
          preconditions: '',
          steps: ['只输入用户名', '点击登录'],
          expected: '提示密码不能为空',
          result: 'untested',
          note: '脚本 login-empty.spec',
        },
      ],
      defects: [
        { id: 'd1', title: '空密码未提示', status: 'open', caseId: 'c2', note: '', createdAt: 1 },
      ],
    },
  }
}

/** Decode a base64 artifact into bytes. */
function decodeBase64(text) {
  return new Uint8Array(Buffer.from(text, 'base64'))
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const cases = []
const test = (name, fn) => cases.push({ name, fn })

test('a POST from the loopback page reaches the route; GET does not', async () => {
  const res = response()
  const req = request('workspaces')
  req.method = 'GET'
  await api(req, res)
  assert.equal(res.state.status, 405)
  const ok = await call(api, 'workspaces')
  assert.equal(ok.status, 200)
})

test('cross-site and non-loopback requests are refused', async () => {
  const crossSite = await call(api, 'workspaces', {}, { 'sec-fetch-site': 'cross-site' })
  assert.equal(crossSite.status, 403)
  const foreign = await call(api, 'workspaces', {}, { host: 'evil.example.com' })
  assert.equal(foreign.status, 403)
  const foreignOrigin = await call(api, 'workspaces', {}, { origin: 'https://evil.example.com' })
  assert.equal(foreignOrigin.status, 403)
  const sameOrigin = await call(api, 'workspaces', {}, { origin: 'http://127.0.0.1:49344' })
  assert.equal(sameOrigin.status, 200)
})

test('the workspace list reports registry workspaces and their project state', async () => {
  const { envelope } = await call(api, 'workspaces')
  assert.equal(envelope.ok, true)
  const list = envelope.value.workspaces
  assert.deepEqual(list.map((entry) => entry.workspaceId), ['ws-alpha', 'ws-beta'])
  assert.equal(list[0].path, WORKSPACES[0].path)
})

test('reading an unsaved project builds a fresh one and writes nothing', async () => {
  const { envelope } = await call(api, 'project', { workspaceId: 'ws-beta' })
  assert.equal(envelope.ok, true)
  assert.equal(envelope.value.existed, false)
  assert.equal(envelope.value.project.cases.length, 0)
  assert.equal(envelope.value.project.title, 'beta', 'the registry title wins')
  assert.equal(envelope.value.project.path, WORKSPACES[1].path)
  let onDisk = true
  try { statSync(projectFileOf(WS_BETA_PATH)) } catch { onDisk = false }
  assert.equal(onDisk, false, 'a read must not create the file')
})

test('saving persists per workspace, and the registry owns title and path', async () => {
  const { envelope } = await call(api, 'save', projectBody())
  assert.equal(envelope.ok, true)
  assert.equal(envelope.value.project.title, 'alpha')
  assert.equal(envelope.value.project.path, WORKSPACES[0].path)
  assert.equal(envelope.value.project.coverageTarget, 85)
  assert.equal(envelope.value.project.cases.length, 2)
  assert.ok(statSync(projectFileOf(WS_ALPHA_PATH)).isFile())

  const reread = await call(api, 'project', { workspaceId: 'ws-alpha' })
  assert.equal(reread.envelope.value.existed, true)
  assert.equal(reread.envelope.value.project.cases.length, 2)
  assert.equal(reread.envelope.value.project.cases[1].kind, 'negative')
  // The legacy `analyse` record folded onto the new first stage.
  assert.equal(reread.envelope.value.project.steps.requirement.note, '覆盖率 85%')
  assert.equal(reread.envelope.value.project.steps.requirement.status, 'done')
  assert.deepEqual(Object.keys(reread.envelope.value.project.steps).sort(), ['bugs', 'cases', 'execution', 'requirement'])
})

test('the two workspaces keep separate documents', async () => {
  await call(api, 'save', { workspaceId: 'ws-beta', project: { cases: [] } })
  const alpha = await call(api, 'project', { workspaceId: 'ws-alpha' })
  const beta = await call(api, 'project', { workspaceId: 'ws-beta' })
  assert.equal(alpha.envelope.value.project.cases.length, 2)
  assert.equal(beta.envelope.value.project.cases.length, 0)
})

test('a malformed document is normalized instead of rejected or crashing', async () => {
  const { envelope } = await call(api, 'save', {
    workspaceId: 'ws-beta',
    project: {
      coverageTarget: 999,
      steps: { requirement: { status: 'bogus' } },
      cases: [
        { title: '   ' },
        { title: 'kept', kind: 'bogus', technique: 'bogus', result: 'bogus', steps: 'not-an-array' },
        null,
        'nope',
      ],
      defects: [{ title: 'fix me', status: 'bogus' }],
    },
  })
  assert.equal(envelope.ok, true)
  const project = envelope.value.project
  assert.equal(project.coverageTarget, 100, 'clamped')
  assert.equal(project.steps.requirement.status, 'todo', 'unknown status falls back')
  assert.equal(project.cases.length, 1, 'blank and malformed cases are dropped')
  assert.equal(project.cases[0].kind, 'positive')
  assert.deepEqual(project.cases[0].steps, [])
  assert.equal(project.defects[0].status, 'open')
  await call(api, 'save', projectBody())
})

test('missing or hostile workspace ids are refused', async () => {
  const missing = await call(api, 'project', {})
  assert.equal(missing.status, 400)
  const traversal = await call(api, 'project', { workspaceId: '../../etc/passwd' })
  // The path now decides WHERE files are written, so an unknown id is refused
  // instead of being sanitized into some other directory.
  assert.equal(traversal.status, 404)
  assert.equal(traversal.envelope.ok, false)
  assert.match(traversal.envelope.error.message, /unknown workspace/)
})

test('the project lives in <workspace>/docs/autotest and the report is written beside it', async () => {
  // Its own workspace: this test rewrites the document several times.
  WORKSPACES.push({ id: 'ws-report', path: join(HOME, 'projects', 'report'), title: 'report', sessionIds: [] })
  const REPORT_WS = 'ws-report'
  const REPORT_PATH = join(HOME, 'projects', 'report')
  await call(api, 'save', {
    workspaceId: REPORT_WS,
    locale: 'zh',
    project: {
      coverageTarget: 90,
      automationLevel: 'both',
      steps: {
        requirement: { status: 'done', note: '已拆解 12 个功能点', updatedAt: 1 },
        cases: { status: 'doing', note: '', updatedAt: 0 },
        execution: { status: 'doing', note: '', updatedAt: 0 },
        bugs: { status: 'todo', note: '', updatedAt: 0 },
      },
      cases: [
        { title: '正常登录', kind: 'positive', technique: 'functional', steps: ['输入账号'], expected: '进入首页', result: 'passed', failReason: 'none', selfCheck: { passOnGood: true, failOnBad: true } },
        { title: '密码为空', kind: 'negative', technique: 'boundary', steps: ['直接提交'], expected: '提示必填', result: 'failed', failReason: 'product', selfCheck: { passOnGood: true, failOnBad: false } },
        { title: '超长密码', kind: 'negative', technique: 'boundary', steps: ['输入 200 字符'], expected: '拒绝', result: 'failed', failReason: 'environment', selfCheck: { passOnGood: false, failOnBad: false } },
      ],
      defects: [
        { title: '空密码未提示', status: 'open', caseId: '', note: '', regression: 'pending', requirementChanged: true, createdAt: 1 },
      ],
    },
  })

  // 1. The files really are inside the workspace.
  const dir = join(REPORT_PATH, 'docs', 'autotest')
  assert.ok(statSync(projectFileOf(REPORT_PATH)).isFile(), 'docs/autotest/project.json exists')
  assert.ok(statSync(reportFileOf(REPORT_PATH)).isFile(), 'docs/autotest/report.md exists')
  let underHome = true
  try { statSync(join(HOME, 'storages')) } catch { underHome = false }
  assert.equal(underHome, false, 'nothing is written under $DSH_HOME')

  // 2. The report states the verdict up front and stays in sync.
  const report = readFileSync(reportFileOf(REPORT_PATH), 'utf8')
  assert.match(report, /^# report — 自动化测试结论报告/)
  assert.match(report, /覆盖率目标 \| 90% \| 自动化粒度：接口 \+ UI/)
  assert.match(report, /脚本已自检 \| 1\/3/, 'only one script passed both checks')
  assert.match(report, /回归通过 0/, 'no defect has passed regression yet')
  assert.match(report, /\| 1 \| 产品文档 \/ 技术方案 \| ✅ 已完成 \| 已拆解 12 个功能点 \|/, 'a done stage is ticked and keeps its note')
  assert.match(report, /正向用例（优先实现） \(1\)/)
  assert.match(report, /反向用例（分析筛选） \(2\)/)

  // 3. The report's open-items section drives the four reflow actions.
  assert.match(report, /2 条用例脚本未自检/)
  assert.match(report, /1 个失败未归因为产品缺陷/, 'the environment failure is flagged')
  assert.match(report, /1 个缺陷的需求已偏离但回归未跑/)

  // 4. Re-saving regenerates it, so it can never describe a stale state.
  await call(api, 'save', { workspaceId: REPORT_WS, locale: 'zh', project: { cases: [], defects: [], steps: {} } })
  const fresh = readFileSync(reportFileOf(REPORT_PATH), 'utf8')
  assert.doesNotMatch(fresh, /正常登录/, 'the old cases are gone from the report')
  assert.match(fresh, /✅ 没有待办：脚本全部自检、失败已归因、缺陷已闭环/, 'a clean project states that nothing is open')
  assert.match(fresh, /未完成阶段/, 'an empty project still lists its unfinished stages')

  // 5. English locale renders English.
  await call(api, 'save', { workspaceId: REPORT_WS, locale: 'en', project: { cases: [] } })
  const en = readFileSync(reportFileOf(REPORT_PATH), 'utf8')
  assert.match(en, /^# report — automation test report/)
  assert.match(en, /Nothing open/)
  void dir

})

test('the registered prefix dispatches through the shell\'s own match rule', async () => {
  // The Shell's webserver dispatches a prefix route only for
  // `pathname === prefix || pathname.startsWith(prefix + '/')`. A client that
  // appends a method segment to a DIFFERENT path silently never reaches the
  // Host — the bug that made the live page answer 405.
  const registered = []
  mod.apply({
    webServer: { register(route) { registered.push(route); return () => {} } },
    get: () => undefined,
    effect(callback) { callback() },
  })
  const prefix = registered[0].path
  // Read the prefix the CLIENT half actually calls.
  const clientSource = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
  const clientPrefix = /API_PREFIX = '([^']+)'/.exec(clientSource)?.[1]
  assert.equal(clientPrefix, prefix, 'the two halves must agree on the route prefix')
  // And every route the Client calls must sit UNDER that prefix.
  const transport = readFileSync(join(ROOT, 'src', 'client', 'api.ts'), 'utf8')
  const callSite = /fetch\(`\$\{API_PREFIX\}\/(\$\{method\}|\w+)`/.exec(transport)
  assert.ok(callSite !== null, 'the Client transport builds `${API_PREFIX}/${method}`')
  const matches = (pathname) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  for (const method of ['workspaces', 'project', 'save', 'export']) {
    assert.ok(matches(`${clientPrefix}/${method}`), `${method} would not reach ${prefix}`)
  }
})

test('an unknown method is a 404 envelope', async () => {
  const { status, envelope } = await call(api, 'nope')
  assert.equal(status, 404)
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'not-found')
})

test('CSV export is one quoted row per case with a BOM', async () => {
  const { envelope } = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'csv', locale: 'zh' })
  assert.equal(envelope.ok, true)
  const { filename, mime, text } = envelope.value.artifact
  assert.match(filename, /^alpha-cases\.csv$/)
  assert.equal(mime, 'text/csv')
  assert.ok(text.startsWith('\uFEFF'), 'spreadsheet tools need the BOM')
  const rows = text.slice(1).split('\r\n')
  assert.equal(rows.length, 3, 'header + two cases')
  assert.ok(rows[0].startsWith('"case_id","stage"'))
  assert.ok(rows[1].includes('"正常登录"'))
  assert.ok(rows[2].includes('"negative"'))
  // A quoted field keeps the embedded newlines of the step list.
  assert.ok(rows[1].includes('"1. 输入用户名\n2. 输入密码\n3. 点击登录"'))
})

test('TestLink XML is well-formed and carries stage/kind custom fields', async () => {
  const { envelope } = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'testlink-xml' })
  const { text, filename } = envelope.value.artifact
  assert.match(filename, /-testlink\.xml$/)
  assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.equal((text.match(/<testcase /g) ?? []).length, 2)
  assert.ok(text.includes('<name>case_kind</name><value>negative</value>'))
  assert.ok(text.includes('<step_number>3</step_number>'))
  // Every case must close: a mismatched tag would make TestLink reject the file.
  assert.equal((text.match(/<\/testcase>/g) ?? []).length, 2)
  assert.ok(text.trimEnd().endsWith('</testsuite>'))
})

test('Markdown export lists every stage and both buckets', async () => {
  const { envelope } = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'markdown', locale: 'zh' })
  const { text } = envelope.value.artifact
  assert.ok(text.includes('# alpha — 自动化测试用例'))
  assert.ok(text.includes('- [x] **产品文档 / 技术方案**'))
  assert.ok(text.includes('## 正向用例（优先实现） (1)'))
  assert.ok(text.includes('## 反向用例（分析筛选） (1)'))
  assert.ok(text.includes('### 密码为空'))
})

test('XMind export is a real ZIP whose content.json traces the case tree', async () => {
  const { envelope } = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'xmind', locale: 'zh' })
  assert.equal(envelope.ok, true)
  const { base64, filename, mime } = envelope.value.artifact
  assert.match(filename, /\.xmind$/)
  assert.equal(mime, 'application/vnd.xmind.workbook')

  // Write the archive out and let the platform unzip it: the strongest check
  // that the container is valid.
  const dir = mkdtempSync(join(tmpdir(), 'dpat-xmind-'))
  const archivePath = join(dir, 'test.xmind')
  const bytes = decodeBase64(base64)
  assert.ok(bytes[0] === 0x50 && bytes[1] === 0x4B, 'ZIP magic')
  await (await import('node:fs/promises')).writeFile(archivePath, bytes)
  const listing = execFileSync('unzip', ['-l', archivePath], { encoding: 'utf8' })
  assert.ok(listing.includes('content.json'))
  assert.ok(listing.includes('metadata.json'))
  // `unzip -t` verifies every CRC: a wrong table shows up here.
  const integrity = execFileSync('unzip', ['-t', archivePath], { encoding: 'utf8' })
  assert.ok(/No errors detected/.test(integrity), integrity)

  const contentText = execFileSync('unzip', ['-p', archivePath, 'content.json'], { encoding: 'utf8' })
  const content = JSON.parse(contentText)
  assert.ok(Array.isArray(content), 'XMind content.json is a sheet array')
  assert.equal(content[0].class, 'sheet')
  const root = content[0].rootTopic
  assert.equal(root.title, 'alpha 测试用例')
  const branches = root.children.attached
  assert.equal(branches.length, 4, 'one branch per stage')
  const caseBranch = branches.find((branch) => branch.title === '设计测试用例')
  const kinds = caseBranch.children.attached
  assert.deepEqual(kinds.map((kind) => kind.title), ['正向 (1)', '反向 (1)'])
  const positive = kinds[0].children.attached[0]
  assert.equal(positive.title, '正常登录')
  const leaves = positive.children.attached.map((leaf) => leaf.title)
  assert.ok(leaves.some((leaf) => leaf.includes('前置条件')), 'preconditions are a leaf')
  assert.ok(leaves.some((leaf) => leaf.includes('步骤: 输入用户名')))
  assert.ok(leaves.some((leaf) => leaf.includes('预期: 进入首页')))
  // Every topic id must be unique or XMind refuses the sheet.
  const ids = []
  const walk = (topic) => {
    ids.push(topic.id)
    for (const child of topic.children?.attached ?? []) walk(child)
  }
  walk(root)
  assert.equal(new Set(ids).size, ids.length, 'topic ids are unique')
  rmSync(dir, { recursive: true, force: true })
})

test('the English export renders English labels', async () => {
  const { envelope } = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'xmind', locale: 'en' })
  const dir = mkdtempSync(join(tmpdir(), 'dpat-xmind-en-'))
  const archivePath = join(dir, 'test.xmind')
  await (await import('node:fs/promises')).writeFile(archivePath, decodeBase64(envelope.value.artifact.base64))
  const content = JSON.parse(execFileSync('unzip', ['-p', archivePath, 'content.json'], { encoding: 'utf8' }))
  assert.equal(content[0].rootTopic.title, 'alpha test cases')
  const titles = content[0].rootTopic.children.attached.map((branch) => branch.title)
  assert.ok(titles.includes('Design test cases'))
  rmSync(dir, { recursive: true, force: true })
})

test('an unknown export format is refused', async () => {
  const { status, envelope } = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'pdf' })
  assert.equal(status, 400)
  assert.equal(envelope.error.code, 'bad-request')
})

test('the body reader never relies on async iteration (Node removed it)', async () => {
  // `for await` over IncomingMessage throws on current Node, and the webserver
  // answers that throw with an empty 400 — the live bug.
  const req = request('workspaces', { hello: '世界' })
  const pending = mod.readBody(req)
  req.start()
  assert.equal(await pending, JSON.stringify({ hello: '世界' }), 'multibyte bodies round-trip')
  assert.equal(typeof req[Symbol.asyncIterator], 'undefined', 'the fake must not offer async iteration')
  const source = readFileSync(join(ROOT, 'src', 'index.ts'), 'utf8')
  assert.doesNotMatch(source, /for await \(/, 'the handler must not iterate the request')
})

test('apply registers one prefix route and disposes it', async () => {
  const registered = []
  const applied = {
    webServer: { register(route) { registered.push(route); return () => {} } },
    get: () => undefined,
    effect(callback) { callback() },
  }
  mod.apply(applied)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].kind, 'prefix')
  assert.equal(registered[0].path, API_PREFIX)
})

test('apply forwards Cordis\'s dispose(reload) argument so the route is unmounted', async () => {
  // Cordis calls an effect's callback as `dispose(reload)`; calling it with no
  // argument must still remove the route from the webserver's table.
  let mounted = 0
  let disposed = 0
  const applied = {
    webServer: {
      register() {
        mounted += 1
        return () => {
          disposed += 1
        }
      },
    },
    get: () => undefined,
    effect(callback) {
      const dispose = callback()
      dispose(false)
    },
  }
  mod.apply(applied)
  assert.equal(mounted, 1)
  assert.equal(disposed, 1, 'the route handed back by register() must be called on disposal')
})

test('a missing trustedHosts on the real Cordis context cannot turn the route into an empty 400', async () => {
  // THE LIVE BUG. Cordis turns every read of an un-injected property on the
  // plugin context into a thrown `cannot get property "trustedHosts" without
  // inject`. The fence read it while answering a request, the throw escaped
  // the handler, and the webserver answered an empty 400 — which the page could
  // only show as "answered HTTP 400 without a body". A context that throws on
  // unknown reads is the closest stand-in for Cordis's proxy.
  const cordisLike = {
    get(name) {
      if (name === 'workspaceRegistry') return { list: () => [], get: () => undefined }
      return undefined
    },
    effect(callback) {
      callback()
    },
    webServer: { register: () => () => {} },
  }
  const strict = new Proxy(cordisLike, {
    get(target, prop) {
      if (prop in target) return Reflect.get(target, prop)
      throw new Error(`cannot get property "${String(prop)}" without inject`)
    },
  })
  const api = mod.createApi(strict)
  const res = response()
  const req = request('workspaces')
  const pending = api(req, res)
  req.start()
  await pending
  assert.equal(res.state.status, 200, 'the fence degrades to loopback-only instead of throwing')
  assert.doesNotThrow(() => JSON.parse(res.state.body))
  const status = JSON.parse(res.state.body)
  assert.equal(status.ok, true)
})

test('a handler that throws before replying still answers a JSON envelope', async () => {
  // The last line of defence: whatever escapes, the page gets a body it can render.
  const exploding = {
    get() {
      throw new Error('registry exploded')
    },
    effect(callback) {
      callback()
    },
    webServer: { register: () => () => {} },
  }
  const api = mod.createApi(exploding)
  const res = response()
  const req = request('workspaces')
  const pending = api(req, res)
  req.start()
  await pending
  assert.equal(res.state.status, 500, 'a throw is a server fault, not a 400')
  const envelope = JSON.parse(res.state.body)
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'internal')
  assert.match(envelope.error.message, /registry exploded/)
})


test('an uploaded XMind created by the export re-imports as the same cases', async () => {
  // Round-trip through the real route: export a project's map, upload it back.
  const exported = await call(api, 'export', { workspaceId: 'ws-alpha', format: 'xmind', locale: 'zh' })
  const base64 = exported.envelope.value.artifact.base64
  const imported = await call(api, 'import', { workspaceId: 'ws-alpha', filename: 'alpha.xmind', base64 })
  assert.equal(imported.status, 200, JSON.stringify(imported.envelope))
  const { format, cases } = imported.envelope.value.import
  assert.equal(format, 'xmind')
  assert.equal(cases.length, 2, 'both cases came back')
  const positive = cases.find((item) => item.title === '正常登录')
  assert.equal(positive.kind, 'positive')
  assert.deepEqual(positive.steps, ['输入用户名', '输入密码', '点击登录'])
  assert.equal(positive.expected, '进入首页')
  assert.equal(positive.preconditions, '已注册账号')
  // The verdict leaf the export stamps is not a step on the way back in.
  assert.ok(!cases.some((item) => item.steps.some((step) => step.startsWith('执行'))))
  const negative = cases.find((item) => item.title === '密码为空')
  assert.equal(negative.kind, 'negative')
  assert.equal(negative.technique, 'boundary')
})

test('Markdown and CSV files import their cases', async () => {
  const markdown = await call(api, 'import', {
    workspaceId: 'ws-alpha',
    filename: 'spec.md',
    text: '# 登录用例\n\n## 反向用例\n\n### 空密码\n- 前置条件: 已注册\n1. 打开登录页\n2. 直接提交\n- 预期: 提示必填\n',
  })
  assert.equal(markdown.status, 200)
  const [mdCase] = markdown.envelope.value.import.cases
  assert.equal(mdCase.title, '空密码')
  assert.equal(mdCase.kind, 'negative')
  assert.equal(mdCase.preconditions, '已注册')
  assert.deepEqual(mdCase.steps, ['打开登录页', '直接提交'])
  assert.equal(mdCase.expected, '提示必填')

  const csv = await call(api, 'import', {
    workspaceId: 'ws-alpha',
    filename: 'cases.csv',
    text: 'title,case_kind,steps,expected\n"搜索命中","positive","1. 输入关键字\n2. 回车","出现结果"\n',
  })
  assert.equal(csv.status, 200)
  const [csvCase] = csv.envelope.value.import.cases
  assert.equal(csvCase.title, '搜索命中')
  assert.deepEqual(csvCase.steps, ['输入关键字', '回车'])
  assert.equal(csvCase.expected, '出现结果')
})

test('a hand-drawn XMind map (stage → case → leaves) imports', async () => {
  // A map a tester drew, DEFLATE-compressed the way XMind writes it: the
  // walker must read stages as containers and their children as cases.
  const topic = (title, kids) => ({ title, ...(kids === undefined ? {} : { children: { attached: kids } }) })
  const content = JSON.stringify([{ rootTopic: topic('登录测试', [
    topic('正常流程', [topic('登录成功', [topic('前置: 已注册'), topic('1. 打开登录页'), topic('预期: 进入首页')])]),
    topic('异常', [topic('空密码', [topic('点击提交'), topic('预期: 提示必填')])]),
  ]) }])
  const dir = mkdtempSync(join(tmpdir(), 'dpat-hand-'))
  const raw = join(dir, 'content.json')
  await (await import('node:fs/promises')).writeFile(raw, content)
  await (await import('node:fs/promises')).writeFile(join(dir, 'metadata.json'), '{}')
  execFileSync('zip', ['-q', '-9', join(dir, 'hand.xmind'), 'content.json', 'metadata.json'], { cwd: dir })
  const base64 = readFileSync(join(dir, 'hand.xmind')).toString('base64')
  rmSync(dir, { recursive: true, force: true })

  const imported = await call(api, 'import', { workspaceId: 'ws-alpha', filename: 'hand.xmind', base64 })
  assert.equal(imported.status, 200, JSON.stringify(imported.envelope))
  const titles = imported.envelope.value.import.cases.map((item) => `${item.kind}:${item.title}`)
  assert.deepEqual(titles, ['positive:正常流程', 'negative:空密码'])
})

test('a file the importer cannot read is a 400 with a message, not a 500', async () => {
  const bad = await call(api, 'import', { workspaceId: 'ws-alpha', filename: 'notes.txt', text: 'hello' })
  assert.equal(bad.status, 400)
  assert.equal(bad.envelope.ok, false)
  assert.match(bad.envelope.error.message, /unsupported file/)
  const noBody = await call(api, 'import', { workspaceId: 'ws-alpha', filename: 'x.xmind' })
  assert.equal(noBody.status, 400)
  const notZip = await call(api, 'import', { workspaceId: 'ws-alpha', filename: 'x.xmind', base64: 'aGVsbG8=' })
  assert.equal(notZip.status, 400)
})


test('a legacy seven-stage document migrates instead of losing stages', async () => {
  // A project.json written before the stages were folded: `analyse` and `plan`
  // both become the requirement stage, `environment`/`scripts`/`results`
  // become execution. Statuses never regress and every note is kept.
  const legacy = {
    workspaceId: 'ws-migrate',
    project: {
      steps: {
        analyse: { status: 'done', note: '需求已拆解', updatedAt: 5 },
        plan: { status: 'doing', note: '排期 3 天', updatedAt: 9 },
        cases: { status: 'doing', note: '', updatedAt: 0 },
        environment: { status: 'done', note: '已部署测试服', updatedAt: 3 },
        scripts: { status: 'doing', note: '写了 4 条脚本', updatedAt: 7 },
        results: { status: 'todo', note: '', updatedAt: 0 },
        bugs: { status: 'todo', note: '', updatedAt: 0 },
      },
      cases: [{ title: '迁移后仍在的用例', kind: 'positive', steps: ['执行一步'] }],
    },
    locale: 'zh',
  }
  WORKSPACES.push({ id: 'ws-migrate', path: join(HOME, 'projects', 'migrate'), title: 'migrate', sessionIds: [] })
  const saved = await call(api, 'save', legacy)
  assert.equal(saved.status, 200)
  const steps = saved.envelope.value.project.steps
  assert.deepEqual(Object.keys(steps).sort(), ['bugs', 'cases', 'execution', 'requirement'])
  // The migration keeps the NOTES (the human record). The status is no longer
  // taken from the document: saveProject derives it from the work, so the
  // stored value must agree with the data rather than with the legacy button.
  assert.match(steps.requirement.note, /需求已拆解/)
  assert.match(steps.requirement.note, /排期 3 天/, 'both prior notes survive')
  assert.match(steps.execution.note, /已部署测试服/)
  assert.match(steps.execution.note, /写了 4 条脚本/)
  // One case with no expected result: cases is in progress, nothing has run.
  assert.equal(steps.cases.status, 'doing', 'derived: cases exist but have no expected result')
  assert.equal(steps.execution.status, 'todo', 'derived: nothing has been executed')
  assert.equal(steps.requirement.status, 'done', 'derived: the input exists and cases were designed')
  assert.equal(saved.envelope.value.project.cases.length, 1, 'cases are untouched by the migration')
})

test('requirement documents are stored in the workspace and can be listed and removed', async () => {
  const uploaded = await call(api, 'document', {
    workspaceId: 'ws-alpha',
    filename: '../../prd.md',
    base64: Buffer.from('# 需求\n登录流程').toString('base64'),
  })
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.envelope))
  assert.equal(uploaded.envelope.value.name, 'prd.md', 'a path in the name is reduced to its last segment')
  const dir = join(WS_ALPHA_PATH, 'docs', 'autotest', 'inputs')
  assert.ok(statSync(join(dir, 'prd.md')).isFile(), 'the document lives inside the workspace')
  assert.equal(statSync(join(HOME, 'prd.md'), { throwIfNoEntry: false }), undefined, 'and never escapes it')

  const listed = await call(api, 'documents', { workspaceId: 'ws-alpha' })
  assert.equal(listed.status, 200)
  assert.deepEqual(listed.envelope.value.documents.map((doc) => doc.name), ['prd.md'])
  assert.ok(listed.envelope.value.documents[0].size > 0)

  const removed = await call(api, 'documentDelete', { workspaceId: 'ws-alpha', filename: 'prd.md' })
  assert.equal(removed.status, 200)
  assert.deepEqual(removed.envelope.value.documents, [])
  assert.equal(statSync(join(dir, 'prd.md'), { throwIfNoEntry: false }), undefined)
})


test('the run route hands the agent a real task in the workspace conversation', async () => {
  // A run is the ONE acting route: it appends a user message to the live
  // session bound to this workspace, which is what makes the model execute.
  const appended = []
  const session = (id, cwd) => ({ id, cwd, append: (type, data, options) => appended.push({ id, type, data, options }) })
  const sessions = {
    list: () => [session('s-elsewhere', '/somewhere/else'), session('s-this', WS_ALPHA_PATH)],
    get: (id) => (id === 's-this' ? session('s-this', WS_ALPHA_PATH) : id === 's-elsewhere' ? session('s-elsewhere', '/somewhere/else') : undefined),
  }
  const runCtx = {
    effect(callback) { callback() },
    get(name) {
      if (name === 'workspaceRegistry') return { list: () => WORKSPACES, get: (id) => WORKSPACES.find((entry) => entry.id === id) }
      if (name === 'sessions') return sessions
      return undefined
    },
  }
  const runApi = mod.createApi(runCtx)
  const result = await call(runApi, 'run', { workspaceId: 'ws-alpha', locale: 'zh' })
  assert.equal(result.status, 200, JSON.stringify(result.envelope))
  assert.equal(result.envelope.value.sessionId, 's-this', 'the run goes to the conversation opened on THIS workspace')
  assert.equal(appended.length, 1)
  assert.equal(appended[0].type, 'user/message')
  assert.equal(appended[0].options.surfaceOp, 'append')
  assert.equal(appended[0].data.source.kind, 'user')
  const text = appended[0].data.content[0].text
  assert.match(text, /正常登录|2 条用例/, 'the prompt names the project and its cases')
  assert.ok(text.includes(projectFileOf(WS_ALPHA_PATH)), 'the agent is told where the project file is')
  assert.match(text, /save/, 'and how to write the verdicts back')

  // An explicit session id wins; an unknown one falls back to the workspace.
  const explicit = await call(runApi, 'run', { workspaceId: 'ws-alpha', sessionId: 's-elsewhere' })
  assert.equal(explicit.envelope.value.sessionId, 's-elsewhere')
  const bogus = await call(runApi, 'run', { workspaceId: 'ws-alpha', sessionId: 'nope' })
  assert.equal(bogus.envelope.value.sessionId, 's-this')
})

test('a run with no cases, no session store, or a foreign origin is refused', async () => {
  // A session store with exactly one live session, so "no cases" is the only
  // reason a run can be refused below.
  const live = (id, cwd) => ({ id, cwd, append() {} })
  const ctxWith = (sessions) => ({
    effect(callback) { callback() },
    get(name) {
      if (name === 'workspaceRegistry') return { list: () => WORKSPACES, get: (id) => WORKSPACES.find((entry) => entry.id === id) }
      if (name === 'sessions') return sessions
      return undefined
    },
  })
  WORKSPACES.push({ id: 'ws-runempty', path: join(HOME, 'projects', 'runempty'), title: 'runempty', sessionIds: [] })
  await call(api, 'save', { workspaceId: 'ws-runempty', project: { cases: [] } })
  const empty = await call(mod.createApi(ctxWith({ list: () => [live('s1', WS_ALPHA_PATH)], get: (id) => (id === 's1' ? live('s1', WS_ALPHA_PATH) : undefined) })), 'run', { workspaceId: 'ws-runempty' })
  assert.equal(empty.status, 400)
  assert.match(empty.envelope.error.message, /no cases/i)

  const orphan = await call(mod.createApi(ctxWith(undefined)), 'run', { workspaceId: 'ws-alpha' })
  assert.equal(orphan.status, 503)
  assert.match(orphan.envelope.error.message, /session/i)

  // An opaque origin (`null`) is a sandboxed/foreign page: it must not be able
  // to make the agent run anything.
  const opaque = await call(api, 'run', { workspaceId: 'ws-alpha' }, { origin: 'null' })
  assert.equal(opaque.status, 403)
})

// --- Teardown / runner --------------------------------------------------


let passed = 0
const failures = []
for (const { name, fn } of cases) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`  ✗ ${name}`)
    console.log(`      ${String(error?.stack ?? error).split('\n').slice(0, 8).join('\n      ')}`)
  }
}
rmSync(HOME, { recursive: true, force: true })
console.log('')
console.log(`${passed}/${cases.length} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
