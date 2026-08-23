import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../src-ui/testing/msw-setup'
import { createFactory, fetchLoginToken } from './rails-integration-client'

const BASE_URL = 'http://localhost:3099'

describe('createFactory', () => {
  it('should POST the attrs to /tauri_integration/factories/:name and return the parsed record', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tauri_integration/factories/user`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: 'reader@example.com', name: 'Ada Reader' })
        return HttpResponse.json(
          { id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' },
          { status: 201 }
        )
      })
    )

    await expect(
      createFactory('user', { email: 'reader@example.com', name: 'Ada Reader' })
    ).resolves.toEqual({ id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' })
  })

  it('should throw when the server responds with an error', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tauri_integration/factories/user`, () => {
        return HttpResponse.json({ error: 'boom' }, { status: 422 })
      })
    )

    await expect(createFactory('user', {})).rejects.toThrow(/422/)
  })
})

describe('fetchLoginToken', () => {
  it('should GET /tauri_integration/users/:email/login_token and return the token', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/tauri_integration/users/reader%40example.com/login_token`, () => {
        return HttpResponse.json({ login_token: 'login-token-abc' }, { status: 200 })
      })
    )

    await expect(fetchLoginToken('reader@example.com')).resolves.toBe('login-token-abc')
  })

  it('should throw when no such user exists', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/tauri_integration/users/nobody%40example.com/login_token`, () => {
        return HttpResponse.json({ error: 'No such user' }, { status: 404 })
      })
    )

    await expect(fetchLoginToken('nobody@example.com')).rejects.toThrow(/404/)
  })
})
