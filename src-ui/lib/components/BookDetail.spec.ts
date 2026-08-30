import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import BookDetail from './BookDetail.svelte'
import { booksStoreWith } from '../../testing/component-helpers'

const richBook = {
  title: 'Dune',
  subtitle: 'Dune Chronicles, Book 1',
  isbn10: '0441172717',
  isbn13: '9780441172719',
  pageCount: 412,
  publicationDate: 'June 1965',
  copyrightDate: '1965',
  coverImages: { medium: 'https://covers.openlibrary.org/b/olid/OL1M-M.jpg' },
}

const withRichBook = async () => {
  const store = await booksStoreWith([richBook])
  const book = store.value[0]
  await store.updateAuthors(book, ['Frank Herbert'])
  await store.updateTags(book, ['classic', 'sci-fi'])
  await store.updateSeries(book, [{ name: 'Dune', label: '1', sortKey: 1 }])
  return { store, book: store.value[0] }
}

const fieldValue = (name: string) => screen.getByRole('textbox', { name }).innerText

describe('BookDetail', () => {
  it('renders every stored field', async () => {
    const { store, book } = await withRichBook()
    render(BookDetail, { book, booksStore: store })

    expect(fieldValue('Title')).toBe('Dune')
    expect(fieldValue('Subtitle')).toBe('Dune Chronicles, Book 1')
    expect(fieldValue('Authors')).toBe('Frank Herbert')
    expect(fieldValue('Series')).toBe('Dune #1')
    expect(fieldValue('Tags')).toBe('classic, sci-fi')
    expect(fieldValue('Published')).toBe('June 1965')
    expect(fieldValue('Copyright')).toBe('1965')
    expect(fieldValue('Pages')).toBe('412')
    expect(fieldValue('ISBN-10')).toBe('0441172717')
    expect(fieldValue('ISBN-13')).toBe('9780441172719')
    expect(screen.getByText(/Added/)).toBeInTheDocument()
  })

  it('shows the cover art at the medium size, skipping Open Library blanks', async () => {
    const { store, book } = await withRichBook()
    render(BookDetail, { book, booksStore: store })

    const img = screen.getByRole('img', { name: /cover of dune/i })
    expect(img).toHaveAttribute(
      'src',
      'https://covers.openlibrary.org/b/olid/OL1M-M.jpg?default=false'
    )
  })

  it('falls back to a placeholder when the cover fails to load', async () => {
    const { store, book } = await withRichBook()
    render(BookDetail, { book, booksStore: store })

    await fireEvent.error(screen.getByRole('img', { name: /cover of dune/i }))

    expect(screen.queryByRole('img', { name: /cover of dune/i })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /no cover/i })).toBeInTheDocument()
  })

  it('shows a placeholder when the book has no cover', async () => {
    const store = await booksStoreWith([{ title: 'Coverless' }])
    render(BookDetail, { book: store.value[0], booksStore: store })

    expect(screen.queryByRole('img', { name: /cover of/i })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /no cover/i })).toBeInTheDocument()
  })

  it('saves an edited text field through the store', async () => {
    const { store, book } = await withRichBook()
    const editSpy = vi.spyOn(store, 'edit')
    render(BookDetail, { book, booksStore: store })

    const field = screen.getByRole('textbox', { name: 'Published' })
    field.innerText = '1965-06-01'
    await fireEvent.input(field)
    await fireEvent.blur(field)

    expect(editSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: book.id, publicationDate: '1965-06-01' })
    )
  })

  it('coerces the page count to a number, and to null when cleared', async () => {
    const { store, book } = await withRichBook()
    const editSpy = vi.spyOn(store, 'edit')
    render(BookDetail, { book, booksStore: store })

    const field = screen.getByRole('textbox', { name: 'Pages' })
    field.innerText = '250'
    await fireEvent.input(field)
    await fireEvent.blur(field)
    expect(editSpy).toHaveBeenLastCalledWith(expect.objectContaining({ pageCount: 250 }))

    field.innerText = ''
    await fireEvent.input(field)
    await fireEvent.blur(field)
    expect(editSpy).toHaveBeenLastCalledWith(expect.objectContaining({ pageCount: null }))
  })

  it('routes author edits through updateAuthors', async () => {
    const { store, book } = await withRichBook()
    const spy = vi.spyOn(store, 'updateAuthors')
    render(BookDetail, { book, booksStore: store })

    const field = screen.getByRole('textbox', { name: 'Authors' })
    field.innerText = 'Frank Herbert, Brian Herbert'
    await fireEvent.input(field)
    await fireEvent.blur(field)

    expect(spy).toHaveBeenCalledWith(expect.anything(), ['Frank Herbert', 'Brian Herbert'])
  })

  it('toggles read state', async () => {
    const { store, book } = await withRichBook()
    const editSpy = vi.spyOn(store, 'edit')
    render(BookDetail, { book, booksStore: store })

    await fireEvent.click(screen.getByRole('checkbox', { name: /read/i }))
    expect(editSpy.mock.calls[0][0].readAt).toBeInstanceOf(Date)
  })

  it('shows the acquired date as static text, not a field', async () => {
    const { store, book } = await withRichBook()
    render(BookDetail, { book, booksStore: store })

    expect(screen.queryByRole('textbox', { name: /added/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Added/)).toBeInTheDocument()
  })
})
