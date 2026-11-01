/**
 * Build both halves of dsh-project-autotest into `lib/`.
 *
 *   node scripts/build.mjs
 *
 * - **`lib/index.js`** — the host half: one ESM module for Node. The plugin's
 *   own modules are inlined; `node:` builtins stay as imports.
 * - **`lib/client.js`** — the browser half, wrapped in the DSH client-bundle
 *   contract: `window.__ModuleLoader__.load({ id, factory })`, where `factory`
 *   is a CJS closure receiving a `require` bound to the shell's shared module
 *   table. Everything the shell shares is required from that table; the
 *   plugin's own modules are inlined.
 *
 * Transpiling goes through the TypeScript compiler API (`ts.transpileModule`),
 * resolved from this package's devDependencies or a sibling checkout. The
 * build emits only; it does not type-check.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const LIB = join(ROOT, 'lib')

const require = createRequire(import.meta.url)

/** Where `typescript` is looked up, in order. */
const TS_CANDIDATES = [
  join(ROOT, 'node_modules', 'typescript'),
  '/Users/metlive/wwwroot/dsh-project-notes/node_modules/typescript',
]
const ts = loadTypeScript()

/** Resolve the TypeScript compiler API. */
function loadTypeScript() {
  for (const candidate of TS_CANDIDATES) {
    try {
      return require(candidate)
    } catch {
      // try the next candidate
    }
  }
  try {
    return require('typescript')
  } catch {
    throw new Error('build: cannot resolve "typescript"; install it or set NODE_PATH')
  }
}

/** The client bundle's identity in the shell's module table: the package name. */
const CLIENT_ID = 'dsh-project-autotest'

/** Modules the shell shares through its module table; everything else inlines. */
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime']

/** The client modules, in dependency order (`client/index` last). */
const CLIENT_MODULES = [
  'wire.ts',
  'zip.ts',
  'unzip.ts',
  'importers.ts',
  'client/locales.ts',
  'client/content.ts',
  'client/figures.tsx',
  'client/FlowIcon.tsx',
  'client/api.ts',
  'client/styles.ts',
  'client/StepRail.tsx',
  'client/ImportPanel.tsx',
  'client/DocumentsPanel.tsx',
  'client/Workbench.tsx',
  'client/SessionRowAction.tsx',
  'client/index.tsx',
]

/** The host modules, in dependency order. */
const HOST_MODULES = ['wire.ts', 'zip.ts', 'unzip.ts', 'importers.ts', 'export.ts', 'report.ts', 'index.ts']

/**
 * Transpile one TypeScript/TSX module to ESM JavaScript.
 * @param source - the module source.
 * @param fileName - the source's path, which selects the JSX mode.
 * @returns the transpiled JavaScript.
 */
function transpile(source, fileName) {
  const result = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
      removeComments: false,
    },
  })
  if (result.diagnostics !== undefined && result.diagnostics.length > 0) {
    const message = ts.formatDiagnostics(result.diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => '\n',
    })
    throw new Error(`build: ${fileName}\n${message}`)
  }
  return result.outputText
}

/** Read one source file relative to `src/`. */
async function readSrc(relativePath) {
  const fileName = join(SRC, relativePath)
  return transpile(await readFile(fileName, 'utf8'), fileName)
}

/**
 * Turn a relative specifier into a module-table key.
 * @param fromId - the importing module's key.
 * @param specifier - the relative specifier (with or without a `.ts`/`.tsx` tail).
 * @returns the target module's key.
 */
function resolveKey(fromId, specifier) {
  const fromDir = fromId.includes('/') ? fromId.slice(0, fromId.lastIndexOf('/')) : ''
  return join(fromDir, specifier).replace(/\.tsx?$/, '').replace(/^\.\//, '')
}

/** Namespace variable for a module of the shell's shared table. */
function externalKey(specifier) {
  return `__ext_${specifier.replace(/[^\w]/g, '_')}`
}

/** Namespace variable for one inlined module. */
function moduleKey(key) {
  return `__mod_${key.replace(/[^\w]/g, '_')}`
}

/**
 * Strip `export` keywords from a module body so its top-level bindings become
 * plain locals inside the enclosing closure, and drop the export tables.
 * @param code - the transpiled module.
 * @returns the module with its `export ` prefixes removed.
 */
function inlineModule(code) {
  return code
    .replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\s)/gm, '')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+default\s+/gm, 'const __default__ = ')
}

/**
 * Rewrite one client module's imports for the inlined bundle.
 *
 * Each `import` line becomes a destructuring `const`. Aliased bindings
 * (`jsx as _jsx`, emitted for the automatic JSX runtime) are re-declared with
 * their local name through a separate assignment.
 * @param code - the transpiled module.
 * @param moduleId - the module's key.
 * @param table - the set of module keys being bundled.
 * @returns the code with its imports rewritten.
 */
