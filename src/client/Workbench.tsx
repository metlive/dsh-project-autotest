/**
 * The workbench: a per-workspace, seven-stage automation-test project editor.
 *
 * Structure:
 *
 * - a header with the workspace picker (the "switch project" control), the
 *   save state, the export menu and the storage path;
 * - a left rail listing the seven stages with their status;
 * - the stage body. Stage 3 (design cases) is the full case editor — a
 *   positive/negative tree with per-case steps, expected results and run
 *   verdicts; stage 7 is the defect tracker; every other stage is a working
 *   panel with its guidance, a status and a note.
 *
 * State is owned HERE and nowhere else: one `project` document, one `saved`
 * flag, one in-flight save. Switching workspace replaces the document, and a
 * save always sends the whole document, so no partial-write state exists.
 *
 * @module dsh-project-autotest/client/Workbench
 */
import {
  createElement as h,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  deriveStageStatus,
  makeId,
  projectProgress,
  splitCases,
  STEP_IDS,
  type AutomationLevel,
  type CaseKind,
  type CaseResult,
  type FailReason,
  type CaseTechnique,
  type Defect,
  type DefectStatus,
  type ExportFormat,
  type ProjectState,
  type RegressionResult,
  type StepId,
  type StepStatus,
  type TestCase,
} from '../wire.ts'
import { CONTENT_STEP_TO_STAGE, contentFor } from './content.ts'
import { StatusDot, StepRail } from './StepRail.tsx'
import { flowPipeline } from './figures.tsx'
import { FlowIcon } from './FlowIcon.tsx'
import type { Translate } from './locales.ts'
import { downloadArtifact, exportProject, hostBuild, listDocuments, listWorkspaces, loadProject, saveProject, startRun, type DocumentInput, type ImportPreview, type RunStart } from './api.ts'
import { ImportPanel, type ImportMode } from './ImportPanel.tsx'
import { DocumentsPanel } from './DocumentsPanel.tsx'
import { toTestCase } from '../importers.ts'

/** The in-page commands the sidebar entrance publishes. */
export interface WorkbenchCommand {
  /** Open the workbench on one workspace. */
  focusWorkspace: (workspaceId: string) => void
}

/** Props the `main` slot composes for the workbench. */
export interface WorkbenchProps {
  /** Namespace-bound translator, supplied because the registration declares a locale. */
  t?: Translate
  /** The locale service, read for the active language. */
  locale?: { getSnapshot(): { active: string }; subscribe(fn: () => void): () => void }
  /** The composed command bus, wired by the client entry. */
  commands?: WorkbenchCommand
}

/** The workspace list entry the picker renders. */
interface WorkspaceOption {
  workspaceId: string
  title: string
  path: string
  caseCount: number
  hasProject: boolean
}

/** A click-through "button" that renders the plugin's own glyph. */
function IconButton(props: {
  label: string
  title: string
  className?: string
  onClick: () => void
  children?: ReactNode
}): ReactNode {
  return h(
    'button',
    {
      type: 'button',
      className: `dpat-iconBtn${props.className === undefined ? '' : ` ${props.className}`}`,
      'aria-label': props.label,
      title: props.title,
      onClick: props.onClick,
    },
    props.children,
  )
}

/** A labelled select. */
function Select<T extends string>(props: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}): ReactNode {
  return h(
    'label',
    { className: 'dpat-selectWrap' },
    h('span', { className: 'dpat-selectLabel' }, props.label),
    h(
      'select',
      {
        className: 'dpat-select',
        value: props.value,
        onChange: (event: { target: { value: string } }) => props.onChange(event.target.value as T),
      },
      props.options.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
    ),
  )
}

/** A labelled text input. */
function TextField(props: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}): ReactNode {
  return h(
    'label',
    { className: 'dpat-field' },
    h('span', { className: 'dpat-fieldLabel' }, props.label),
    h('input', {
      className: 'dpat-input',
      type: 'text',
      value: props.value,
      placeholder: props.placeholder ?? '',
      onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
    }),
  )
}

/** A labelled textarea. */
function TextArea(props: {
  label: string
  value: string
  rows?: number
  placeholder?: string
  onChange: (value: string) => void
}): ReactNode {
  return h(
    'label',
    { className: 'dpat-field' },
    h('span', { className: 'dpat-fieldLabel' }, props.label),
    h('textarea', {
      className: 'dpat-input dpat-textarea',
      rows: props.rows ?? 3,
      value: props.value,
      placeholder: props.placeholder ?? '',
      onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
    }),
  )
}

/** The export formats, in menu order. */
const EXPORT_FORMATS: Array<{ value: ExportFormat; zh: string; en: string; hint: string }> = [
  { value: 'xmind', zh: 'XMind 思维导图', en: 'XMind mind map', hint: '.xmind' },
  { value: 'testlink-xml', zh: 'TestLink XML', en: 'TestLink XML', hint: '.xml' },
  { value: 'csv', zh: 'CSV 表格', en: 'CSV sheet', hint: '.csv' },
  { value: 'markdown', zh: 'Markdown 评审页', en: 'Markdown review', hint: '.md' },
]

