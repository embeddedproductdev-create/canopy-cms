'use client'

import { useField } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'

/** Turns the first table found in pasted HTML (Word, Google Docs, web pages) into a Markdown pipe table. */
export function htmlTableToMarkdown(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null
  const cell = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()
  const rows = Array.from(table.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map(cell))
  const width = Math.max(0, ...rows.map((row) => row.length))
  if (!rows.length || !width) return null
  const pad = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? '')
  const line = (row: string[]) => `| ${pad(row).join(' | ')} |`
  const [head, ...body] = rows
  return [line(head), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n')
}

/**
 * Sits after a Markdown textarea. When a table is pasted, it is inserted as a Markdown table instead of the
 * tab-separated text browsers produce for a plain-text paste. Everything else pastes as normal.
 */
export default function PasteTables({ path }: { path?: string }) {
  const { value, setValue } = useField<string>({ path: path ?? '' })
  const marker = useRef<HTMLSpanElement>(null)
  const latest = useRef({ value, setValue })
  latest.current = { value, setValue }

  useEffect(() => {
    const textarea = marker.current?.closest('.field-type')?.querySelector('textarea')
    if (!textarea) return
    const onPaste = (event: ClipboardEvent) => {
      const html = event.clipboardData?.getData('text/html')
      const markdown = html ? htmlTableToMarkdown(html) : null
      if (!markdown) return
      event.preventDefault()
      const current = latest.current.value ?? ''
      const start = textarea.selectionStart ?? current.length
      const end = textarea.selectionEnd ?? start
      const before = current.slice(0, start)
      const after = current.slice(end)
      const insert = `${before && !before.endsWith('\n') ? '\n\n' : ''}${markdown}\n${after && !after.startsWith('\n') ? '\n' : ''}`
      latest.current.setValue(`${before}${insert}${after}`)
    }
    textarea.addEventListener('paste', onPaste)
    return () => textarea.removeEventListener('paste', onPaste)
  }, [])

  return <span ref={marker} hidden />
}
