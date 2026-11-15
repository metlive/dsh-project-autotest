/**
 * The import panel: pick a file, let the Host parse it, review what would land,
 * then confirm.
 *
 * The order matters. Parsing is a READ — the Host answers with the cases the
 * file carries and writes nothing — so a wrong file costs a preview, never a
 * project. Only the two confirm buttons touch the document, and the choice
 * between them (append or replace) is made with the count in front of the
 * person, which is the one decision that silently loses work if guessed wrong.
 *
 * @module dsh-project-autotest/client/ImportPanel
 */
import {
  createElement as h,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { importPreview, type ImportPreview } from './api.ts'
import { ButtonIcon } from './ButtonIcon.tsx'
import type { Translate } from './locales.ts'

/** How confirmed cases join the project. */
export type ImportMode = 'append' | 'replace'

/** Props the workbench composes. */
export interface ImportPanelProps {
  /** Namespace-bound translator. */
  t: Translate
  /** The workspace whose project would receive the cases. */
  workspaceId: string | null
  /** Merge the parsed cases into the document. */
  onApply: (preview: ImportPreview, mode: ImportMode) => void
  /** Close the panel. */
  onClose: () => void
}

/** The largest file the Host accepts (its body limit), in bytes. */
const MAX_BYTES = 4 * 1024 * 1024

/** The input's accepted types; the importer also sniffs content. */
const ACCEPT = '.xmind,.md,.markdown,.csv,.json,.txt'

/**
 * Render the import panel.
 * @param props - the translator, the target workspace and the two callbacks.
 * @returns the panel element.
 */
export function ImportPanel(props: ImportPanelProps): ReactNode {
  const { t } = props
  const input = useRef<HTMLInputElement | null>(null)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  /** Parse one picked file into a preview. */
  const read = useCallback(async (file: File | undefined) => {
    if (file === undefined) return
    setError(null)
    setPreview(null)
    if (file.size > MAX_BYTES) {
      setError(t('wb.importFileTooBig'))
      return
    }
    if (props.workspaceId === null) return
    setParsing(true)
    try {
      setPreview(await importPreview(props.workspaceId, file))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setParsing(false)
    }
  }, [props.workspaceId, t])

  const positive = preview === null ? 0 : preview.cases.filter((item) => item.kind === 'positive').length
  const negative = preview === null ? 0 : preview.cases.length - positive

  return h(
    'section',
    { className: 'dpat-import', 'aria-label': t('wb.importTitle'), 'data-import-panel': 'open' },
    h(
      'div',
      { className: 'dpat-importHead' },
      h('h4', { className: 'dpat-cardTitle' }, t('wb.importTitle')),
      h('button', { type: 'button', className: 'dpat-linkBtn', onClick: props.onClose }, t('wb.importCancel')),
    ),
    h('p', { className: 'dpat-stageLead' }, t('wb.importHint')),
    h(
      'div',
      {
        className: `dpat-dropZone${dragging ? ' dpat-dropZoneActive' : ''}`,
        role: 'button',
        tabIndex: 0,
        'data-import-drop': 'zone',
        onClick: () => input.current?.click(),
        onKeyDown: (event: { key: string; preventDefault(): void }) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            input.current?.click()
          }
        },
        onDragOver: (event: { preventDefault(): void }) => {
          event.preventDefault()
          setDragging(true)
        },
        onDragLeave: () => setDragging(false),
        onDrop: (event: {
          preventDefault(): void
          dataTransfer: { files: ArrayLike<File> } | null
        }) => {
          event.preventDefault()
          setDragging(false)
          void read(event.dataTransfer?.files[0])
        },
      },
      h('span', { className: 'dpat-dropIcon', 'aria-hidden': 'true' }, '⇪'),
      h('span', null, parsing ? t('wb.importParsing') : t('wb.importDrop')),
      h('span', { className: 'dpat-muted dpat-small' }, t('wb.importPick')),
    ),
    h('input', {
      ref: input,
      type: 'file',
      className: 'dpat-importInput',
      accept: ACCEPT,
      'data-import-input': 'file',
      onChange: (event: { target: { value: string; files: ArrayLike<File> | null } }) => {
        void read(event.target.files?.[0] ?? undefined)
        // Clearing lets the same file be picked again after a fix.
        event.target.value = ''
      },
    }),
    error === null ? null : h('p', { className: 'dpat-hintWarn', role: 'alert' }, error),
    preview === null
      ? null
      : preview.cases.length === 0
        ? h('p', { className: 'dpat-muted' }, t('wb.importEmpty'))
        : h(
          'div',
          { className: 'dpat-importPreview', 'data-import-preview': preview.format },
          h(
            'p',
            { className: 'dpat-importSummary' },
            t('wb.importPreview', { count: preview.cases.length, positive, negative }),
            h('span', { className: 'dpat-muted dpat-small' }, ` · ${t('wb.importFormat', { format: preview.format })}`),
          ),
          preview.warnings.length === 0
            ? null
            : h(
              'details',
              { className: 'dpat-importWarnings' },
              h('summary', null, t('wb.importWarnings', { count: preview.warnings.length })),
              h('ul', { className: 'dpat-list' }, preview.warnings.map((warning, index) => h('li', { key: index }, warning))),
            ),
          h(
            'ul',
            { className: 'dpat-importList', 'data-import-cases': String(preview.cases.length) },
            preview.cases.slice(0, 40).map((item, index) =>
              h(
                'li',
                { key: index, className: 'dpat-importItem', 'data-kind': item.kind },
                h('span', { className: `dpat-kindChip dpat-kindChip-${item.kind}` }, item.kind === 'negative' ? t('wb.kind.negative') : t('wb.kind.positive')),
                h('span', { className: 'dpat-importTitle' }, item.title),
                h('span', { className: 'dpat-muted dpat-small' }, t('wb.importSteps', { count: item.steps.length })),
              ),
            ),
          ),
          preview.cases.length > 40
            ? h('p', { className: 'dpat-muted dpat-small' }, `… +${preview.cases.length - 40}`)
            : null,
          h(
            'div',
            { className: 'dpat-importActions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpat-btn dpat-btnPrimary',
                'data-import-mode': 'append',
                onClick: () => props.onApply(preview, 'append'),
              },
              h(ButtonIcon, { name: 'add' }),
              h('span', null, t('wb.importAppend')),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpat-btn',
                'data-import-mode': 'replace',
                onClick: () => props.onApply(preview, 'replace'),
              },
              h(ButtonIcon, { name: 'reset' }),
              h('span', null, t('wb.importReplace')),
            ),
          ),
        ),
  )
}
