<script lang="ts">
  import { getBooksStore } from '$lib/state/Books.svelte'
  import type { Book } from '$lib/types/book.js'
  import { fade } from 'svelte/transition'
  import Button from './core/Button.svelte'
  import { trim } from 'lodash'
  import Editable from './core/Editable.svelte'
  import { formatSeries, parseSeries, type ParsedSeries } from '$lib/series'

  export let book: Book

  let booksStore = getBooksStore()
  const handleEdit = async (book: Book, field: keyof Book, valueStr: string) => {
    const value = valueStr.trim()
    await booksStore.edit({ ...book, [field]: value })
  }

  async function updateTags(book: Book, commaSeparatedTags: string): Promise<void> {
    const tags = commaSeparatedTags.split(',').map(trim)
    await booksStore.updateTags(book, tags)
  }

  async function updateAuthors(book: Book, commaSeparatedAuthors: string): Promise<void> {
    const authors = commaSeparatedAuthors.split(',').map(trim)
    await booksStore.updateAuthors(book, authors)
  }

  // Freeform "Series Name #1, Other Series" - each comma-separated entry is
  // parsed for a trailing position (see series.ts).
  async function updateSeries(book: Book, commaSeparatedSeries: string): Promise<void> {
    const entries = commaSeparatedSeries
      .split(',')
      .map((entry) => parseSeries(entry))
      .filter((entry): entry is ParsedSeries => entry !== null)
    await booksStore.updateSeries(book, entries)
  }

  const removeBook = async (id: string): Promise<void> => {
    await booksStore.remove(id)
  }

  async function toggleRead(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
    book: Book
  ) {
    // TODO(rkofman): instead of updating the whole book element, there should be a method on the store
    // to set the single field to a new value; filtered by ID.
    const readAt = book.readAt ? null : new Date()
    await booksStore.edit({ ...book, readAt })
  }
</script>

<!-- note: `slide` transitions (which I prefer here) don't currently work on tables: https://github.com/sveltejs/svelte/issues/4948 -->
<tr transition:fade={{ duration: 300 }}>
  <td
    ><Button aria-label="delete book" class="delete" onclick={() => removeBook(book.id)}
    ></Button></td
  >
  <td>
    <Editable
      value={book.isbn10}
      onChange={(newValue: string) => handleEdit(book, 'isbn10', newValue)}
    />
  </td>
  <td>
    <Editable
      value={book.isbn13}
      onChange={(newValue: string) => handleEdit(book, 'isbn13', newValue)}
    />
  </td>
  <td>
    <Editable
      value={book.title}
      onChange={(newValue: string) => handleEdit(book, 'title', newValue)}
    />
  </td>
  <td>
    <Editable
      value={book.authors.map((bookAuthor) => bookAuthor.name).join(', ')}
      onChange={(newValue: string) => updateAuthors(book, newValue)}
    />
  </td>
  <td>
    <Editable
      value={book.tags.map((bookTag) => bookTag.name).join(', ')}
      onChange={(newValue: string) => updateTags(book, newValue)}
    />
  </td>
  <td>
    <Editable
      value={book.series.map(formatSeries).join(', ')}
      onChange={(newValue: string) => updateSeries(book, newValue)}
    />
  </td>
  <td>
    <label class="b-checkbox checkbox is-regular m-1">
      <input
        type="checkbox"
        value="false"
        checked={!!book.readAt}
        onchange={(e) => toggleRead(e, book)}
      />
      <span class="check"></span>
    </label>
  </td>
  <td>
    {book.createdAt?.toLocaleDateString()}
  </td>
</tr>
