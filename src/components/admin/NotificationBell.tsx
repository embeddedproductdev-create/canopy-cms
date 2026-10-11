'use client'
import React, { useCallback, useEffect, useState } from 'react'

type Row = {
  id: number
  form: string
  email: string
  name?: string
  company?: string
  scope?: string
  message?: string
  checklist?: string
  source?: string
  data?: Record<string, unknown>
  status: 'new' | 'read' | 'archived'
  createdAt: string
  archivedAt?: string | null
}

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/form-submission${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const daysLeft = (iso?: string | null) => (iso ? Math.max(0, 60 - Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 60)

const btn: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
}

/**
 * Header bell: website form submissions as notifications. Opens a drawer on the right.
 * "Delete" archives a notification; deleting from the Archive removes it permanently;
 * archived items are purged automatically after 60 days.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'inbox' | 'archive'>('inbox')
  const [rows, setRows] = useState<Row[]>([])
  const [newCount, setNewCount] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const status = tab === 'inbox' ? 'where[status][not_equals]=archived' : 'where[status][equals]=archived'
      const [list, count] = await Promise.all([
        api(`?${status}&sort=-createdAt&limit=100&depth=0`).then((r): Promise<{ docs?: Row[]; totalDocs?: number }> => r.json()),
        api('?where[status][equals]=new&limit=1&depth=0').then((r): Promise<{ docs?: Row[]; totalDocs?: number }> => r.json()),
      ])
      setRows(list.docs ?? [])
      setNewCount(count.totalDocs ?? 0)
    } catch {
      /* not signed in yet */
    }
  }, [tab])

  useEffect(() => {
    api('/purge-archive', { method: 'POST' }).catch((): void => undefined)
  }, [])
  useEffect(() => {
    void load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const patch = async (row: Row, body: Partial<Row>) => {
    await api(`/${row.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    await load()
  }
  const remove = async (row: Row) => {
    if (!window.confirm('Delete this submission permanently?')) return
    await api(`/${row.id}`, { method: 'DELETE' })
    setActive(null)
    await load()
  }
  const toggle = (row: Row) => {
    setActive(active === row.id ? null : row.id)
    if (row.status === 'new') void patch(row, { status: 'read' })
  }

  const fields = (row: Row): [string, unknown][] =>
    Object.entries({ Name: row.name, Company: row.company, Scope: row.scope, Message: row.message, Checklist: row.checklist, Page: row.source, ...(row.data ?? {}) }).filter(
      ([, v], i, all) => v !== undefined && v !== '' && v !== null && all.findIndex(([, w]) => w === v) === i,
    )

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--theme-text)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {newCount > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, background: '#305e31', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px' }}>
            {newCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 1000 }} />
          <aside
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw', background: 'var(--theme-bg)', color: 'var(--theme-text)', borderLeft: '1px solid var(--theme-elevation-150)', zIndex: 1001, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,.15)' }}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--theme-elevation-150)' }}>
              <strong style={{ fontSize: 16 }}>Notifications</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ ...btn, border: 'none', fontSize: 18 }}>
                ✕
              </button>
            </header>
            <nav style={{ display: 'flex', gap: 8, padding: '10px 20px' }}>
              {(['inbox', 'archive'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setTab(name)
                    setActive(null)
                  }}
                  style={{ ...btn, background: tab === name ? '#305e31' : btn.background, color: tab === name ? '#fff' : 'inherit', textTransform: 'capitalize' }}
                >
                  {name}
                </button>
              ))}
            </nav>
            {tab === 'archive' && <p style={{ margin: '0 20px 8px', fontSize: 12, opacity: 0.7 }}>Archived items are deleted permanently after 60 days.</p>}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
              {rows.length === 0 && <p style={{ padding: 20, opacity: 0.6 }}>{tab === 'inbox' ? 'No notifications.' : 'Archive is empty.'}</p>}
              {rows.map((row) => (
                <div key={row.id} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, margin: 8, background: row.status === 'new' ? 'var(--theme-elevation-50)' : 'transparent' }}>
                  <button type="button" onClick={() => toggle(row)} style={{ all: 'unset', display: 'block', width: 'calc(100% - 24px)', padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: row.status === 'new' ? 700 : 500 }}>
                        {row.status === 'new' && '● '}
                        {row.email}
                      </span>
                      <span style={{ fontSize: 11, textTransform: 'capitalize', opacity: 0.7 }}>{row.form}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>
                      {when(row.archivedAt && tab === 'archive' ? row.archivedAt : row.createdAt)}
                      {tab === 'archive' && ` · ${daysLeft(row.archivedAt)} days left`}
                    </div>
                  </button>
                  {active === row.id && (
                    <div style={{ padding: '0 12px 12px', fontSize: 13 }}>
                      <dl style={{ margin: '0 0 10px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
                        {fields(row).map(([key, value]) => (
                          <React.Fragment key={key}>
                            <dt style={{ opacity: 0.6, textTransform: 'capitalize' }}>{key}</dt>
                            <dd style={{ margin: 0, wordBreak: 'break-word' }}>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={`/admin/collections/form-submission/${row.id}`} style={{ ...btn, textDecoration: 'none' }}>
                          Open
                        </a>
                        {tab === 'inbox' ? (
                          <button type="button" style={btn} onClick={() => patch(row, { status: 'archived', archivedAt: new Date().toISOString() })}>
                            Delete
                          </button>
                        ) : (
                          <>
                            <button type="button" style={btn} onClick={() => patch(row, { status: 'read', archivedAt: null })}>
                              Restore
                            </button>
                            <button type="button" style={{ ...btn, color: '#b3261e' }} onClick={() => remove(row)}>
                              Delete permanently
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  )
}
