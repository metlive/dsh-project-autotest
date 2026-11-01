/**
 * The sidebar entrance: one icon button in the hover strip of every Session
 * row, which jumps to that Session's workspace in the automation-test
 * workbench.
 *
 * Why a row action and not just the panel-list row: the panel list opens the
 * workbench, but "test THIS project" is a per-project gesture, and the Session
 * row is where a project is named. Clicking here does not open the
 * conversation — the slot catalog says clicks inside the strip stay in the
 * strip — it selects the workbench panel and focuses that workspace.
 *
 * The button renders nothing for a row whose workspace cannot be resolved, so a
 * subagent row (which has no workspace of its own) shows no orphan action.
 *
 * @module dsh-project-autotest/client/SessionRowAction
 */
import { createElement as h, useMemo, type ReactNode } from 'react'
import { FlowIcon } from './FlowIcon.tsx'
import type { WorkbenchCommand } from './Workbench.tsx'

/** The session-list face the row action reads through the composed hook. */
interface SessionListLike {
  ids?: string[]
  byId?: Record<string, { cwd?: string; workspaceId?: string } | undefined>
}

/** One workspace as the composed `useWorkspaces` snapshot reports it. */
interface WorkspaceLike {
  id?: string
  workspaceId?: string
  path?: string
  title?: string
}

/** The workspace snapshot, narrowed to what this button reads. */
interface WorkspaceSnapshotLike {
  workspaces?: readonly WorkspaceLike[]
  byId?: Record<string, WorkspaceLike>
  workspaceIds?: readonly string[]
  activeWorkspaceId?: string | null
}

/** Props the `sidebar.workspaces.session.row.action` seat composes. */
export interface SessionRowActionProps {
  /** The row's session; supplied by the seat's owner props. */
  sessionId?: string
  /** Namespace-bound translator. */
  t?: (key: string) => string
  /** The session-list selector hook. */
  useSessions?: <T>(selector: (state: SessionListLike) => T) => T
  /** The workspace-registry selector hook. */
  useWorkspaces?: <T>(selector: (state: WorkspaceSnapshotLike) => T) => T
  /** The composed command bus, wired by the client entry. */
  commands?: WorkbenchCommand
}

/** Normalize one workspace record from either snapshot shape. */
function normalizeWorkspace(value: WorkspaceLike | undefined): { id: string; path: string } | null {
  if (value === undefined) return null
  const id = value.id ?? value.workspaceId
  if (id === undefined) return null
  return { id, path: value.path ?? '' }
}

/**
 * Find the workspace a session belongs to: an explicit `workspaceId` on the
 * summary first, then the workspace whose path contains the session's cwd.
 * @param sessionId - the row's session.
 * @param sessions - the session-list snapshot.
 * @param workspaces - the workspace snapshot.
 * @returns the workspace id, or null when none can be named.
 */
export function resolveSessionWorkspace(
  sessionId: string | undefined,
  sessions: SessionListLike | undefined,
  workspaces: WorkspaceSnapshotLike | undefined,
): string | null {
  if (sessionId === undefined) return null
  const summary = sessions?.byId?.[sessionId]
  const explicit = summary?.workspaceId
  if (typeof explicit === 'string' && explicit !== '') return explicit

  const cwd = summary?.cwd
  if (cwd === undefined || cwd === '') return null
  const list: WorkspaceLike[] = workspaces?.workspaces !== undefined
    ? [...workspaces.workspaces]
    : (workspaces?.workspaceIds ?? Object.keys(workspaces?.byId ?? {})).map((id) => workspaces?.byId?.[id] ?? { workspaceId: id })
  let best: { id: string; length: number } | null = null
  for (const entry of list) {
    const workspace = normalizeWorkspace(entry)
    if (workspace === null || workspace.path === '') continue
    const root = workspace.path.replace(/[\\/]+$/, '')
    if (cwd === root || cwd.startsWith(`${root}/`) || cwd.startsWith(`${root}\\`)) {
      if (best === null || root.length > best.length) best = { id: workspace.id, length: root.length }
    }
  }
  return best?.id ?? null
}

/**
 * Render the row action.
 * @param props - the seat's owner props, the standard kit's hooks, and the bus.
 * @returns the button, or null when the row has no project to test.
 */
export function SessionRowAction(props: SessionRowActionProps): ReactNode {
  const sessions = props.useSessions?.((state) => state)
  const workspaces = props.useWorkspaces?.((state) => state)
  const label = props.t?.('rowAction.test') ?? 'Test this project'
  const workspaceId = useMemo(
    () => resolveSessionWorkspace(props.sessionId, sessions, workspaces),
    [props.sessionId, sessions, workspaces],
  )
  if (workspaceId === null) return null
  return h(
    'button',
    {
      type: 'button',
      className: 'dpat-rowAction',
      'data-row-action': 'automation-test',
      'aria-label': label,
      title: label,
      onClick: (event: { preventDefault?: () => void; stopPropagation?: () => void }) => {
        event.preventDefault?.()
        event.stopPropagation?.()
        props.commands?.focusWorkspace(workspaceId)
      },
    },
    h(FlowIcon, { size: 14 }),
  )
}