/** Techniques offered in the case editor. */
const TECHNIQUES: CaseTechnique[] = ['functional', 'boundary', 'equivalence', 'negative', 'performance', 'security']

/** Automation granularity choices (step ①). */
const AUTOMATION_LEVELS: AutomationLevel[] = ['api', 'ui', 'both']

/** Failure attribution choices (step ⑥). */
const FAIL_REASONS: FailReason[] = ['none', 'product', 'script', 'environment']

/** Regression verdicts (step ⑦). */
const REGRESSIONS: RegressionResult[] = ['pending', 'passed', 'failed']

/** Defect lifecycle, in workflow order. */
const DEFECT_STATUSES: DefectStatus[] = ['open', 'in-progress', 'resolved', 'regressing', 'closed']

/**
 * Render the workbench.
 * @param props - the slot-composed props plus the command bus.
 * @returns the page element.
 */
export function Workbench(props: WorkbenchProps): ReactNode {
  const t: Translate = props.t ?? ((key: string) => key)
  // The locale snapshot is read on render; the shell re-renders on a locale
  // change, so no subscription is needed here (and a subscription without a
  // server snapshot would crash the static render).
  const activeLocale = props.locale?.getSnapshot().active ?? 'zh'
  const content = useMemo(() => contentFor(activeLocale), [activeLocale])

  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectState | null>(null)
  const [storagePath, setStoragePath] = useState('')
  const [saved, setSaved] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<StepId>('requirement')
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  /** The Host half's build stamp, or null when it never loaded this plugin. */
  const [hostStamp, setHostStamp] = useState<string | null>(null)
  const [hostReachable, setHostReachable] = useState(true)
  const [runState, setRunState] = useState<'idle' | 'starting' | RunStart>('idle')
  /** Requirement documents on disk, the only stage-① input the Host owns. */
  const [requirementDocs, setRequirementDocs] = useState<DocumentInput[]>([])

  // The latest locale, read by the saver so the report follows the UI language
  // without making `persist` depend on it (which would rebuild every callback).
  const activeLocaleRef = useRef(activeLocale)
  activeLocaleRef.current = activeLocale

  // One in-flight save at a time; a change during a save schedules another.
  const saving = useRef<Promise<void> | null>(null)
  const pendingSave = useRef<ProjectState | null>(null)

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = await listWorkspaces()
      setWorkspaces(list)
      return list
    } catch (cause) {
      setError((cause as Error).message)
      return [] as WorkspaceOption[]
    }
  }, [])

  const openWorkspace = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setWorkspaceId(id)
    try {
      const snapshot = await loadProject(id)
      setProject(snapshot.project)
      // Stage ① is judged from the documents on disk, so fetch them with the
      // project rather than waiting for the panel to mount.
      void listDocuments(id).then(setRequirementDocs).catch(() => setRequirementDocs([]))
      setStoragePath(snapshot.storagePath)
      setSaved(snapshot.existed ? true : false)
      setActiveStep('requirement')
    } catch (cause) {
      setError((cause as Error).message)
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Mount: load the workspace list and open the first one.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await refreshWorkspaces()
      if (cancelled || list.length === 0) {
        if (!cancelled && list.length === 0) setLoading(false)
        return
      }
      await openWorkspace(list[0].workspaceId)
    })()
    return () => { cancelled = true }
  }, [openWorkspace, refreshWorkspaces])

  // Mount: ask which build of the Host half is answering. The page bundle
  // reloads on refresh, the Host module does not, so "the page is newer than
  // the Host" is a real state that must be named instead of guessed at.
  useEffect(() => {
    let cancelled = false
    void hostBuild()
      .then((build) => { if (!cancelled) setHostStamp(build) })
      .catch(() => { if (!cancelled) setHostReachable(false) })
    return () => { cancelled = true }
  }, [])

  // The sidebar entrance calls this to jump straight to a project.
  useEffect(() => {
    if (props.commands === undefined) return undefined
    props.commands.focusWorkspace = (id: string) => {
      void openWorkspace(id)
      // Refresh the picker's counts: another project may have just been edited.
      setExportOpen(false)
    }
    return () => {
      props.commands.focusWorkspace = () => {}
    }
  }, [openWorkspace, props.commands])

  /** Persist the current document, coalescing rapid edits. */
  const persist = useCallback(async (next: ProjectState) => {
    if (saving.current !== null) {
      pendingSave.current = next
      return
    }
    const run = async () => {
      let current: ProjectState | null = next
      while (current !== null) {
        const document = current
        current = null
        try {
          const result = await saveProject(document.workspaceId, document, activeLocaleRef.current)
          setProject(result.project)
          setStoragePath(result.storagePath)
          setSaved(true)
          setError(null)
          // Reflect the new count in the picker without a full reload.
          setWorkspaces((list) => list.map((entry) => entry.workspaceId === document.workspaceId
            ? { ...entry, caseCount: result.project.cases.length, hasProject: true }
            : entry))
        } catch (cause) {
          setError((cause as Error).message)
        }
        current = pendingSave.current
        pendingSave.current = null
      }
    }
    saving.current = run().finally(() => { saving.current = null })
    await saving.current
  }, [])

  /** Apply an edit to the document and save it. */
  const update = useCallback((mutate: (draft: ProjectState) => ProjectState) => {
    setProject((current) => {
      if (current === null) return current
      const next = mutate({
        ...current,
        steps: { ...current.steps },
        cases: current.cases.map((item) => ({ ...item })),
        defects: current.defects.map((item) => ({ ...item })),
      })
      setSaved(false)
      void persist(next)
      return next
    })
  }, [persist])

  const setStepNote = useCallback((id: StepId, note: string) => {
    update((draft) => {
      draft.steps[id] = { ...draft.steps[id], note }
      return draft
    })
  }, [update])

  const addCase = useCallback((kind: CaseKind) => {
    update((draft) => {
      draft.cases.push({
        id: makeId('c'),
        title: kind === 'positive' ? t('wb.newPositive') : t('wb.newNegative'),
        kind,
        technique: kind === 'positive' ? 'functional' : 'boundary',
        preconditions: '',
        steps: [''],
        expected: '',
        result: 'untested',
        failReason: 'none',
        selfCheck: { passOnGood: false, failOnBad: false },
        note: '',
      })
      return draft
    })
  }, [update, t])

  const patchCase = useCallback((id: string, patch: Partial<TestCase>) => {
    update((draft) => {
      draft.cases = draft.cases.map((item) => (item.id === id ? { ...item, ...patch } : item))
      return draft
    })
  }, [update])

  const removeCase = useCallback((id: string) => {
    update((draft) => {
      draft.cases = draft.cases.filter((item) => item.id !== id)
      draft.defects = draft.defects.map((item) => (item.caseId === id ? { ...item, caseId: '' } : item))
      return draft
    })
  }, [update])

  const addDefect = useCallback(() => {
    update((draft) => {
      draft.defects.push({ id: makeId('d'), title: t('wb.newDefect'), status: 'open', caseId: '', note: '', createdAt: Date.now() })
      return draft
    })
  }, [update, t])

  const patchDefect = useCallback((id: string, patch: Partial<Defect>) => {
    update((draft) => {
      draft.defects = draft.defects.map((item) => (item.id === id ? { ...item, ...patch } : item))
      return draft
    })
  }, [update])

  const removeDefect = useCallback((id: string) => {
    update((draft) => {
      draft.defects = draft.defects.filter((item) => item.id !== id)
      return draft
    })
  }, [update])

  const runExport = useCallback(async (format: ExportFormat) => {
    if (workspaceId === null) return
    setExporting(format)
    setNotice(null)
    try {
      // Save first so the file matches the document on screen, then export the
      // SAVED project from the Host.
      if (!saved && project !== null) await persist(project)
      const artifact = await exportProject(workspaceId, format, activeLocale)
      downloadArtifact(artifact)
      setNotice(t('wb.exported', { file: artifact.filename }))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setExporting(null)
      setExportOpen(false)
    }
  }, [workspaceId, saved, project, persist, activeLocale, t])

  /** Merge a parsed file into the document: append, or replace the case list. */
  const applyImport = useCallback((preview: ImportPreview, mode: ImportMode) => {
    update((draft) => {
      const incoming = preview.cases.map((item) => toTestCase(item, makeId('c')))
      draft.cases = mode === 'replace' ? incoming : [...draft.cases, ...incoming]
      // Imported work is a real edit of stage ③, so the stage moves to doing
      // unless it was already finished by hand.
      if (draft.steps.cases.status === 'todo') {
        draft.steps.cases = { ...draft.steps.cases, status: 'doing', updatedAt: Date.now() }
      }
      return draft
    })
    setImportOpen(false)
    setActiveStep('cases')
    setNotice(t('wb.importDone', { count: preview.cases.length }))
  }, [update, t])

  /** Hand the cases to the agent: a real run, not a status flag. */
  const runTests = useCallback(async () => {
    if (workspaceId === null || project === null) return
    setRunState('starting')
    setNotice(null)
    setError(null)
    try {
      // Save first: the agent reads the document from disk, so it must match
      // the page exactly when the run starts.
      if (!saved) await persist(project)
      setRunState(await startRun(workspaceId, activeLocale))
    } catch (cause) {
      setRunState('idle')
      setError((cause as Error).message)
    }
  }, [workspaceId, project, persist, saved, activeLocale])

  /**
   * The stage statuses, derived from the work — never chosen by hand.
   *
   * `stageStatus` is what the rail, the head and the report show; the stored
   * `steps[*].status` is kept in the document only so an older reader still
   * has a value, and it is refreshed from this derivation whenever the work
   * changes.
   */
  const stageStatus = useMemo(
    () => (project === null ? null : deriveStageStatus(project, { documents: requirementDocs.length, hasNote: false })),
    [project, requirementDocs.length],
  )

  const stageTitles = useMemo(() => {
    const titles = {} as Record<StepId, string>
    for (const step of content.steps) titles[CONTENT_STEP_TO_STAGE[step.id] as StepId] = step.title
    return titles
  }, [content])

  if (loading) {
    return h('div', { className: 'dpat-root dpat-workbench' }, h('p', { className: 'dpat-muted' }, t('wb.loading')))
  }

  const currentWorkspace = workspaces.find((entry) => entry.workspaceId === workspaceId)

  const header = h(
    'header',
    { className: 'dpat-wbHead' },
    h(
      'div',
      { className: 'dpat-wbTitle' },
      h(FlowIcon, { size: 18 }),
      h('h2', { className: 'dpat-title' }, t('page.title')),
    ),
    h(
      'div',
      { className: 'dpat-wbControls' },
      workspaces.length > 0
        ? h(Select<string>, {
          label: t('wb.workspace'),
          value: workspaceId ?? '',
          options: workspaces.map((entry) => ({
            value: entry.workspaceId,
            label: `${entry.title}${entry.caseCount > 0 ? ` · ${entry.caseCount}` : ''}`,
          })),
          onChange: (id) => { void openWorkspace(id) },
        })
        : null,
      h(
        'span',
        { className: `dpat-saveState ${saved ? 'dpat-saved' : 'dpat-dirty'}`, 'aria-live': 'polite' },
        saved ? t('wb.saved') : t('wb.saving'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dpat-btn',
          'data-action': 'import',
          disabled: project === null,
          title: t('wb.importOpen'),
          onClick: () => setImportOpen((open) => !open),
        },
        t('wb.import'),
      ),
      h(
        'div',
        { className: 'dpat-exportWrap' },
        h(
          'button',
          {
            type: 'button',
            className: 'dpat-btn dpat-btnPrimary',
            'aria-haspopup': 'menu',
            'aria-expanded': exportOpen,
            disabled: project === null || exporting !== null,
            onClick: () => setExportOpen((open) => !open),
          },
          exporting !== null ? t('wb.exporting') : t('wb.export'),
        ),
        exportOpen
          ? h(
            'div',
            { className: 'dpat-menu', role: 'menu' },
            EXPORT_FORMATS.map((format) =>
              h(
                'button',
                {
                  key: format.value,
                  type: 'button',
                  role: 'menuitem',
                  className: 'dpat-menuItem',
                  'data-format': format.value,
                  onClick: () => { void runExport(format.value) },
                },
                h('span', { className: 'dpat-menuLabel' }, activeLocale.toLowerCase().startsWith('zh') ? format.zh : format.en),
                h('span', { className: 'dpat-menuHint' }, format.hint),
              ),
            ),
          )
          : null,
      ),
      h(IconButton, {
        label: t('wb.refresh'),
        title: t('wb.refresh'),
        onClick: () => {
          void refreshWorkspaces().then(() => {
            if (workspaceId !== null) void openWorkspace(workspaceId)
          })
        },
      }, '↻'),
    ),
  )

  if (project === null) {
    return h(
      'div',
      { className: 'dpat-root dpat-workbench' },
      header,
      h(
        'div',
        { className: 'dpat-empty' },
        h('p', null, error ?? t('wb.noWorkspace')),
        h('p', { className: 'dpat-muted dpat-small' }, t('wb.noWorkspaceHint')),
      ),
    )
  }

  const progress = projectProgress(project)
  const buckets = splitCases(project.cases)
  const casesById = new Map(project.cases.map((item) => [item.id, item]))
  const stepMatch = content.steps.find((step) => CONTENT_STEP_TO_STAGE[step.id] === activeStep)

  /** Step ①'s numeric inputs: the coverage target and the automation level. */
  const analysisControls = h(
    'section',
    { className: 'dpat-card dpat-analysisControls' },
    h('h4', { className: 'dpat-cardTitle' }, t('wb.analysisTargets')),
    h(
      'div',
      { className: 'dpat-controlRow' },
      h(
        'label',
        { className: 'dpat-field dpat-fieldInline' },
        h('span', { className: 'dpat-fieldLabel' }, t('wb.coverageTarget')),
        h(
          'span',
          { className: 'dpat-targetWrap' },
          h('input', {
            className: 'dpat-input dpat-targetInput',
            type: 'number',
            min: 0,
            max: 100,
            step: 1,
            value: String(project.coverageTarget),
            'aria-label': t('wb.coverageTarget'),
            onChange: (event: { target: { value: string } }) => {
              const raw = Number(event.target.value)
              if (!Number.isFinite(raw)) return
              update((draft) => {
                draft.coverageTarget = Math.max(0, Math.min(100, Math.round(raw)))
                return draft
              })
            },
          }),
          h('span', { className: 'dpat-unit' }, '%'),
        ),
      ),
      h(Select<string>, {
        label: t('wb.automationLevel'),
        value: project.automationLevel,
        options: AUTOMATION_LEVELS.map((level) => ({ value: level, label: t(`wb.level.${level}`) })),
        onChange: (level) => update((draft) => {
          draft.automationLevel = level as AutomationLevel
          return draft
        }),
      }),
    ),
  )

  /** Who does the work at this stage: model runs it, or a person does. */
  const ownerBadge = stepMatch === undefined
    ? null
    : h(
      'span',
      {
        className: `dpat-owner dpat-owner-${stepMatch.owner}`,
        'data-owner': stepMatch.owner,
        title: t(`wb.owner.${stepMatch.owner}`),
      },
      stepMatch.owner === 'model' ? '🤖' : stepMatch.owner === 'review' ? '🤖 → 👤' : '👤',
      ' ',
      t(`wb.owner.${stepMatch.owner}`),
    )

  /** The things a person has to do here — empty for a model-run stage. */
  const actionList = stepMatch === undefined || stepMatch.actions.length === 0
    ? null
    : h(
      'section',
      { className: 'dpat-card dpat-actions', 'data-stage-actions': activeStep },
      h('h4', { className: 'dpat-cardTitle' }, t('wb.actionsTitle')),
      h(
        'ol',
        { className: 'dpat-actionList' },
        stepMatch.actions.map((action, index) =>
          h(
            'li',
            { key: index, className: 'dpat-actionItem' },
            h('span', { className: 'dpat-actionNo', 'aria-hidden': 'true' }, String(index + 1)),
            h(
              'div',
              null,
              h('strong', { className: 'dpat-actionDo' }, action.do),
              h('span', { className: 'dpat-actionDetail' }, action.detail),
            ),
          ),
        ),
      ),
    )

  const modelRunsAlone = stepMatch !== undefined && stepMatch.owner === 'model'

  const stageBody = (() => {
    if (activeStep === 'cases') {
      return caseEditor()
    }
    if (activeStep === 'bugs') {
      return defectTracker()
    }
    if (modelRunsAlone) {
      const runResult = runState === 'idle' || runState === 'starting' ? null : runState
      return h(
        'div',
        { className: 'dpat-stageBody' },
        h(
          'section',
          { className: 'dpat-card dpat-modelCard', 'data-model-stage': activeStep },
          h('h4', { className: 'dpat-cardTitle' }, t('wb.modelRuns')),
          h('p', { className: 'dpat-stageSummary' }, t('wb.modelRunsHint')),
          h(
            'div',
            { className: 'dpat-runBar' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpat-btn dpat-btnPrimary dpat-runBtn',
                'data-action': 'run-tests',
                disabled: project === null || project.cases.length === 0 || runState === 'starting',
                title: project !== null && project.cases.length === 0 ? t('wb.runNoCases') : t('wb.runStart'),
                onClick: () => { void runTests() },
              },
              runState === 'starting' ? t('wb.runStarting') : `▶ ${t('wb.runStart')}`,
            ),
            h('span', { className: 'dpat-muted dpat-small' }, t('wb.runCases', { count: project === null ? 0 : project.cases.length })),
          ),
          runResult === null
            ? null
            : h(
              'div',
              { className: 'dpat-runResult', role: 'status', 'data-run-session': runResult.sessionId },
              h('p', { className: 'dpat-hintOk' }, t('wb.runStarted', { count: runResult.cases })),
              h('p', { className: 'dpat-muted dpat-small' }, t('wb.runWhere')),
              h(
                'details',
                { className: 'dpat-runPrompt' },
                h('summary', null, t('wb.runShowPrompt')),
                h('pre', { className: 'dpat-pre' }, runResult.prompt),
              ),
            ),
          h(
            'ul',
            { className: 'dpat-list' },
            (['readCases', 'writeScripts', 'runScripts', 'selfCheck', 'fillVerdict'] as const).map((key) =>
              h('li', { key }, h('span', { className: 'dpat-dot', 'aria-hidden': 'true' }), t(`wb.modelStep.${key}`)),
            ),
          ),
        ),
        stepMatch === undefined
          ? null
          : h(
            'section',
            { className: 'dpat-card' },
            h('h4', { className: 'dpat-cardTitle' }, t('page.keyPoints')),
            h('ul', { className: 'dpat-list' }, stepMatch.practices.map((line, index) => h('li', { key: index }, h('span', { className: 'dpat-dot', 'aria-hidden': 'true' }), line))),
            h('p', { className: 'dpat-pitfallText' }, h('strong', null, `${t('page.pitfall')}: `), stepMatch.pitfall),
          ),
      )
    }
    return h(
      'div',
      { className: 'dpat-stageBody' },
      activeStep === 'requirement' && workspaceId !== null
        ? h(DocumentsPanel, { t, workspaceId })
        : null,
      activeStep === 'requirement' ? analysisControls : null,
      actionList,
      stepMatch === undefined
        ? null
        : h(
          'section',
          { className: 'dpat-card' },
          h('h4', { className: 'dpat-cardTitle' }, stepMatch.title),
          h('p', { className: 'dpat-stageSummary' }, stepMatch.summary),
          h('div', { className: 'dpat-fields' },
            h('div', { className: 'dpat-field' }, h('span', { className: 'dpat-fieldLabel' }, t('page.input')), h('span', { className: 'dpat-fieldValue' }, stepMatch.input)),
            h('div', { className: 'dpat-field' }, h('span', { className: 'dpat-fieldLabel' }, t('page.output')), h('span', { className: 'dpat-fieldValue' }, stepMatch.output))),
          h('ul', { className: 'dpat-list' }, stepMatch.practices.map((line, index) => h('li', { key: index }, h('span', { className: 'dpat-dot', 'aria-hidden': 'true' }), line))),
          h('p', { className: 'dpat-pitfallText' }, h('strong', null, `${t('page.pitfall')}: `), stepMatch.pitfall),
        ),
      h(
        'section',
        { className: 'dpat-card' },
        h('h4', { className: 'dpat-cardTitle' }, t('wb.stageNote')),
        h(TextArea, {
          label: t('wb.stageNote'),
          value: project.steps[activeStep].note,
          rows: 4,
          placeholder: t('wb.stageNotePlaceholder'),
          onChange: (note) => setStepNote(activeStep, note),
        }),
      ),
    )
  })()

  /** The stage-3 case editor: two buckets, each a list of editable cases. */
  function caseEditor(): ReactNode {
    const renderCase = (item: TestCase): ReactNode => h(
      'article',
      { key: item.id, className: 'dpat-case', 'data-case': item.id, 'data-kind': item.kind },
      h(
        'div',
        { className: 'dpat-caseHead' },
        h('input', {
          className: 'dpat-caseTitle',
          type: 'text',
          value: item.title,
          'aria-label': t('wb.caseTitle'),
          onChange: (event: { target: { value: string } }) => patchCase(item.id, { title: event.target.value }),
        }),
        h(Select<string>, {
          label: t('wb.technique'),
          value: item.technique,
          options: TECHNIQUES.map((technique) => ({ value: technique, label: t(`wb.technique.${technique}`) })),
          onChange: (technique) => patchCase(item.id, { technique: technique as CaseTechnique }),
        }),
        h(Select<string>, {
          label: t('wb.result'),
          value: item.result,
          options: (['untested', 'passed', 'failed', 'blocked'] as CaseResult[]).map((result) => ({ value: result, label: t(`wb.result.${result}`) })),
          onChange: (result) => patchCase(item.id, { result: result as CaseResult }),
        }),
        h(IconButton, {
          label: t('wb.removeCase'),
          title: t('wb.removeCase'),
          className: 'dpat-danger',
          onClick: () => removeCase(item.id),
        }, '✕'),
      ),
      h(TextField, {
        label: t('wb.preconditions'),
        value: item.preconditions,
        placeholder: t('wb.preconditionsPlaceholder'),
        onChange: (preconditions) => patchCase(item.id, { preconditions }),
      }),
      h(
        'div',
        { className: 'dpat-steps' },
        h('span', { className: 'dpat-fieldLabel' }, t('wb.caseSteps')),
        item.steps.map((step, index) =>
          h(
            'div',
            { key: index, className: 'dpat-stepRow' },
            h('span', { className: 'dpat-stepNo' }, String(index + 1)),
            h('input', {
              className: 'dpat-input',
              type: 'text',
              value: step,
              'aria-label': `${t('wb.caseSteps')} ${index + 1}`,
              onChange: (event: { target: { value: string } }) => {
                const steps = [...item.steps]
                steps[index] = event.target.value
                patchCase(item.id, { steps })
              },
            }),
            h(IconButton, {
              label: t('wb.removeStep'),
              title: t('wb.removeStep'),
              onClick: () => patchCase(item.id, { steps: item.steps.filter((_, at) => at !== index) }),
            }, '−'),
          ),
        ),
        h(
          'button',
          { type: 'button', className: 'dpat-linkBtn', onClick: () => patchCase(item.id, { steps: [...item.steps, ''] }) },
          t('wb.addStep'),
        ),
      ),
      h(TextField, {
        label: t('wb.expected'),
        value: item.expected,
        placeholder: t('wb.expectedPlaceholder'),
        onChange: (expected) => patchCase(item.id, { expected }),
      }),
      // Step ⑤: the script is only trustworthy once BOTH ticks hold.
      h(
        'fieldset',
        { className: 'dpat-fieldset' },
        h('legend', { className: 'dpat-fieldLabel' }, t('wb.selfCheck')),
        h(
          'label',
          { className: 'dpat-check' },
          h('input', {
            type: 'checkbox',
            'data-selfcheck': 'passOnGood',
            checked: item.selfCheck?.passOnGood === true,
            onChange: (event: { target: { checked: boolean } }) =>
              patchCase(item.id, { selfCheck: { ...item.selfCheck, passOnGood: event.target.checked, failOnBad: item.selfCheck?.failOnBad === true } }),
          }),
          h('span', null, t('wb.selfCheckPass')),
        ),
        h(
          'label',
          { className: 'dpat-check' },
          h('input', {
            type: 'checkbox',
            'data-selfcheck': 'failOnBad',
            checked: item.selfCheck?.failOnBad === true,
            onChange: (event: { target: { checked: boolean } }) =>
              patchCase(item.id, { selfCheck: { ...item.selfCheck, passOnGood: item.selfCheck?.passOnGood === true, failOnBad: event.target.checked } }),
          }),
          h('span', null, t('wb.selfCheckFail')),
        ),
        item.selfCheck?.passOnGood === true && item.selfCheck?.failOnBad === true
          ? h('span', { className: 'dpat-badgeOk' }, t('wb.selfCheckVerified'))
          : null,
      ),
      // Step ⑥: attribute a failure before anyone may file a defect.
      h(Select<string>, {
        label: t('wb.failReason'),
        value: item.failReason,
        options: FAIL_REASONS.map((reason) => ({ value: reason, label: t(`wb.reason.${reason}`) })),
        onChange: (reason) => patchCase(item.id, { failReason: reason as FailReason }),
      }),
      item.result === 'failed' && item.failReason !== 'product'
        ? h('p', { className: 'dpat-hintWarn' }, t('wb.failReasonHint'))
        : null,
      item.result === 'failed' && item.failReason === 'product'
        ? h(
          'button',
          {
            type: 'button',
            className: 'dpat-btn dpat-btnDanger',
            'data-action': 'file-defect',
            onClick: () => {
              update((draft) => {
                draft.defects.push({
                  id: makeId('d'),
                  title: item.title,
                  status: 'open',
                  caseId: item.id,
                  note: item.expected === '' ? '' : `${t('wb.expected')}: ${item.expected}`,
                  regression: 'pending',
                  requirementChanged: false,
                  createdAt: Date.now(),
                })
                return draft
              })
              setNotice(t('wb.defectFiled', { title: item.title }))
            },
          },
          t('wb.fileDefect'),
        )
        : null,
      h(TextField, {
        label: t('wb.caseNote'),
        value: item.note,
        placeholder: t('wb.caseNotePlaceholder'),
        onChange: (note) => patchCase(item.id, { note }),
      }),
    )

    const bucket = (kind: CaseKind, items: TestCase[], description: string): ReactNode => h(
      'section',
      { className: 'dpat-bucket', 'data-bucket': kind },
      h(
        'div',
        { className: 'dpat-bucketHead' },
        h('h4', { className: 'dpat-bucketTitle' }, `${t(`wb.kind.${kind}`)} (${items.length})`),
        h('p', { className: 'dpat-bucketHint' }, description),
        h('button', { type: 'button', className: 'dpat-btn', onClick: () => addCase(kind) }, t('wb.addCase')),
      ),
      items.length === 0
        ? h('p', { className: 'dpat-muted dpat-small' }, t('wb.noCases'))
        : h('div', { className: 'dpat-caseList' }, items.map(renderCase)),
    )

    return h(
      'div',
      { className: 'dpat-stageBody' },
      h('p', { className: 'dpat-stageLead' }, t('wb.casesLead')),
      bucket('positive', buckets.positive, t('wb.positiveHint')),
      bucket('negative', buckets.negative, t('wb.negativeHint')),
    )
  }

  /** The stage-7 defect tracker. */
  function defectTracker(): ReactNode {
    return h(
      'div',
      { className: 'dpat-stageBody' },
      h('p', { className: 'dpat-stageLead' }, t('wb.defectsLead')),
      h(
        'div',
        { className: 'dpat-bucketHead' },
        h('h4', { className: 'dpat-bucketTitle' }, `${t('wb.defects')} (${project === null ? 0 : project.defects.length})`),
        h('button', { type: 'button', className: 'dpat-btn dpat-btnPrimary', onClick: addDefect }, t('wb.addDefect')),
      ),
      project.defects.length === 0
        ? h('p', { className: 'dpat-muted dpat-small' }, t('wb.noDefects'))
        : h(
          'div',
          { className: 'dpat-caseList' },
          project.defects.map((defect) =>
            h(
              'article',
              { key: defect.id, className: 'dpat-case', 'data-defect': defect.id },
              h(
                'div',
                { className: 'dpat-caseHead' },
                h('input', {
                  className: 'dpat-caseTitle',
                  type: 'text',
                  value: defect.title,
                  'aria-label': t('wb.defectTitle'),
                  onChange: (event: { target: { value: string } }) => patchDefect(defect.id, { title: event.target.value }),
                }),
                h(Select<string>, {
                  label: t('wb.defectStatus'),
                  value: defect.status,
                  options: DEFECT_STATUSES.map((status) => ({ value: status, label: t(`wb.defect.${status}`) })),
                  onChange: (status) => patchDefect(defect.id, { status: status as DefectStatus }),
                }),
                h(Select<string>, {
                  label: t('wb.defectCase'),
                  value: defect.caseId,
                  options: [{ value: '', label: t('wb.defectNoCase') }].concat(
                    project.cases.map((item) => ({ value: item.id, label: item.title })),
                  ),
                  onChange: (caseId) => patchDefect(defect.id, { caseId }),
                }),
                h(IconButton, {
                  label: t('wb.removeDefect'),
                  title: t('wb.removeDefect'),
                  className: 'dpat-danger',
                  onClick: () => removeDefect(defect.id),
                }, '✕'),
              ),
              h(TextField, {
                label: t('wb.defectNote'),
                value: defect.note,
                placeholder: t('wb.defectNotePlaceholder'),
                onChange: (note) => patchDefect(defect.id, { note }),
              }),
              // Step ⑦: a fix is only closed once regression passes; a deviation
              // from the requirement means the script must be updated first.
              h(
                'div',
                { className: 'dpat-controlRow' },
                h(Select<string>, {
                  label: t('wb.regression'),
                  value: defect.regression,
                  options: REGRESSIONS.map((value) => ({ value, label: t(`wb.regression.${value}`) })),
                  onChange: (value) => patchDefect(defect.id, { regression: value as RegressionResult }),
                }),
                h(
                  'label',
                  { className: 'dpat-check' },
                  h('input', {
                    type: 'checkbox',
                    'data-deviation': defect.id,
                    checked: defect.requirementChanged,
                    onChange: (event: { target: { checked: boolean } }) =>
                      patchDefect(defect.id, { requirementChanged: event.target.checked }),
                  }),
                  h('span', null, t('wb.requirementChanged')),
                ),
              ),
              defect.requirementChanged
                ? h('p', { className: 'dpat-hintWarn' }, t('wb.requirementChangedHint'))
                : null,
              defect.status !== 'closed' && defect.regression === 'passed'
                ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpat-btn',
                    'data-action': 'close-defect',
                    onClick: () => patchDefect(defect.id, { status: 'closed' }),
                  },
                  t('wb.closeDefect'),
                )
                : null,
              defect.requirementChanged && defect.regression !== 'pending'
                ? h('span', { className: 'dpat-hintOk' }, t('wb.requirementSynced'))
                : null,
            ),
          ),
        ),
    )
  }

  const overview = h(
    'div',
    { className: 'dpat-wbOverview' },
    flowPipeline(STEP_IDS.map((id) => stageTitles[id]), t('page.flowTitle')),
    h(
      'div',
      { className: 'dpat-progress' },
      h('span', { className: 'dpat-progressLabel' }, t('wb.progress', { done: progress.done, total: progress.total })),
      h('span', { className: 'dpat-progressBar' }, h('span', { className: 'dpat-progressFill', style: { width: `${progress.percent}%` } })),
    ),
  )

  const activeMeta = { status: (stageStatus ?? project.steps)[activeStep] }

  return h(
    'div',
    { className: 'dpat-root dpat-workbench' },
    header,
    error === null
      ? null
      : h(
        'div',
        { className: 'dpat-banner dpat-bannerError', role: 'alert' },
        h('span', null, error),
        h('button', { type: 'button', className: 'dpat-linkBtn', onClick: () => setError(null) }, t('wb.dismiss')),
      ),
    hostReachable && hostStamp !== null
      ? null
      : h(
        'div',
        { className: 'dpat-banner dpat-bannerWarn', role: 'status', 'data-host-version': hostReachable ? 'stale' : 'unreachable' },
        h('span', null, hostReachable ? t('wb.hostStale') : t('wb.hostUnreachable')),
      ),
    notice === null
      ? null
      : h(
        'div',
        { className: 'dpat-banner dpat-bannerOk', role: 'status' },
        h('span', null, notice),
        h('button', { type: 'button', className: 'dpat-linkBtn', onClick: () => setNotice(null) }, t('wb.dismiss')),
      ),
    h(
      'div',
      { className: 'dpat-wbPath' },
      currentWorkspace === undefined ? null : h('code', { className: 'dpat-path' }, currentWorkspace.path),
      h('span', { className: 'dpat-muted dpat-small' }, `${t('wb.storage')}: `),
      h('code', { className: 'dpat-path' }, storagePath),
    ),
    overview,
    importOpen && workspaceId !== null
      ? h(ImportPanel, { t, workspaceId, onApply: applyImport, onClose: () => setImportOpen(false) })
      : null,
    h(
      'div',
      { className: 'dpat-wbBody' },
      h(StepRail, { project, status: stageStatus ?? project.steps, active: activeStep, t, titles: stageTitles, onSelect: setActiveStep }),
      h(
        'div',
        { className: 'dpat-wbStage' },
        h(
          'div',
          { className: 'dpat-wbStageHead' },
          h('h3', { className: 'dpat-wbStageTitle' }, `${STEP_IDS.indexOf(activeStep) + 1}. ${stageTitles[activeStep]}`),
          ownerBadge,
          // Status is DERIVED from the work: shown, not chosen. The tooltip
          // says what would advance it, so the pill is an explanation.
          h(
            'span',
            {
              className: `dpat-stageStatus dpat-stageStatus-${activeMeta.status}`,
              'data-stage-status': activeMeta.status,
              title: t(`wb.statusWhy.${activeStep}.${activeMeta.status}`),
            },
            h(StatusDot, { status: activeMeta.status }),
            t(`wb.status.${activeMeta.status}`),
          ),
          h('span', { className: 'dpat-muted dpat-small' }, `${casesById.size} ${t('wb.cases')}`),
        ),
        stageBody,
      ),
    ),
  )
}

