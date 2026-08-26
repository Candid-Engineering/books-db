export class ErrorToastStore {
  message = $state<string | null>(null)

  show(message: string): void {
    this.message = message
  }

  dismiss(): void {
    this.message = null
  }
}

export const errorToast = new ErrorToastStore()
