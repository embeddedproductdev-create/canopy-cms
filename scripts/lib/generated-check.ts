/**
 * Generated files listed in `git status --porcelain` output, i.e. changed or new but not committed. The deploy
 * workflow regenerates them from what is pushed and fails when they differ, so each must be committed first.
 */
export function uncommittedFiles(files: string[], porcelain: string): string[] {
  const changed = new Set(
    porcelain
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.slice(3).trim().replace(/^"(.*)"$/, '$1')),
  )
  return files.filter((file) => changed.has(file))
}
