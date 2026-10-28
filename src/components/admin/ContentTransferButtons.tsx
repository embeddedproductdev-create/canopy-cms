'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'

type Preview = { creates: string[]; updates: string[]; errors: string[] }
type ExportFile = { format: 'canopy-content-v1'; collection: string; documents: Record<string, unknown>[] }
type Mode = 'export' | 'import' | null

const LABELS: Record<string, string> = { blog: 'Insights', 'case-study': 'Portfolio', capability: 'Capabilities' }
const MAX_BYTES = 5 * 1024 * 1024
const MAX_RECORDS = 500

/** Cheap checks run in the browser before anything is uploaded. The server repeats and extends them. */
async function verifyFile(file: File, collection: string): Promise<{ data?: ExportFile; errors: string[] }> {
  const errors: string[] = []
  if (!/\.json$/i.test(file.name)) errors.push('Only .json files are accepted.')
  if (file.type && file.type !== 'application/json') errors.push(`Unexpected file type "${file.type}".`)
  if (file.size === 0) errors.push('The file is empty.')
  if (file.size > MAX_BYTES) errors.push(`The file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`)
  if (errors.length) return { errors }

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return { errors: ['The file is not valid JSON.'] }
  }
  const data = parsed as Partial<ExportFile> | null
  if (!data || typeof data !== 'object' || data.format !== 'canopy-content-v1') {
    return { errors: ['This is not a Canopy export (missing format "canopy-content-v1").'] }
  }
  if (data.collection !== collection) {
    return { errors: [`This file contains "${String(data.collection)}" content, but you are on ${LABELS[collection] ?? collection}.`] }
  }
  if (!Array.isArray(data.documents) || data.documents.length === 0) return { errors: ['The file contains no records.'] }
  if (data.documents.length > MAX_RECORDS) return { errors: [`The file has ${data.documents.length} records; the limit is ${MAX_RECORDS}.`] }

  const seen = new Set<string>()
  data.documents.forEach((record, index) => {
    const row = `Record ${index + 1}`
    if (!record || typeof record !== 'object') return errors.push(`${row} is not an object.`)
    const { slug, title } = record as Record<string, unknown>
    const article = (record as { article?: { publishedAt?: unknown } }).article
    const publishedAt = article?.publishedAt ?? (record as Record<string, unknown>).publishedAt
    if (typeof slug !== 'string' || !slug.trim()) errors.push(`${row} is missing a slug.`)
    else if (seen.has(slug)) errors.push(`${row} repeats the slug "${slug}".`)
    else seen.add(slug)
    if (typeof title !== 'string' || !title.trim()) errors.push(`${row} is missing a title.`)
    if (collection === 'blog' && !publishedAt) errors.push(`${row} is missing publishedAt.`)
  })
  return errors.length ? { errors: errors.slice(0, 10) } : { data: data as ExportFile, errors }
}

const css = `
.ct-actions{display:flex;gap:.5rem;margin:0 0 1rem}
.ct-btn{padding:.5rem .9rem;border:1px solid var(--theme-elevation-250);border-radius:4px;background:var(--theme-elevation-0);color:var(--theme-text);cursor:pointer;font:inherit}
.ct-btn:hover:not(:disabled){background:var(--theme-elevation-100)}
.ct-btn--primary{background:var(--theme-text);color:var(--theme-bg);border-color:var(--theme-text)}
.ct-btn:disabled{opacity:.5;cursor:not-allowed}
.ct-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:rgba(0,0,0,.55);padding:1rem}
.ct-modal{width:min(560px,100%);max-height:90vh;overflow:auto;border-radius:8px;background:var(--theme-bg);color:var(--theme-text);padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.ct-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.ct-head h2{margin:0}
.ct-drop{display:grid;gap:.5rem;place-items:center;text-align:center;padding:2rem 1rem;border:2px dashed var(--theme-elevation-250);border-radius:8px;cursor:pointer}
.ct-drop--over{border-color:var(--theme-success-500);background:var(--theme-elevation-50)}
.ct-errors{color:var(--theme-error-500);padding-left:1.1rem}
.ct-foot{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.25rem}
.ct-muted{color:var(--theme-elevation-600);font-size:.875rem}
`

