import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import BookDetail from './BookDetail.svelte'
import { booksStoreWith } from '../../testing/component-helpers'

describe('BookDetail', () => {
  it('shows the ISBNs and the acquired date', async () => {
    const store = await booksStoreWith([
      { title: 'Dune', isbn10: '0441172717', isbn13: '9780441172719' },
    ])
    render(BookDetail, { book: store.value[0], booksStore: store })

    expect(screen.getByRole('textbox', { name: 'ISBN-10' }).innerText).toBe('0441172717')
    expect(screen.getByRole('textbox', { name: 'ISBN-13' }).innerText).toBe('9780441172719')
    expect(screen.getByText(/Added/)).toBeInTheDocument()
  })

  it('saves an edited ISBN through the store', async () => {
    const store = await booksStoreWith([{ title: 'Dune', isbn13: '9780441172719' }])
    const book = store.value[0]
    const editSpy = vi.spyOn(store, 'edit')
    render(BookDetail, { book, booksStore: store })

    const field = screen.getByRole('textbox', { name: 'ISBN-13' })
    field.innerText = '9999999999999'
    await fireEvent.input(field)
    await fireEvent.blur(field)

    expect(editSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: book.id, isbn13: '9999999999999' })
    )
  })
})
