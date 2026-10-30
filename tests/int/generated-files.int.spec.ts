import { describe, expect, it } from 'vitest'
import { uncommittedFiles } from '../../scripts/lib/generated-check'

describe('generated files the deploy workflow checks', () => {
  it('reports a generated file that differs from what is committed, since CI builds from git', () => {
    const status = ' M CMS-GUIDE.md\n?? scripts/lib/expected-schema.json\nM  src/payload-types.ts\n'
    expect(uncommittedFiles(['CMS-GUIDE.md', 'CONTENT-MAP.md', 'scripts/lib/expected-schema.json', 'src/payload-types.ts'], status)).toEqual([
      'CMS-GUIDE.md',
      'scripts/lib/expected-schema.json',
      'src/payload-types.ts',
    ])
  })

  it('reports nothing when every generated file is committed', () => {
    expect(uncommittedFiles(['CMS-GUIDE.md'], '')).toEqual([])
  })

  it('matches paths with spaces and brackets as git prints them', () => {
    expect(uncommittedFiles(['src/app/(payload)/admin/importMap.js'], ' M "src/app/(payload)/admin/importMap.js"\n')).toEqual(['src/app/(payload)/admin/importMap.js'])
  })
})
