import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/svelte'
import BooksTable from './BooksTable.svelte'
import { booksStoreWith } from '../../testing/component-helpers'

describe('BooksTable', () => {
  it('renders the empty state when there are no books', async () => {
    render(BooksTable, { booksStore: await booksStoreWith([]) })

    expect(screen.getByText('No books')).toBeInTheDocument()
  })

  it('renders a row per book once loaded', async () => {
    const store = await booksStoreWith([{ title: 'Dune' }, { title: 'Foundation' }])
    render(BooksTable, { booksStore: store })

    // header row + one per book
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('drops a row when its book is removed from the store', async () => {
    const store = await booksStoreWith([{ title: 'Keep' }, { title: 'Remove me' }])
    render(BooksTable, { booksStore: store })
    expect(screen.getAllByRole('row')).toHaveLength(3)

    const target = store.value.find((b) => b.title === 'Remove me')!
    await store.remove(target.id)

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2))
  })

  it('no longer has ISBN columns in the header', async () => {
    render(BooksTable, { booksStore: await booksStoreWith([{ title: 'Dune' }]) })

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())
    expect(headers).toEqual(['', '', 'Title', 'Author', 'Tags', 'Series', 'Read?', 'Scanned', ''])
  })
})