function rewriteImports(code, moduleId, table) {
  return code
    .replace(
      /^import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2;?$/gm,
      (match, specifiers, _quote, specifier) => {
        const pairs = specifiers
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => name.split(/\s+as\s+/).map((part) => part.trim()))
        const pattern = pairs.map(([imported]) => imported).join(', ')
        const aliases = pairs
          .filter((pair) => pair[1] !== undefined)
          .map(([imported, local]) => `${local} = ${imported}`)
          .join(', ')
        if (specifier.startsWith('.')) {
          const key = resolveKey(moduleId, specifier)
          if (!table.has(key)) throw new Error(`client bundle: ${moduleId} imports unknown module ${specifier}`)
          return `const { ${pattern}${aliases === '' ? '' : `, ${aliases}`} } = ${moduleKey(key)};`
        }
        if (!CLIENT_EXTERNALS.includes(specifier)) {
          throw new Error(`client bundle: ${moduleId} imports "${specifier}", which this bundle does not share`)
        }
        return `const { ${pattern}${aliases === '' ? '' : `, ${aliases}`} } = ${externalKey(specifier)};`
      },
    )
    .replace(/^import\s*(['"])([^'"]+)\1;?$/gm, (match, _quote, specifier) => `/* side-effect import of ${specifier} */`)
}

/**
 * Collect the exported names of one transpiled ES module.
 * @param code - the transpiled module.
 * @returns the export table entries.
 */
function exportedNames(code) {
  const names = new Set()
  // `export async function` is a top-level declaration too: omitting it dropped
  // every async export from the module table and the caller saw `undefined`.
  for (const match of code.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(match[1])
  }
  for (const match of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const specifier of match[1].split(',')) {
      const trimmed = specifier.trim()
      if (trimmed === '') continue
      const [local, exported] = trimmed.split(/\s+as\s+/).map((part) => part.trim())
      names.add(`"${exported ?? local}": ${local}`)
    }
  }
  return [...names]
}

/**
 * Build the client bundle source.
 * @param modules - the client modules, in dependency order.
 * @returns the wrapped bundle.
 */
function buildClientBundle(modules) {
  const table = new Set(modules.map((entry) => entry.id))
  const declarations = modules
    .map((entry) => {
      const names = exportedNames(entry.code)
      const body = rewriteImports(inlineModule(entry.code), entry.id, table)
        .split('\n')
        .map((line) => `\t\t\t${line}`)
        .join('\n')
      return `\t\tvar ${moduleKey(entry.id)} = (() => {\n${body}\n\t\t\treturn { ${names.join(', ')} };\n\t\t})();`
    })
    .join('\n')

  const externals = CLIENT_EXTERNALS
    .map((name) => `\t\tvar ${externalKey(name)} = require(${JSON.stringify(name)});`)
    .join('\n')

  return `/* dsh-project-autotest — client bundle (generated by scripts/build.mjs; do not edit). */
window.__ModuleLoader__.load({
\tid: ${JSON.stringify(CLIENT_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${externals}
${declarations}
\t\tObject.assign(exports, ${moduleKey('client/index')});
\t\treturn module.exports;
\t}
});
`
}

/** Merge `import { a, b } from 'node:x'` lines into one line per specifier. */
function mergeBuiltinImports(lines) {
  const bySpecifier = new Map()
  for (const line of lines) {
    const match = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?$/.exec(line.trim())
    if (match === null) continue
    const names = bySpecifier.get(match[2]) ?? new Set()
    for (const name of match[1].split(',').map((part) => part.trim()).filter(Boolean)) names.add(name)
    bySpecifier.set(match[2], names)
  }
  return [...bySpecifier]
    .map(([specifier, names]) => `import { ${[...names].sort().join(', ')} } from '${specifier}';`)
    .join('\n')
}

/**
 * Build the host half into one ESM module.
 *
 * Two kinds of imports appear: `node:` builtins (hoisted into one deduped
 * header) and the plugin's own relative modules (inlined in order, with their
 * import lines stripped — the bindings are already top-level in the closure).
 */
async function buildHost() {
  const parts = []
  const builtinImports = new Set()
  for (const id of HOST_MODULES) {
    const code = await readSrc(id)
    const withoutImports = code
      .replace(/^import\s*\{[^}]*\}\s*from\s*'node:[^']*';?$/gm, (match) => {
        builtinImports.add(match)
        return ''
      })
      .replace(/^import\s*\{[^}]*\}\s*from\s*'\.\/[^']*';?$/gm, '')
    parts.push(`// ---- ${id} ----\n${inlineModule(withoutImports)}`)
  }
  const header = `/**
 * dsh-project-autotest — host half (generated by scripts/build.mjs; do not edit).
 *
 * Bundled from src/: the plugin's own modules are inlined, while \`node:\`
 * builtins stay as imports (the profile's plugin loader provides them).
 */
${mergeBuiltinImports(builtinImports)}
`
  return `${header}
${parts.join('\n')}
// The plugin rows in cordis.patch.yml reference this name; the loader reads
// \`inject\` before calling \`apply(ctx)\`.
export { name, inject, apply, createApi, isTrustedRequest, readBody, API_PREFIX };
`
}

/** Run the build. */
async function main() {
  await rm(LIB, { recursive: true, force: true })
  await mkdir(LIB, { recursive: true })

  // A build stamp: the Host prints it at activation, so "is the running Host on
  // the current build?" is answerable from one log line instead of inference.
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const host = (await buildHost()).replaceAll('__BUILD_STAMP__', stamp)
  await writeFile(join(LIB, 'index.js'), host, 'utf8')

  const clientModules = []
  for (const id of CLIENT_MODULES) clientModules.push({ id: id.replace(/\.tsx?$/, ''), code: await readSrc(id) })
  await writeFile(join(LIB, 'client.js'), buildClientBundle(clientModules), 'utf8')

  console.log('built lib/index.js and lib/client.js')
}

await main()
