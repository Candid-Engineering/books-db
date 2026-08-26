export interface ReportedError {
  message: string
  stack?: string
  context?: string
  timestamp: string
}

export function reportError(error: unknown, context?: string): ReportedError {
  const report: ReportedError = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  }

  // Stub: no error-reporting endpoint exists yet. Logging in a structured
  // shape now so swapping in a real POST later is a one-line change.
  console.error('[error-report]', report)

  return report
}
