import type { DiffOptions } from 'vitest'
import c from 'picocolors'

export default {
  aColor: (input): string => c.red(c.bold(input)),
  bColor: (input): string => c.green(c.bold(input)),
  aIndicator: '--',
  bIndicator: '++',
} satisfies DiffOptions
