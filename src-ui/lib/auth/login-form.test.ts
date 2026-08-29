import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../../testing/msw-setup'
import { setupMockKeyring } from '../../testing/mock-keyring'
import { KeychainTokenStorage } from './token-storage'
import { DrizzleLocalUserStore } from './local-user-store'
import { createTestAuthStore, type AuthStore } from './auth-store.svelte'
import { testDb } from '../../testing/db-setup'
import { LoginForm } from './login-form.svelte'

const BASE_URL = 'http://localhost:3000'

describe('LoginForm', () => {
  let authStore: AuthStore
  let form: LoginForm

  beforeEach(() => {
    setupMockKeyring()
    authStore = createTestAuthStore(
      new KeychainTokenStorage(),
      new DrizzleLocalUserStore(testDb.drizzle)
    )
    form = new LoginForm(authStore)
  })

  describe('when created', () => {
    it('should start on the email step', () => {
      expect(form.step).toBe('email')
    })
  })

  describe('submitRegistration', () => {
    describe('with a new email and name', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/users`, () => {
            return HttpResponse.json(
              { user: { id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' } },
              { status: 201 }
            )
          })
        )
        form.email = 'reader@example.com'
        form.name = 'Ada Reader'
      })

      it('should advance to the enter-token step', async () => {
        await form.submitRegistration()
        expect(form.step).toBe('enter-token')
      })
    })

    describe('with an already-registered email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/users`, () => {
            return HttpResponse.json({ email: ['has already been taken'] }, { status: 422 })
          })
        )
        form.step = 'register'
        form.email = 'reader@example.com'
        form.name = 'Ada Reader'
      })

      it('should stay on the register step', async () => {
        await form.submitRegistration()
        expect(form.step).toBe('register')
      })

      it('should surface the error', async () => {
        await form.submitRegistration()
        expect(form.error).toBe('Email has already been taken')
      })
    })
  })

  describe('submitToken', () => {
    describe('with a valid token', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/refresh`, () => {
            return HttpResponse.json(
              { token: 'refresh-token-abc', token_type: 'refresh', expires_in: 31536000 },
              { status: 201 }
            )
          }),
          http.post(`${BASE_URL}/tokens/auth`, () => {
            return HttpResponse.json(
              {
                token: 'auth-token-xyz',
                token_type: 'auth',
                expires_in: 900,
                user: { id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' },
              },
              { status: 201 }
            )
          })
        )
        form.token = 'login-token-123'
      })

      it('should authenticate', async () => {
        await form.submitToken()
        expect(authStore.state.isAuthenticated).toBe(true)
      })
    })

    describe('with an invalid token', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/refresh`, () => {
            return HttpResponse.json(
              { errors: [{ code: 'token_invalid', message: 'Token is invalid or malformed' }] },
              { status: 400 }
            )
          })
        )
        form.token = 'garbage'
      })

      it('should not authenticate', async () => {
        await form.submitToken()
        expect(authStore.state.isAuthenticated).toBe(false)
      })

      it('should surface the error', async () => {
        await form.submitToken()
        expect(form.error).toBe('Token is invalid or malformed')
      })
    })
  })

  describe('submitEmail', () => {
    describe('with a registered email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/request_login_link`, () => {
            return HttpResponse.json({}, { status: 201 })
          })
        )
        form.email = 'reader@example.com'
      })

      it('should advance to the enter-token step', async () => {
        await form.submitEmail()
        expect(form.step).toBe('enter-token')
      })
    })

    describe('with an unregistered email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/request_login_link`, () => {
            return HttpResponse.json({ error: 'No such user' }, { status: 422 })
          })
        )
        form.email = 'nobody@example.com'
      })

      it('should fall back to the register step', async () => {
        await form.submitEmail()
        expect(form.step).toBe('register')
      })
    })

    describe('with an unexpected failure', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/request_login_link`, () => {
            return HttpResponse.json({ error: 'Something went wrong' }, { status: 500 })
          })
        )
        form.email = 'reader@example.com'
      })

      it('should stay on the email step', async () => {
        await form.submitEmail()
        expect(form.step).toBe('email')
      })

      it('should surface the error', async () => {
        await form.submitEmail()
        expect(form.error).toBe('Something went wrong')
      })
    })
  })
})
