/**
 * The workbench's left stage navigation, plus the KPI line that heads the
 * content column. Both are presentational: the workbench owns the selection,
 * derives the statuses and assembles the per-stage copy; this module only
 * renders it.
 *
 * The four stages live in one left column, grouped as "prepare" (1, 2) and
 * "run & review" (3, 4) — the top bar never carries a stage bar. The KPI line
 * is a sibling in the right column, not part of the nav, so the rail keeps its
 * own scroll/height without being pushed around by the project's numbers.
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
  /** "Owner · derived status" line under each title, assembled by the workbench. */
  subtitles: Record<StepId, string>
  /** Absolute project.json path; the footer shows its last three segments. */
  storagePath: string
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
 * The four project facts, as one horizontal line at the top of the content column.
 * `dpat-railMeta` stays as a class so existing selectors keep resolving.
 */
export function StepKpi({ project, status, active, t }: Pick<StepRailProps, 'project' | 'status' | 'active' | 't'>): ReactNode {
  const executed = project.cases.filter((item) => item.result !== 'untested').length
  return h(
    'div',
    { className: 'dpat-kpi dpat-railMeta' },
    h('div', { className: 'dpat-kpiItem' },
      h('span', { className: 'dpat-kpiNum' }, `${project.coverageTarget}%`),
      h('span', { className: 'dpat-kpiLabel' }, t('wb.coverageTarget'))),
    h('div', { className: 'dpat-kpiItem' },
      h('span', { className: 'dpat-kpiNum' }, String(project.cases.length)),
      h('span', { className: 'dpat-kpiLabel' }, t('wb.cases'))),
    h('div', { className: 'dpat-kpiItem' },
      h('span', { className: 'dpat-kpiNum' }, String(executed)),
      h('span', { className: 'dpat-kpiLabel' }, t('wb.executed'))),
    h('div', { className: 'dpat-kpiItem' },
      h('span', { className: 'dpat-kpiNum' }, String(project.defects.length)),
      h('span', { className: 'dpat-kpiLabel' }, t('wb.defects'))),
    h('span', { className: 'dpat-kpiNote' },
      t('wb.currentStage', { current: STEP_IDS.indexOf(active) + 1, total: STEP_IDS.length })),
  )
}

/**
 * Render the left rail: two labelled groups of stages and a footer with the
 * derived pipeline progress. Group labels are CSS pseudo-elements on the first
 * item of each group, so the list keeps exactly four clickable items.
 */
export function StepRail({ status, active, t, titles, subtitles, storagePath, onSelect }: StepRailProps): ReactNode {
  const done = STEP_IDS.filter((id) => status[id] === 'done').length
  return h(
    'nav',
    { className: 'dpat-rail', 'aria-label': t('page.allSteps') },
    h(
      'ol',
      { className: 'dpat-railList' },
      STEP_IDS.map((id, index) =>
        h(
          'li',
          {
            key: id,
            'data-group': index === 0 ? t('wb.navGroupPrepare') : index === 2 ? t('wb.navGroupRun') : undefined,
            'data-group-gap': index === 2 ? 'true' : undefined,
          },
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
            h('span', { className: 'dpat-railText' },
              h('span', { className: 'dpat-railTitle' }, titles[id]),
              h('span', { className: 'dpat-railState' }, subtitles[id])),
            h(StatusDot, { status: status[id] }),
          ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dpat-navFoot' },
      h('div', { className: 'dpat-navFootRow' },
        h('span', null, t('wb.progressLabel')),
        h('b', null, `${done}/${STEP_IDS.length}`)),
      h('span', { className: 'dpat-navTrack' },
        h('span', {
          className: 'dpat-navFill',
          style: { width: `${Math.round((done / STEP_IDS.length) * 100)}%` },
        })),
      h('p', null, storagePath.split('/').slice(-3).join('/')),
    ),
  )
}
