import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../src-ui/testing/msw-setup'
import { isServerUp, waitForServer } from './wait-for-server'

const HEALTH_URL = 'http://localhost:3099/up'

describe('isServerUp', () => {
  it('should return true when the health check responds ok', async () => {
    mockServer.use(http.get(HEALTH_URL, () => HttpResponse.text('ok', { status: 200 })))
    await expect(isServerUp(HEALTH_URL)).resolves.toBe(true)
  })

  it('should return false when the health check responds with an error status', async () => {
    mockServer.use(http.get(HEALTH_URL, () => HttpResponse.text('error', { status: 500 })))
    await expect(isServerUp(HEALTH_URL)).resolves.toBe(false)
  })

  it('should return false when the connection fails outright', async () => {
    mockServer.use(http.get(HEALTH_URL, () => HttpResponse.error()))
    await expect(isServerUp(HEALTH_URL)).resolves.toBe(false)
  })
})

describe('waitForServer', () => {
  it('should resolve once the server comes up within the timeout', async () => {
    let attempt = 0
    mockServer.use(
      http.get(HEALTH_URL, () => {
        attempt += 1
        return attempt < 3 ? HttpResponse.error() : HttpResponse.text('ok', { status: 200 })
      })
    )

    await expect(
      waitForServer(HEALTH_URL, { timeoutMs: 1000, intervalMs: 5 })
    ).resolves.toBeUndefined()
    expect(attempt).toBe(3)
  })

  it('should reject if the server never comes up within the timeout', async () => {
    mockServer.use(http.get(HEALTH_URL, () => HttpResponse.error()))

    await expect(waitForServer(HEALTH_URL, { timeoutMs: 20, intervalMs: 5 })).rejects.toThrow(
      /did not become healthy/
    )
  })
})
