/**
 * The left rail of the workbench: the seven pipeline stages, each showing its
 * completion state, plus the project's coverage facts above them.
 *
 * It is presentational only — the workbench owns the selection and derives the statuses,
 * and this component receives both plus the click handler. That keeps the rail
 * usable in a narrow column without its own state.
 *
 * @module dsh-project-autotest/client/StepRail
 */
import { createElement as h, type ReactNode } from 'react'
import { STEP_IDS, type ProjectState, type StepId, type StepStatus } from '../wire.ts'
import type { Translate } from './locales.ts'

/** Props the workbench hands the rail. */
export interface StepRailProps {
  /** The active workspace's project, for counts. */
  project: ProjectState
  /** The DERIVED stage statuses (never the stored ones, which go stale). */
  status: Record<StepId, StepStatus>
  /** The stage currently shown. */
  active: StepId
  /** Namespace-bound translator. */
  t: Translate
  /** Stage titles (content module), in the active language. */
  titles: Record<StepId, string>
  /** Jump to a stage. */
  onSelect: (id: StepId) => void
}

/**
 * The status glyph: a filled circle for done, a ring for doing, a dot for todo.
 *
 * Exported because the stage head shows the same derived status as a pill, and
 * two glyphs for one status that could drift apart would be a bug waiting.
 */
export function StatusDot({ status }: { status: StepStatus }): ReactNode {
  return h('span', {
    className: `dpat-status dpat-status-${status}`,
    'aria-hidden': 'true',
  })
}

/**
 * Render the stage rail.
 * @param props - the project, the selection, the copy and the handler.
 * @returns the rail element.
 */
export function StepRail({ project, status, active, t, titles, onSelect }: StepRailProps): ReactNode {
  return h(
    'nav',
    { className: 'dpat-rail', 'aria-label': t('page.allSteps') },
    h(
      'div',
      { className: 'dpat-railMeta' },
      h('span', { className: 'dpat-railLabel' }, t('wb.coverageTarget')),
      h('span', { className: 'dpat-railValue' }, `${project.coverageTarget}%`),
      h('span', { className: 'dpat-railLabel' }, t('wb.cases')),
      h('span', { className: 'dpat-railValue' }, String(project.cases.length)),
    ),
    h(
      'ol',
      { className: 'dpat-railList' },
      STEP_IDS.map((id, index) =>
        h(
          'li',
          { key: id },
          h(
            'button',
            {
              type: 'button',
              className: 'dpat-railItem',
              'data-step': id,
              'aria-current': id === active ? 'step' : 'false',
              onClick: () => onSelect(id),
            },
            h('span', { className: 'dpat-railIndex', 'aria-hidden': 'true' }, String(index + 1)),
            h('span', { className: 'dpat-railTitle' }, titles[id]),
            h(StatusDot, { status: status[id] }),
          ),
        ),
      ),
    ),
  )
}
