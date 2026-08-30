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
})
