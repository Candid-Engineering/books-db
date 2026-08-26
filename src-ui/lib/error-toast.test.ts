import { describe, it, expect, beforeEach } from 'vitest'
import { ErrorToastStore } from './error-toast.svelte'

describe('ErrorToastStore', () => {
  let toast: ErrorToastStore

  beforeEach(() => {
    toast = new ErrorToastStore()
  })

  describe('when created', () => {
    it('should have no message', () => {
      expect(toast.message).toBeNull()
    })
  })

  describe('show', () => {
    it('should set the message', () => {
      toast.show('Something went wrong')
      expect(toast.message).toBe('Something went wrong')
    })
  })

  describe('dismiss', () => {
    it('should clear the message', () => {
      toast.show('Something went wrong')
      toast.dismiss()
      expect(toast.message).toBeNull()
    })
  })
})
