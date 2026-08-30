<script lang="ts">
  import type { Book } from '$lib/types/book.js'
  import { getBooksStore, type BooksStore } from '$lib/state/Books.svelte'
  import EditableField from './core/EditableField.svelte'

  export let book: Book
  export let booksStore: BooksStore = getBooksStore()

  const editField = (field: keyof Book, value: string): Promise<void> =>
    booksStore.edit({ ...book, [field]: value.trim() })
</script>

<div class="book-detail">
  <EditableField
    label="ISBN-10"
    value={book.isbn10}
    onChange={(v: string) => editField('isbn10', v)}
  />
  <EditableField
    label="ISBN-13"
    value={book.isbn13}
    onChange={(v: string) => editField('isbn13', v)}
  />
  <p class="acquired">Added {book.createdAt?.toLocaleDateString()}</p>
</div>
