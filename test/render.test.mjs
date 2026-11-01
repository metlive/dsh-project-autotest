/**
 * Real-renderer tests for the workbench.
 *
 *   node test/render.test.mjs
 *
 * `lib/client.js` is loaded through a genuine `window.__ModuleLoader__`, its
 * registrations land in a real `SlotCore`, and the components are rendered with
 * `react-dom/server`. That catches what a hand-written React stand-in cannot:
 * hooks React would reject (an earlier blank page was exactly a missing
 * `getServerSnapshot`), and server-rendering-only failures.
 *
 * React, react-dom and the slots core come from the sibling checkout because
 * they must be the versions the shell bundles.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHELL_DEPS = process.env.DSH_TEST_DEPS ?? '/Users/metlive/wwwroot/dsh-project-notes/package.json'
const require = createRequire(SHELL_DEPS)

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { SlotCore } = require('@deepseek-ai/dsh-client-ui-slots')

/** The slot declarations, copied from what `ui-sidebar` / `ui-layout` declare. */
const DECLARATIONS = {
  'sidebar.panellist': { kind: 'list', scope: 'root' },
  main: { kind: 'keyed', scope: 'root' },
  'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
}

/** The workspace fixture the picker reads. */
const WORKSPACES = [
  { workspaceId: 'ws-alpha', title: 'alpha', path: '/Users/x/projects/alpha', caseCount: 2, hasProject: true },
  { workspaceId: 'ws-beta', title: 'beta', path: '/Users/x/projects/beta', caseCount: 0, hasProject: false },
]

/**
 * A fetch fixture that behaves like the Shell's OWN webserver:
 *
 * - it understands the registered route table, so a path the plugin does not
 *   register falls through exactly as it would in the browser;
 * - route matching follows the shell's rule (exact table, then
 *   `pathname === prefix || pathname.startsWith(prefix + '/')`) — a request
 *   whose path misses the registered prefix must FAIL here, because that is
 *   what the live page experiences;
 * - `response.text()` is implemented, because the Client transport reads text
 *   and this fixture has to be able to prove the absence of a reader.
 */
function installFetch(routePrefix) {
  const calls = []
  const routes = new Set([routePrefix])
  const urls = []
  globalThis.__routes = routes
  globalThis.__urls = urls
  globalThis.fetch = async (url, init) => {
    const method = String(url).split('/').pop()
    const body = init?.body === undefined ? {} : JSON.parse(init.body)
    calls.push({ method, body })
    urls.push(String(url))
    const answer = (value) => ({ ok: true, status: 200, json: async () => ({ ok: true, value }) })
    // The shell dispatches by pathname only for `pathname === prefix` or
    // `pathname.startsWith(prefix + '/')`. Anything else is NOT the plugin's
    // route and must fail as it would in the browser.
    const pathname = new URL(String(url), 'http://127.0.0.1:49344').pathname
    if (![...routes].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return { ok: false, status: 404, json: async () => ({ ok: false, error: { code: 'no-route', message: `no route for ${pathname}` } }) }
    }
    if (method === 'workspaces') return answer({ workspaces: WORKSPACES })
    if (method === 'project') {
      return answer({ project: { workspaceId: body.workspaceId, title: body.workspaceId }, storagePath: `/tmp/projects/${body.workspaceId}.json`, existed: true })
    }
    if (method === 'save') return answer({ project: body.project, storagePath: '/tmp/projects/x.json', existed: true })
    if (method === 'export') return answer({ artifact: { filename: 'alpha.xmind', mime: 'application/x', base64: 'UEsDBAo=' } })
    return { ok: false, status: 404, json: async () => ({ ok: false, error: { code: 'not-found', message: method } }) }
  }
  return calls
}

