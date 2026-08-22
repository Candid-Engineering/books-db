export interface RefreshTokenResult {
  refreshToken: string
  expiresIn: number // seconds
}

export interface AuthTokenResult {
  authToken: string
  expiresIn: number // seconds
  user: { id: string; name: string; email: string }
}

interface RailsTokenErrorBody {
  errors: { code: string; message: string }[]
}

interface RailsGenericErrorBody {
  error: string
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  const responseBody: unknown = await response.json()

  if (!response.ok) {
    throw toAuthApiError(responseBody)
  }

  return responseBody as T
}

function toAuthApiError(body: unknown): AuthApiError {
  if (isRailsTokenErrorBody(body)) {
    const [firstError] = body.errors
    return new AuthApiError(firstError.message, firstError.code)
  }
  if (isRailsGenericErrorBody(body)) {
    return new AuthApiError(body.error, 'unknown')
  }
  return new AuthApiError('Request failed', 'unknown')
}

function isRailsTokenErrorBody(body: unknown): body is RailsTokenErrorBody {
  return typeof body === 'object' && body !== null && Array.isArray((body as RailsTokenErrorBody).errors)
}

function isRailsGenericErrorBody(body: unknown): body is RailsGenericErrorBody {
  return typeof body === 'object' && body !== null && typeof (body as RailsGenericErrorBody).error === 'string'
}

export async function requestLoginLink(email: string): Promise<void> {
  await postJson('/tokens/request_login_link', { email })
}

export async function exchangeLoginTokenForRefreshToken(loginToken: string): Promise<RefreshTokenResult> {
  const body = await postJson<{ token: string; expires_in: number }>('/tokens/refresh', {
    login_token: loginToken,
  })
  return { refreshToken: body.token, expiresIn: body.expires_in }
}

export async function exchangeRefreshTokenForAuthToken(refreshToken: string): Promise<AuthTokenResult> {
  const body = await postJson<{
    token: string
    expires_in: number
    user: { id: string; name: string; email: string }
  }>('/tokens/auth', { refresh_token: refreshToken })

  return {
    authToken: body.token,
    expiresIn: body.expires_in,
    user: { id: body.user.id, name: body.user.name, email: body.user.email },
  }
}
