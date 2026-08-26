import type { AuthStore } from './auth-store.svelte'

export type LoginFormStep = 'email' | 'register' | 'enter-token'

export class LoginForm {
  step = $state<LoginFormStep>('email')
  email = $state('')
  name = $state('')
  token = $state('')

  constructor(private authStore: AuthStore) {}

  get isLoading(): boolean {
    return this.authStore.state.isLoading
  }

  get error(): string | null {
    return this.authStore.state.error
  }

  async submitToken(): Promise<void> {
    await this.authStore.exchangeLoginToken(this.token)
  }

  async submitRegistration(): Promise<void> {
    await this.authStore.register(this.email, this.name)
    if (!this.authStore.state.error) {
      this.step = 'enter-token'
    }
  }

  async submitEmail(): Promise<void> {
    await this.authStore.requestLoginLink(this.email)
    if (!this.authStore.state.error) {
      this.step = 'enter-token'
    } else if (this.authStore.state.error === 'No such user') {
      this.step = 'register'
    }
  }
}
