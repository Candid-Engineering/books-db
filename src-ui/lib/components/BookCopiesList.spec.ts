import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import BookCopiesList from './BookCopiesList.svelte'
import { booksStoreWith } from '../../testing/component-helpers'

const twoCopies = [
  { title: 'Dune', isbn13: '9780441172719' },
  { title: 'Dune', isbn13: '9780441172719' },
]

describe('BookCopiesList', () => {
  it('shows the copy count and a line per copy', async () => {
    const store = await booksStoreWith(twoCopies)
    render(BookCopiesList, { books: store.value, booksStore: store })

    expect(screen.getByText(/Copies \(2\)/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByText(/acquired/i)).toHaveLength(2)
  })

  it("toggles one copy's read state", async () => {
    const store = await booksStoreWith(twoCopies)
    const spy = vi.spyOn(store, 'edit')
    render(BookCopiesList, { books: store.value, booksStore: store })

    await fireEvent.click(screen.getByRole('checkbox', { name: /copy 1 read/i }))

    const arg = spy.mock.calls[0][0]
    expect(arg.id).toBe(store.value[0].id)
    expect(arg.readAt).toBeInstanceOf(Date)
  })

  it('deletes one copy', async () => {
    const store = await booksStoreWith(twoCopies)
    const spy = vi.spyOn(store, 'remove')
    render(BookCopiesList, { books: store.value, booksStore: store })

    await fireEvent.click(screen.getByRole('button', { name: /delete copy 2/i }))

    expect(spy).toHaveBeenCalledWith(store.value[1].id)
  })
})
