import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { reportError } from './error-reporting'

describe('reportError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T08:00:00.000Z'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('given an Error instance', () => {
    it('should report its message and stack', () => {
      const error = new Error('Failed to store token securely.')
      const report = reportError(error)

      expect(report.message).toBe('Failed to store token securely.')
      expect(report.stack).toBe(error.stack)
    })
  })

  describe('given a non-Error value', () => {
    it('should stringify it as the message, with no stack', () => {
      const report = reportError('a rejected string')

      expect(report.message).toBe('a rejected string')
      expect(report.stack).toBeUndefined()
    })
  })

  describe('given a context', () => {
    it('should include it in the report', () => {
      const report = reportError(new Error('boom'), 'unhandledrejection')

      expect(report.context).toBe('unhandledrejection')
    })
  })

  it('should timestamp the report', () => {
    const report = reportError(new Error('boom'))

    expect(report.timestamp).toBe('2026-08-23T08:00:00.000Z')
  })

  it('should log the report', () => {
    const report = reportError(new Error('boom'))

    expect(console.error).toHaveBeenCalledWith('[error-report]', report)
  })
})
