/**
 * dsh-project-autotest — client half.
 *
 * THREE registrations, one shared command bus:
 *
 * - **`sidebar.panellist`** — the 「自动化测试」 row opens the workbench.
 * - **`main`** keyed by that same row id — the workbench page.
 * - **`sidebar.workspaces.session.row.action`** — a per-row 「测试」 button that
 *   selects the workbench and focuses THAT row's workspace, which is the
 *   "click a workspace to switch project" gesture.
 *
 * The bus is the glue: a module-level object whose `focusWorkspace` the
 * workbench replaces on mount. The row action lives in a different slot
 * instance than the workbench, so a shared module is the only common place they
 * can meet.
 *
 * Registration rides `slots.inject`, which runs the callback when the declaring
 * slot is already on the ledger and otherwise defers it until the declaring
 * `register()` commits; a plain `register` would race the shell.
 *
 * Services: `slots` (both seats), `locale` (copy), and `layout` (selecting the
 * panel). `layout` is read with `ctx.get` because a Host-only composition has
 * no page — the workbench then simply renders where the main slot dispatches it.
 */
import type { ReactNode } from 'react'
import { SessionRowAction } from './SessionRowAction.tsx'
import { FlowIcon } from './FlowIcon.tsx'
import { Workbench, type WorkbenchCommand } from './Workbench.tsx'
import { LOCALE_NS, bindTranslator, en, zh } from './locales.ts'
import { insertStyles } from './styles.ts'
import { PANEL_ID } from '../wire.ts'

/** The sidebar's global panel icon list; each id addresses a `main` panel. */
export const PANEL_LIST_SLOT = 'sidebar.panellist'

/** The central column, dispatched by the selected sidebar id. */
export const MAIN_SLOT = 'main'

/** The hover strip at the end of one Session row. */
export const ROW_ACTION_SLOT = 'sidebar.workspaces.session.row.action'

/** The shared command bus (see the module note). */
export const commands: WorkbenchCommand = { focusWorkspace: () => {} }

/** The services this half needs before it mounts. */
export const inject = ['slots', 'locale']

/** The structural face of the client context this half uses. */
interface ClientContext {
  effect(callback: () => (() => void) | void, label?: string): void
  get(name: string): unknown
  slots: {
    inject(slot: string, callback: () => () => void): () => void
    register(options: { name: string; id?: string; key?: string; order?: number; locale?: string; label?: () => string }, component: (props: never) => ReactNode): () => void
  }
  locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void
    bind(ns: string): (key: string, params?: Record<string, string | number>) => string
    getSnapshot(): { active: string }
    subscribe(listener: () => void): () => void
  }
}

/**
 * Client plugin body: register the two panel seats and the row action, plus the
 * copy and the stylesheet.
 * @param ctx - client root context carrying the slot registry and the locale.
 */
export function apply(ctx: ClientContext): void {
  const removeStyles = insertStyles()
  ctx.effect(() => removeStyles, 'dsh-project-autotest: stylesheet')

  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-project-autotest: dictionaries')

  const t = bindTranslator(ctx.locale)

  // Selecting the workbench panel from a place that is not the panel list: the
  // row action calls this before focusing the workspace.
  const selectPanel = (): void => {
    const layout = ctx.get('layout') as { selectPanel?: (id: string) => void } | undefined
    try {
      layout?.selectPanel?.(PANEL_ID)
    } catch {
      // An unregistered key is the shell's business; the panel list still works.
    }
  }

  // The bus: the workbench swaps in its real handler on mount; the row action
  // selects the panel first, then asks the workbench to focus the workspace.
  const bus: WorkbenchCommand = {
    focusWorkspace(workspaceId: string) {
      selectPanel()
      commands.focusWorkspace(workspaceId)
    },
  }

  const panel = (props: never): ReactNode =>
    Workbench({ ...(props as Record<string, unknown>), t, locale: ctx.locale, commands } as never)

  // 1. The sidebar row, last in the shipped group (Plugins 0, Schedules 10,
  //    Project notes 20).
  ctx.effect(
    () => ctx.slots.inject(PANEL_LIST_SLOT, () => ctx.slots.register({
      name: PANEL_LIST_SLOT,
      id: PANEL_ID,
      order: 30,
      locale: LOCALE_NS,
      label: () => t('entry.label'),
    }, (props: never): ReactNode => FlowIcon(props))),
    'dsh-project-autotest: sidebar row',
  )

  // 2. The workbench itself. The key must equal the sidebar id.
  ctx.effect(
    () => ctx.slots.inject(MAIN_SLOT, () => ctx.slots.register({
      name: MAIN_SLOT,
      key: PANEL_ID,
      locale: LOCALE_NS,
    }, panel)),
    'dsh-project-autotest: workbench panel',
  )

  // 3. The per-row 「测试」 button. Order 50 seats it before the shipped pin
  //    (200) and archive (100) so the project-scoped action reads first.
  ctx.effect(
    () => ctx.slots.inject(ROW_ACTION_SLOT, () => ctx.slots.register({
      name: ROW_ACTION_SLOT,
      id: 'automation-test',
      order: 50,
      locale: LOCALE_NS,
      label: () => t('rowAction.test'),
    }, (props: never): ReactNode => SessionRowAction({ ...(props as Record<string, unknown>), t, commands: bus } as never))),
    'dsh-project-autotest: session row action',
  )
}
