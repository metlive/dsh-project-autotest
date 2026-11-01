/**
 * Stage ①'s input: the product documents and technical design.
 *
 * The files are stored INSIDE the workspace (`docs/autotest/inputs/`), not in
 * the plugin's own storage — they are project documentation, they belong in
 * version control, and the agent can read them straight from the workspace
 * when it writes the cases. The panel only mirrors what is on disk: it lists
 * on mount and after every upload, so a file removed outside the page
 * disappears here too.
 *
 * @module dsh-project-autotest/client/DocumentsPanel
 */
import {
  createElement as h,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { deleteDocument, listDocuments, uploadDocument, type DocumentInput } from './api.ts'
import type { Translate } from './locales.ts'

/** Props the workbench composes. */
export interface DocumentsPanelProps {
  /** Namespace-bound translator. */
  t: Translate
  /** The workspace whose stored documents are shown. */
  workspaceId: string
  /** The file the page accepts: plain text, so the agent can read it back. */
  accept?: string
}

/** Documents are read back by the agent, so only text is accepted here. */
const DEFAULT_ACCEPT = '.md,.markdown,.txt,.json,.yaml,.yml,.csv,.html,.htm'

/** Format a byte count for the list. */
function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Render the requirement-documents panel.
 * @param props - the translator and the workspace to read.
 * @returns the panel element.
 */
export function DocumentsPanel(props: DocumentsPanelProps): ReactNode {
  const { t } = props
  const input = useRef<HTMLInputElement | null>(null)
  const [documents, setDocuments] = useState<DocumentInput[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments(props.workspaceId))
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoaded(true)
    }
  }, [props.workspaceId])

  // Reload whenever the workspace changes: documents belong to one project.
  useEffect(() => {
    setLoaded(false)
    void refresh()
  }, [refresh])

  const upload = useCallback(async (files: FileList | readonly File[] | null | undefined) => {
    const picked = files === null || files === undefined ? [] : Array.from(files)
    if (picked.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of picked) {
        const result = await uploadDocument(props.workspaceId, file)
        setDocuments(result.documents)
      }
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }, [props.workspaceId])

  const remove = useCallback(async (name: string) => {
    setBusy(true)
    try {
      setDocuments(await deleteDocument(props.workspaceId, name))
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }, [props.workspaceId])

  return h(
    'section',
    { className: 'dpat-card dpat-docs', 'data-documents': String(documents.length) },
    h('h4', { className: 'dpat-cardTitle' }, t('wb.docsTitle')),
    h('p', { className: 'dpat-stageLead' }, t('wb.docsHint')),
    h(
      'div',
      {
        className: `dpat-dropZone dpat-dropZoneCompact${dragging ? ' dpat-dropZoneActive' : ''}`,
        role: 'button',
        tabIndex: 0,
        'data-docs-drop': 'zone',
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
        onDrop: (event: { preventDefault(): void; dataTransfer: { files: FileList } | null }) => {
          event.preventDefault()
          setDragging(false)
          void upload(event.dataTransfer?.files)
        },
      },
      h('span', { className: 'dpat-dropIcon', 'aria-hidden': 'true' }, '⇪'),
      h('span', null, busy ? t('wb.docsUploading') : t('wb.docsDrop')),
      h('span', { className: 'dpat-muted dpat-small' }, t('wb.docsPick')),
    ),
    h('input', {
      ref: input,
      type: 'file',
      multiple: true,
      className: 'dpat-importInput',
      accept: props.accept ?? DEFAULT_ACCEPT,
      'data-docs-input': 'file',
      onChange: (event: { target: { value: string; files: FileList | null } }) => {
        void upload(event.target.files)
        event.target.value = ''
      },
    }),
    error === null ? null : h('p', { className: 'dpat-hintWarn', role: 'alert' }, error),
    !loaded
      ? h('p', { className: 'dpat-muted dpat-small' }, t('wb.loading'))
      : documents.length === 0
        ? h('p', { className: 'dpat-muted dpat-small' }, t('wb.docsEmpty'))
        : h(
          'ul',
          { className: 'dpat-docList' },
          documents.map((doc) =>
            h(
              'li',
              { key: doc.name, className: 'dpat-docItem', 'data-doc': doc.name },
              h('span', { className: 'dpat-docIcon', 'aria-hidden': 'true' }, '📄'),
              h(
                'span',
                { className: 'dpat-docMeta' },
                h('span', { className: 'dpat-docName' }, doc.name),
                h('span', { className: 'dpat-muted dpat-small' }, `${sizeText(doc.size)} · ${new Date(doc.modifiedAt).toLocaleString()}`),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpat-iconBtn dpat-danger',
                  'aria-label': t('wb.docsRemove'),
                  title: t('wb.docsRemove'),
                  'data-doc-remove': doc.name,
                  onClick: () => { void remove(doc.name) },
                },
                '✕',
              ),
            ),
          ),
        ),
  )
}
