import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import BooksTableRow from './BooksTableRow.svelte'
import { booksStoreWith } from '../../testing/component-helpers'
import { groupByEdition } from '$lib/duplicates'
import type { NewBook } from '$lib/types/book.js'

const renderGroup = async (seed: NewBook[]) => {
  const store = await booksStoreWith(seed)
  const [group] = groupByEdition(store.value)
  return { store, group, ...render(BooksTableRow, { books: group, booksStore: store }) }
}

const twoCopies: NewBook[] = [
  { title: 'Dune', isbn13: '9780441172719' },
  { title: 'Dune', isbn13: '9780441172719' },
]

describe('BooksTableRow — single copy', () => {
  const renderOne = () => renderGroup([{ title: 'Dune', isbn13: '9780441172719' }])

  it('keeps ISBNs out of the collapsed row', async () => {
    await renderOne()
    expect(screen.queryByRole('textbox', { name: /isbn/i })).not.toBeInTheDocument()
  })

  it('reveals the detail panel when expanded, and hides it again', async () => {
    await renderOne()
    await fireEvent.click(screen.getByRole('button', { name: /expand/i }))
    expect(screen.getByRole('textbox', { name: 'ISBN-13' }).innerText).toBe('9780441172719')

    await fireEvent.click(screen.getByRole('button', { name: /collapse/i }))
    expect(screen.queryByRole('textbox', { name: 'ISBN-13' })).not.toBeInTheDocument()
  })

  it('has a delete control and no copy-count badge', async () => {
    await renderOne()
    expect(screen.getByRole('button', { name: 'delete book' })).toBeInTheDocument()
    expect(screen.queryByText(/^×\d/)).not.toBeInTheDocument()
  })

  it('edits the title inline', async () => {
    const { store } = await renderOne()
    const spy = vi.spyOn(store, 'editGroup')

    const field = screen.getByRole('textbox', { name: /title/i })
    field.innerText = 'Dune (Deluxe)'
    await fireEvent.input(field)
    await fireEvent.blur(field)

    expect(spy).toHaveBeenCalledWith(
      store.value,
      expect.objectContaining({ title: 'Dune (Deluxe)' })
    )
  })
})

describe('BooksTableRow — grouped copies', () => {
  it('shows a ×N badge', async () => {
    await renderGroup([...twoCopies, { title: 'Dune', isbn13: '9780441172719' }])
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('edits a converged field once for the whole group', async () => {
    const { store, group } = await renderGroup(twoCopies)
    const spy = vi.spyOn(store, 'editGroup')

    const field = screen.getByRole('textbox', { name: /title/i })
    field.innerText = 'Dune (Deluxe)'
    await fireEvent.input(field)
    await fireEvent.blur(field)

    expect(spy).toHaveBeenCalledWith(group, expect.objectContaining({ title: 'Dune (Deluxe)' }))
  })

  it('locks a diverged field until the row is expanded', async () => {
    const store = await booksStoreWith(twoCopies)
    await store.updateTags(store.value[0], ['sci-fi'])
    const [group] = groupByEdition(store.value)
    render(BooksTableRow, { books: group, booksStore: store })

    expect(screen.queryByRole('textbox', { name: /tags/i })).not.toBeInTheDocument()
    expect(screen.getByTitle(/varies across copies/i)).toBeInTheDocument()
  })

  it('shows an indeterminate read box for a partly-read group, and marks all read', async () => {
    const store = await booksStoreWith(twoCopies)
    await store.edit({ ...store.value[0], readAt: new Date() })
    const [group] = groupByEdition(store.value)
    const spy = vi.spyOn(store, 'editGroup')
    render(BooksTableRow, { books: group, booksStore: store })

    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: /read/i })
    expect(box.indeterminate).toBe(true)

    await fireEvent.click(box)
    expect(spy.mock.calls[0][1].readAt).toBeInstanceOf(Date)
  })

  it('deletes the whole group', async () => {
    const { store, group } = await renderGroup(twoCopies)
    const spy = vi.spyOn(store, 'removeGroup')

    await fireEvent.click(screen.getByRole('button', { name: /delete all 2 copies/i }))

    expect(spy).toHaveBeenCalledWith(group)
  })

  it('lists the individual copies when expanded', async () => {
    await renderGroup(twoCopies)

    await fireEvent.click(screen.getByRole('button', { name: /expand/i }))

    expect(screen.getByText(/Copies \(2\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete copy 2/i })).toBeInTheDocument()
  })
})

describe('BooksTableRow — single copy, expanded', () => {
  it('does not show a copies list', async () => {
    const store = await booksStoreWith([{ title: 'Dune', isbn13: '9780441172719' }])
    render(BooksTableRow, { books: store.value, booksStore: store })

    await fireEvent.click(screen.getByRole('button', { name: /expand/i }))

    expect(screen.queryByText(/Copies \(/)).not.toBeInTheDocument()
  })
})