export default function ContentTransferButtons() {
  const collectionSlug = /\/collections\/([^/?#]+)/.exec(usePathname())?.[1] ?? ''
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [data, setData] = useState<ExportFile | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const label = LABELS[collectionSlug] ?? ''
  const close = useCallback(() => {
    setMode(null)
    setData(null)
    setPreview(null)
    setErrors([])
    setMessage('')
    setFileName('')
  }, [])

  useEffect(() => {
    if (!mode) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, busy, close])

  if (!label) return null

  async function chooseFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setData(null)
    setPreview(null)
    setMessage('')
    const result = await verifyFile(file, collectionSlug)
    setErrors(result.errors)
    if (!result.data) return
    setBusy(true)
    try {
      const response = await fetch(`/api/${collectionSlug}/transfer/preview`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })
      const body = (await response.json()) as Preview & { error?: string }
      if (!response.ok && !body.errors?.length) throw new Error(body.error ?? `Preview failed (${response.status}).`)
      setPreview(body)
      setErrors(body.errors ?? [])
      if (!body.errors?.length) setData(result.data)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not check this file.'])
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!data) return
    setBusy(true)
    try {
      const response = await fetch(`/api/${collectionSlug}/transfer/commit`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, confirmed: true }),
      })
      const body = (await response.json()) as { imported?: string[]; errors?: string[]; error?: string }
      if (!response.ok && !body.errors?.length) throw new Error(body.error ?? `Import failed (${response.status}).`)
      setErrors(body.errors ?? [])
      setData(null)
      setPreview(null)
      setMessage(`Imported ${body.imported?.length ?? 0} record(s). Refresh the list to see them.`)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Import failed.'])
    } finally {
      setBusy(false)
    }
  }

  async function exportContent() {
    setBusy(true)
    setErrors([])
    try {
      const response = await fetch(`/api/${collectionSlug}/transfer/export`, { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`Export failed (${response.status}).`)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `canopy-${collectionSlug}-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Export downloaded.')
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Export failed.'])
    } finally {
      setBusy(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragOver(false)
    void chooseFile(event.dataTransfer.files?.[0])
  }

  return (
    <>
      <style>{css}</style>
      <div className="ct-actions">
        <button type="button" className="ct-btn" onClick={() => setMode('import')}>
          Import
        </button>
        <button type="button" className="ct-btn" onClick={() => setMode('export')}>
          Export
        </button>
      </div>

      {mode && (
        <div className="ct-overlay" onMouseDown={(event) => event.target === event.currentTarget && !busy && close()}>
          <div className="ct-modal" role="dialog" aria-modal="true" aria-label={`${mode === 'import' ? 'Import' : 'Export'} ${label}`}>
            <div className="ct-head">
              <h2>
                {mode === 'import' ? 'Import' : 'Export'} {label}
              </h2>
              <button type="button" className="ct-btn" onClick={close} disabled={busy} aria-label="Close">
                ✕
              </button>
            </div>

            {mode === 'export' ? (
              <p className="ct-muted">Download every {label.toLowerCase()} record (including drafts) as a JSON file you can re-import elsewhere.</p>
            ) : (
              <>
                <div
                  className={`ct-drop${dragOver ? ' ct-drop--over' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => input.current?.click()}
                  onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && input.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <strong>{fileName || 'Drop a .json file here, or click to browse'}</strong>
                  <span className="ct-muted">Canopy JSON export · max 5 MB · up to {MAX_RECORDS} records · matched by slug</span>
                </div>
                <input
                  ref={input}
                  type="file"
                  hidden
                  accept=".json,application/json"
                  onChange={(event) => {
                    void chooseFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                {preview && !errors.length && (
                  <p role="status">
                    Ready: {preview.creates.length} new, {preview.updates.length} existing record(s) will be replaced.
                  </p>
                )}
              </>
            )}

            {message && <p role="status">{message}</p>}
            {errors.length > 0 && (
              <ul className="ct-errors" role="alert">
                {errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            )}

            <div className="ct-foot">
              <button type="button" className="ct-btn" onClick={close} disabled={busy}>
                Close
              </button>
              {mode === 'export' ? (
                <button type="button" className="ct-btn ct-btn--primary" onClick={() => void exportContent()} disabled={busy}>
                  {busy ? 'Exporting…' : 'Download JSON'}
                </button>
              ) : (
                <button type="button" className="ct-btn ct-btn--primary" onClick={() => void commit()} disabled={busy || !data}>
                  {busy ? 'Working…' : 'Upload & import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
