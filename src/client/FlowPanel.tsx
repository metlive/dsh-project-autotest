/**
 * The flow page: the body of the `main` panel the sidebar row opens.
 *
 * Two views over the same seven steps, switched by a segmented control:
 *
 * - **分步详解** (`detail`) — one step at a time: its figure, summary,
 *   input/output, key practices and its pitfall, plus previous/next and a
 *   numbered rail for jumping around. A step can also be reached by URL hash
 *   (`#step-scripts`), so a link from elsewhere opens the right step.
 * - **流程总览** (`overview`) — the seven-step pipeline and one compact card per
 *   step, which is the "one page" reading.
 *
 * The component owns no fetch and no global state: content is static module
 * data, and the only runtime input is the active locale (through the injected
 * translator and `useSyncExternalStore` on the locale service). That keeps the
 * panel usable with no Session and no workspace, which is the point of putting
 * the entrance in the always-mounted sidebar.
 *
 * @module dsh-project-autotest/client/FlowPanel
 */
import {
  createElement as h,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import type { Translate } from './locales.ts'
import { contentFor, type Step } from './content.ts'
import { flowPipeline, stepFigure } from './figures.tsx'
import { ButtonIcon } from './ButtonIcon.tsx'

/** A minimal locale-face view: what the panel needs to follow the active locale. */
export interface LocaleFace {
  getSnapshot(): { active: string }
  subscribe(listener: () => void): () => void
}

/** Props the `main` slot composes for this panel. */
export interface FlowPanelProps {
  /** Namespace-bound translator, supplied because the registration declares a locale. */
  t?: Translate
  /** The locale service, read so the page's content follows the active language. */
  locale?: LocaleFace
}

/** Which of the two views is showing. */
type View = 'detail' | 'overview'

/** The DOM id prefix for a step, mirrored by {@link stepSlug}. */
const STEP_ID_PREFIX = 'step-'

/** Turn a step id into a plain DOM id (`step-scripts` → `step-scripts`). */
function stepSlug(step: Step): string {
  return step.id.startsWith(STEP_ID_PREFIX) ? step.id : `${STEP_ID_PREFIX}${step.id}`
}

/**
 * A section card with a title row.
 *
 * Declared lowercase on purpose: this module composes elements with
 * `createElement` directly (there is no JSX runtime to instantiate a UPPERCASE
 * component), so helpers like this one must be CALLED, not passed as element
 * types. A capitalised call would put a function object in the tree where an
 * element belongs, and the panel would render nothing.
 */
function card(title: ReactNode, children: ReactNode, className?: string): ReactNode {
  return h(
    'section',
    { className: `dpat-card${className === undefined ? '' : ` ${className}`}` },
    h('h4', { className: 'dpat-cardTitle' }, title),
    children,
  )
}

/**
 * One labelled key/value row (输入 / 产出).
 *
 * Called, never passed as an element type — see {@link card}.
 */
function field(label: string, value: string): ReactNode {
  return h(
    'div',
    { className: 'dpat-field' },
    h('span', { className: 'dpat-fieldLabel' }, label),
    h('span', { className: 'dpat-fieldValue' }, value),
  )
}

/** The badge that carries a step's number. */
function StepBadge({ number }: { number: number }): ReactNode {
  return h('span', { className: 'dpat-badge', 'aria-hidden': 'true' }, String(number))
}

/**
 * Render the automation-testing flow page.
 * @param props - the slot-composed props; `t` and `locale` come from the runtime.
 * @returns the page element.
 */
export function FlowPanel(props: FlowPanelProps): ReactNode {
  const t: Translate = props.t ?? ((key: string) => key)
  const locale = props.locale

  // Follow the active locale without subscribing at apply time: the snapshot is
  // read on render, and a dictionary registration or a locale switch bumps the
  // revision the face publishes.
  //
  // The third argument is NOT optional in practice: React 18 requires a
  // `getServerSnapshot` while server rendering and THROWS without it, and the
  // shell renders its frame through `renderToStaticMarkup` — that throw blanks
  // the whole slot entry (the empty panel the user saw). It reads the same
  // snapshot, so the server pass and the client agree.
  const readLocale = useCallback((): string => locale?.getSnapshot().active ?? 'zh', [locale])
  const subscribeLocale = useCallback(
    (listener: () => void): (() => void) => locale?.subscribe(listener) ?? (() => {}),
    [locale],
  )
  const activeLocale = useSyncExternalStore(subscribeLocale, readLocale, readLocale)
  const content = useMemo(() => contentFor(activeLocale), [activeLocale])
  const steps = content.steps
  const total = steps.length

  const [view, setView] = useState<View>('detail')
  const [index, setIndex] = useState(0)

  // A hash on load (or a later `hashchange` from a link) selects that step and
  // switches to the detail view. Reading `location` is guarded so a test
  // renderer without a DOM still works.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const apply = (): void => {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash === '') return
      const found = steps.findIndex((step) => stepSlug(step) === hash)
      if (found < 0) return
      setView('detail')
      setIndex(found)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [steps])

  const go = useCallback(
    (next: number) => {
      setView('detail')
      setIndex((current) => {
        const clamped = Math.min(total - 1, Math.max(0, next))
        // Keep the URL hash in step with the visible step, without adding a
        // history entry for every click.
        if (typeof window !== 'undefined') {
          const slug = steps[clamped] === undefined ? '' : stepSlug(steps[clamped])
          if (slug !== '' && window.location.hash !== `#${slug}`) {
            window.history.replaceState(null, '', `#${slug}`)
          }
        }
        return clamped
      })
    },
    [steps, total],
  )

  const step = steps[index] ?? steps[0]

  const onTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const next: View = view === 'detail' ? 'overview' : 'detail'
      setView(next)
      // Move focus with the selection, as the host's segmented tabs do.
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      for (const button of buttons) if (button.dataset.view === next) button.focus()
    },
    [view],
  )

  const tabs = h(
    'div',
    {
      className: 'dpat-tabs',
      role: 'tablist',
      'aria-label': t('page.title'),
      onKeyDown: onTabKeyDown,
    },
    (['detail', 'overview'] as const).map((value) =>
      h(
        'button',
        {
          key: value,
          type: 'button',
          role: 'tab',
          className: 'dpat-tab',
          'data-view': value,
          'aria-selected': view === value,
          tabIndex: view === value ? 0 : -1,
          onClick: () => setView(value),
        },
        t(value === 'detail' ? 'page.tab.detail' : 'page.tab.overview'),
      ),
    ),
  )

  const nav = h(
    'div',
    { className: 'dpat-nav', role: 'group', 'aria-label': t('page.stepCount', { index: index + 1, total }) },
    h(
      'button',
      {
        type: 'button',
        className: 'dpat-btn',
        disabled: view === 'detail' && index === 0,
        onClick: () => go(index - 1),
      },
      h(ButtonIcon, { name: 'prev' }),
      h('span', null, t('page.prev')),
    ),
    h('span', { className: 'dpat-navCount', 'aria-live': 'polite' }, t('page.stepCount', { index: index + 1, total })),
    h(
      'button',
      {
        type: 'button',
        className: 'dpat-btn dpat-btnPrimary',
        disabled: view === 'detail' && index === total - 1,
        onClick: () => go(index + 1),
      },
      h('span', null, t('page.next')),
      h(ButtonIcon, { name: 'next' }),
    ),
  )

  const rail = h(
    'nav',
    { className: 'dpat-rail', 'aria-label': t('page.allSteps') },
    h(
      'ol',
      null,
      steps.map((entry, position) =>
        h(
          'li',
          { key: entry.id },
          h(
            'button',
            {
              type: 'button',
              className: 'dpat-railItem',
              'aria-current': position === index ? 'step' : 'false',
              onClick: () => go(position),
            },
            h(StepBadge, { number: entry.number }),
            h('span', { className: 'dpat-railTitle' }, entry.title),
          ),
        ),
      ),
    ),
  )

  const detail =
    step === undefined
      ? null
      : h(
        'article',
        { className: 'dpat-step', id: stepSlug(step), 'aria-labelledby': `${stepSlug(step)}-title` },
        h(
          'header',
          { className: 'dpat-stepHead' },
          h(StepBadge, { number: step.number }),
          h(
            'div',
            { className: 'dpat-stepHeadText' },
            h('h3', { className: 'dpat-stepTitle', id: `${stepSlug(step)}-title` }, step.title),
            h('p', { className: 'dpat-stepSummary' }, step.summary),
          ),
        ),
        h(
          'figure',
          { className: 'dpat-figureBox' },
          stepFigure(step.figure, step.title),
          h('figcaption', { className: 'dpat-figCaption' }, t('page.legend')),
        ),
        h(
          'div',
          { className: 'dpat-fields' },
          field(t('page.input'), step.input),
          field(t('page.output'), step.output),
        ),
        h(
          'div',
          { className: 'dpat-grid' },
          card(
            t('page.practices'),
            h(
              'ul',
              { className: 'dpat-list' },
              step.practices.map((line, position) =>
                h('li', { key: position }, h('span', { className: 'dpat-dot', 'aria-hidden': 'true' }), line),
              ),
            ),
          ),
          card(t('page.pitfall'), h('p', { className: 'dpat-warnText' }, step.pitfall), 'dpat-cardWarn'),
        ),
        nav,
      )

  const overview = h(
    'div',
    { className: 'dpat-overview' },
    h(
      'section',
      { className: 'dpat-card dpat-cardWide' },
      h('h4', { className: 'dpat-cardTitle' }, t('page.flowTitle')),
      flowPipeline(steps.map((entry) => entry.title), t('page.flowTitle')),
      h('p', { className: 'dpat-thesis' }, content.thesis),
    ),
    h(
      'div',
      { className: 'dpat-overviewGrid' },
      steps.map((entry) =>
        h(
          'button',
          {
            key: entry.id,
            type: 'button',
            className: 'dpat-overviewCard',
            onClick: () => go(entry.number - 1),
          },
          h(
            'span',
            { className: 'dpat-overviewHead' },
            h(StepBadge, { number: entry.number }),
            h('span', { className: 'dpat-overviewTitle' }, entry.title),
          ),
          h('span', { className: 'dpat-overviewSummary' }, entry.summary),
          stepFigure(entry.figure, entry.title),
          h(
            'span',
            { className: 'dpat-overviewMeta' },
            h('span', { className: 'dpat-fieldLabel' }, t('page.output')),
            entry.output,
          ),
        ),
      ),
    ),
    nav,
  )

  return h(
    'div',
    { className: 'dpat-root' },
    h(
      'header',
      { className: 'dpat-head' },
      h(
        'div',
        { className: 'dpat-headText' },
        h('h2', { className: 'dpat-title' }, t('page.title')),
        h('p', { className: 'dpat-subtitle' }, t('page.subtitle')),
      ),
    ),
    tabs,
    h(
      'div',
      { className: 'dpat-body' },
      view === 'detail' ? rail : null,
      h('div', { className: 'dpat-scroll', role: 'tabpanel', 'aria-label': t(view === 'detail' ? 'page.tab.detail' : 'page.tab.overview') },
        h(Fragment, null, view === 'detail' ? detail : overview)),
    ),
  )
}
