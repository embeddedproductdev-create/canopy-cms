import { describe, expect, it } from 'vitest'
import { legacyBodyToMarkdown } from '../../src/migrations/20261028_000000_blog_markdown_content'

describe('Blog Markdown content migration', () => {
  it('converts legacy Lexical headings, paragraphs, lists, links, and tables to Markdown', () => {
    const body = JSON.stringify({
      root: {
        children: [
          { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Choosing a protocol' }] },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Read the ' },
              { type: 'link', url: 'https://example.com', children: [{ type: 'text', text: 'guide' }] },
              { type: 'text', text: '.' },
            ],
          },
          {
            type: 'list',
            listType: 'bullet',
            children: [{ type: 'listitem', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Range' }] }] }],
          },
          {
            type: 'table',
            children: [
              { children: [{ children: [{ type: 'text', text: 'Protocol' }] }, { children: [{ type: 'text', text: 'Range' }] }] },
              { children: [{ children: [{ type: 'text', text: 'BLE' }] }, { children: [{ type: 'text', text: 'Short' }] }] },
            ],
          },
        ],
      },
    })

    expect(legacyBodyToMarkdown(body)).toContain('## Choosing a protocol')
    expect(legacyBodyToMarkdown(body)).toContain('[guide](https://example.com)')
    expect(legacyBodyToMarkdown(body)).toContain('- Range')
    expect(legacyBodyToMarkdown(body)).toContain('| Protocol | Range |')
    expect(legacyBodyToMarkdown(body)).toContain('| --- | --- |')
  })

  it('preserves non-JSON legacy body values', () => {
    expect(legacyBodyToMarkdown('Plain article text')).toBe('Plain article text')
  })
})
