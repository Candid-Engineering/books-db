import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import BooksTableRow from './BooksTableRow.svelte'
import { booksStoreWith } from '../../testing/component-helpers'

const renderRow = async () => {
  const store = await booksStoreWith([
    { title: 'Dune', isbn10: '0441172717', isbn13: '9780441172719' },
  ])
  return { store, ...render(BooksTableRow, { book: store.value[0], booksStore: store }) }
}

describe('BooksTableRow', () => {
  it('keeps ISBNs out of the collapsed row', async () => {
    await renderRow()

    expect(screen.queryByRole('textbox', { name: /isbn/i })).not.toBeInTheDocument()
  })

  it('reveals the detail panel with the ISBNs when expanded', async () => {
    await renderRow()
    expect(screen.queryByRole('textbox', { name: 'ISBN-13' })).not.toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: /expand/i }))

    expect(screen.getByRole('textbox', { name: 'ISBN-13' }).innerText).toBe('9780441172719')
  })

  it('collapses the panel again', async () => {
    await renderRow()
    await fireEvent.click(screen.getByRole('button', { name: /expand/i }))
    await fireEvent.click(screen.getByRole('button', { name: /collapse/i }))

    expect(screen.queryByRole('textbox', { name: 'ISBN-13' })).not.toBeInTheDocument()
  })

  it('has a delete control', async () => {
    await renderRow()

    expect(screen.getByRole('button', { name: 'delete book' })).toBeInTheDocument()
  })
})
