import { describe, it, expect, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../../testing/msw-setup'
import {
  AuthApiError,
  requestLoginLink,
  exchangeLoginTokenForRefreshToken,
  exchangeRefreshTokenForAuthToken,
} from './auth-api'

const BASE_URL = 'http://localhost:3000'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requestLoginLink', () => {
  it('should resolve on success', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tokens/request_login_link`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: 'reader@example.com' })
        return HttpResponse.json({}, { status: 201 })
      })
    )

    await expect(requestLoginLink('reader@example.com')).resolves.toBeUndefined()
  })

  it('should throw AuthApiError when the email is not registered', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tokens/request_login_link`, () => {
        return HttpResponse.json({ error: 'No such user' }, { status: 422 })
      })
    )

    await expect(requestLoginLink('nobody@example.com')).rejects.toMatchObject({
      message: 'No such user',
    })
  })
})

describe('exchangeLoginTokenForRefreshToken', () => {
  it('should map the wire response to camelCase on success', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tokens/refresh`, async ({ request }) => {
        expect(await request.json()).toEqual({ login_token: 'login-token-123' })
        return HttpResponse.json(
          { token: 'refresh-token-abc', token_type: 'refresh', expires_in: 31536000 },
          { status: 201 }
        )
      })
    )

    await expect(exchangeLoginTokenForRefreshToken('login-token-123')).resolves.toEqual({
      refreshToken: 'refresh-token-abc',
      expiresIn: 31536000,
    })
  })

  it('should throw AuthApiError with the code from the errors array on failure', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tokens/refresh`, () => {
        return HttpResponse.json(
          { errors: [{ code: 'token_expired', message: 'Token has expired' }] },
          { status: 400 }
        )
      })
    )

    const error = await exchangeLoginTokenForRefreshToken('expired-token').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error).toMatchObject({ code: 'token_expired', message: 'Token has expired' })
  })
})

describe('exchangeRefreshTokenForAuthToken', () => {
  it('should map the wire response, including the nested user, to camelCase on success', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tokens/auth`, async ({ request }) => {
        expect(await request.json()).toEqual({ refresh_token: 'refresh-token-abc' })
        return HttpResponse.json(
          {
            token: 'auth-token-xyz',
            token_type: 'auth',
            expires_in: 900,
            user: {
              id: 'user-1',
              name: 'Ada Reader',
              email: 'reader@example.com',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          },
          { status: 201 }
        )
      })
    )

    await expect(exchangeRefreshTokenForAuthToken('refresh-token-abc')).resolves.toEqual({
      authToken: 'auth-token-xyz',
      expiresIn: 900,
      user: { id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' },
    })
  })

  it('should throw AuthApiError on an invalid refresh token', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/tokens/auth`, () => {
        return HttpResponse.json(
          { errors: [{ code: 'token_invalid', message: 'Token is invalid or malformed' }] },
          { status: 400 }
        )
      })
    )

    const error = await exchangeRefreshTokenForAuthToken('garbage').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthApiError)
    expect(error).toMatchObject({ code: 'token_invalid', message: 'Token is invalid or malformed' })
  })
})

describe('base URL configuration', () => {
  it('should use VITE_API_BASE_URL when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    mockServer.use(
      http.post('https://api.example.com/tokens/request_login_link', () => {
        return HttpResponse.json({}, { status: 201 })
      })
    )

    await expect(requestLoginLink('reader@example.com')).resolves.toBeUndefined()
  })
})
