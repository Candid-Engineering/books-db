import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
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

  it('no longer has ISBN columns in the header', async () => {
    render(BooksTable, { booksStore: await booksStoreWith([{ title: 'Dune' }]) })

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())
    expect(headers).toEqual(['', '', 'Title', 'Author', 'Tags', 'Series', 'Read?', 'Scanned', ''])
  })
})