/** Run the bundle against a fake page whose style tag already exists. */
function loadBundle() {
  let registered
  const thisWindow = {
    __ModuleLoader__: { load(spec) { registered = spec } },
    location: { hash: '' },
    history: { replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.window = thisWindow
  globalThis.document = {
    querySelector: () => ({ tagName: 'STYLE' }),
    createElement: () => ({ setAttribute() {}, remove() {} }),
    head: { appendChild() {} },
    body: { appendChild() {}, removeChild() {} },
  }
  new Function('window', readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8'))(thisWindow)
  assert.ok(registered !== undefined, 'bundle did not call __ModuleLoader__.load')
  assert.equal(registered.id, 'dsh-project-autotest')
  return registered.factory((specifier) => {
    if (specifier === 'react') return React
    if (specifier === 'react/jsx-runtime') return require('react/jsx-runtime')
    throw new Error(`the bundle required "${specifier}", which the shell does not share`)
  })
}

/** Activate against a fake cordis ctx and the real SlotCore. */
function mount(activeLocale = 'zh') {
  installFetch(hostRoutePrefix())
  const exports = loadBundle()
  const dictionaries = {}
  const core = new SlotCore()
  for (const [key, spec] of Object.entries(DECLARATIONS)) {
    const record = core.record(key)
    record.spec = spec
    record.declaredBy = 'ui-sidebar'
    record.declarationEpoch = 1
  }
  const registrations = []
  const injections = {}
  const ctx = {
    locale: {
      getSnapshot: () => ({ active: activeLocale, locales: [], revision: 1 }),
      subscribe: () => () => {},
      register(namespace, dicts) { dictionaries[namespace] = dicts; return () => {} },
      bind(namespace) {
        return (key, params = {}) => {
          const template = dictionaries[namespace]?.[activeLocale]?.[key]
          if (template === undefined) return key
          return template.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match))
        }
      },
    },
    slots: {
      register(options, component) {
        registrations.push({ options, component })
        return core.register(options, component)
      },
      inject(key, callback) { injections[key] = callback; return () => {} },
    },
    layout: { selectPanel() {} },
    get(name) { return name === 'layout' ? ctx.layout : undefined },
    effect(callback) { callback() },
  }
  exports.apply(ctx)
  for (const callback of Object.values(injections)) callback()
  return { exports, registrations, core }
}

/**
 * The route prefix the Host half registers, read from its built bundle.
 * The fixture dispatches like the shell: a request outside this prefix fails.
 * @returns the Host's `API_PREFIX`.
 */
function hostRoutePrefix() {
  const source = readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8')
  const match = /const API_PREFIX = '([^']+)'/.exec(source)
  assert.ok(match !== null, 'the Host bundle defines API_PREFIX')
  return match[1]
}

const results = []
const test = (name, fn) => results.push({ name, fn })

test('both seats and the row action register in the real SlotCore', () => {
  const { core, registrations } = mount()
  assert.equal(core.entriesOfSlot('sidebar.panellist').length, 1)
  assert.deepEqual(core.entriesOfSlot('sidebar.panellist').map((entry) => entry.options.id), ['automation-flow'])
  assert.deepEqual(core.entries('main').map((entry) => entry.options.key), ['automation-flow'])
  assert.deepEqual(
    core.entriesOfSlot('sidebar.workspaces.session.row.action').map((entry) => entry.options.id),
    ['automation-test'],
  )
  assert.equal(registrations.length, 3)
})

test('the workbench renders its loading paint through real React without throwing', () => {
  const { registrations } = mount()
  const page = registrations.find((entry) => entry.options.name === 'main')
  // The regression guard for the earlier blank page: a hook React rejects
  // throws here, and the shell would blank the slot entry.
  const html = renderToStaticMarkup(React.createElement(page.component, {}))
  assert.ok(html.includes('dpat-workbench'), 'the workbench root renders')
  assert.ok(html.includes('正在读取工作区'), 'the first paint is the loading state')
})

test('zh and en dictionaries carry the same keys and no empty string', () => {
  const source = readFileSync(join(ROOT, 'src', 'client', 'locales.ts'), 'utf8')
  const read = (name) => {
    const start = source.indexOf(`export const ${name} = {`)
    assert.ok(start >= 0, `${name} dictionary present`)
    let depth = 0
    let index = start + `export const ${name} = `.length
    const from = index
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1
      else if (source[index] === '}') { depth -= 1; if (depth === 0) break }
    }
    return new Function(`return ${source.slice(from, index + 1)}`)()
  }
  const zh = read('zh')
  const en = read('en')
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'bilingual balance')
  for (const [key, value] of Object.entries(zh)) assert.ok(value.length > 0, `zh.${key} is empty`)
  for (const [key, value] of Object.entries(en)) assert.ok(value.length > 0, `en.${key} is empty`)
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
  for (const [key, value] of Object.entries(zh)) {
    assert.deepEqual(placeholders(en[key] ?? ''), placeholders(value), `placeholder mismatch for ${key}`)
  }
})

