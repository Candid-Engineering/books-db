import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import AddBookModal from './AddBookModal.svelte'

describe('AddBookModal', () => {
  it('orders the form fields with the ISBNs last', () => {
    render(AddBookModal, { isOpen: true, close: vi.fn() })

    const labels = [...document.querySelectorAll('.modal .label')].map((l) => l.textContent?.trim())
    expect(labels).toEqual(['Title', 'Author(s)', 'Tags', 'ISBN-10', 'ISBN-13'])
  })
})
