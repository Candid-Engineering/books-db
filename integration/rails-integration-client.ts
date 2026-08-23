import { TAURI_INTEGRATION_BASE_URL as BASE_URL } from './config'

export async function createFactory<T>(name: string, attrs: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}/tauri_integration/factories/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attrs),
  })
  if (!response.ok) {
    throw new Error(`Failed to create '${name}' factory: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

export async function fetchLoginToken(email: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/tauri_integration/users/${encodeURIComponent(email)}/login_token`)
  if (!response.ok) {
    throw new Error(`Failed to fetch login token for '${email}': ${response.status} ${await response.text()}`)
  }
  const body = (await response.json()) as { login_token: string }
  return body.login_token
}