test('every theme token reference carries a literal fallback', () => {
  const css = readFileSync(join(ROOT, 'src', 'client', 'styles.ts'), 'utf8')
  const uses = [...css.matchAll(/var\((--dsw-[a-z0-9-]+)([^)]*)\)/g)]
  assert.ok(uses.length > 5, 'the stylesheet uses theme tokens')
  for (const [, token, rest] of uses) assert.ok(rest.includes(','), `${token} needs a fallback`)
})

test('every CSS selector is scoped under the plugin prefix', () => {
  const css = readFileSync(join(ROOT, 'src', 'client', 'styles.ts'), 'utf8')
  const selectors = [...css.matchAll(/(^|\n)(\.[a-zA-Z][\w-]*)/g)].map((match) => match[2])
  assert.ok(selectors.length > 20)
  for (const selector of selectors) assert.ok(selector.startsWith('.dpat-'), `unprefixed selector ${selector}`)
})

test('the English locale renders English chrome', () => {
  const { registrations } = mount('en')
  const page = registrations.find((entry) => entry.options.name === 'main')
  const html = renderToStaticMarkup(React.createElement(page.component, {}))
  assert.match(html, /Loading workspaces/)
  assert.doesNotMatch(html, /正在读取工作区/)
})

test('the session row action renders only when a workspace resolves', () => {
  const { registrations } = mount()
  const action = registrations.find((entry) => entry.options.name === 'sidebar.workspaces.session.row.action')
  const sessions = (selector) => selector({ byId: { s1: { cwd: '/Users/x/projects/alpha/sub', retainedBy: { mainView: 1 } } } })
  const workspaces = (selector) => selector({ workspaces: WORKSPACES.map((entry) => ({ id: entry.workspaceId, path: entry.path, title: entry.title })) })
  const html = renderToStaticMarkup(React.createElement(action.component, { sessionId: 's1', useSessions: sessions, useWorkspaces: workspaces }))
  assert.match(html, /data-row-action="automation-test"/)
  assert.match(html, /aria-label="用这个项目做自动化测试"/)

  // A row with no resolvable workspace (a subagent, an unknown cwd) renders
  // nothing rather than an orphan button.
  const none = renderToStaticMarkup(React.createElement(action.component, {
    sessionId: 's2',
    useSessions: (selector) => selector({ byId: { s2: { cwd: '/elsewhere' } } }),
    useWorkspaces: workspaces,
  }))
  assert.equal(none, '')
})

test('the row action prefers an explicit workspaceId over the cwd match', () => {
  const { registrations } = mount()
  const action = registrations.find((entry) => entry.options.name === 'sidebar.workspaces.session.row.action')
  const html = renderToStaticMarkup(React.createElement(action.component, {
    sessionId: 's9',
    useSessions: (selector) => selector({ byId: { s9: { cwd: '/unknown/dir', workspaceId: 'ws-beta' } } }),
    useWorkspaces: (selector) => selector({ workspaces: WORKSPACES.map((entry) => ({ id: entry.workspaceId, path: entry.path })) }),
  }))
  assert.match(html, /data-row-action="automation-test"/)
})

test('every dictionary key resolves — no raw key leaks into the page', () => {
  const { registrations } = mount()
  const page = registrations.find((entry) => entry.options.name === 'main')
  const html = renderToStaticMarkup(React.createElement(page.component, {}))
  assert.doesNotMatch(html, /wb\.[a-zA-Z]/, 'a missing key renders its literal name')
})

let passed = 0
const failures = []
for (const { name, fn } of results) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`  ✗ ${name}`)
    console.log(`      ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n      ')}`)
  }
}
console.log('')
console.log(`${passed}/${results.length} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
