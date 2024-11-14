<script lang="ts">
  import { createBooksStore } from '$lib/state/Books.svelte'
  import type { Book } from '$lib/types/book.js'
  import { fade } from 'svelte/transition'

  export let book: Book

  let booksStorePromise = createBooksStore()
  console.log(book)
  const handleEdit = async (book: Book, field: keyof Book, e: Event) => {
    const target = e.target as HTMLElement
    const value =
      field === 'authors' || 'tags'
        ? target.innerText.split(',').map((author) => author.trim())
        : target.innerText.trim()

    return booksStorePromise.then(async (booksStore) => {
      await booksStore.edit({ ...book, [field]: value })
    })
  }
  const removeBook = async (id: string): Promise<void> => {
    return booksStorePromise.then(async (booksStore) => {
      await booksStore.remove(id)
    })
  }

  const handleEnter = () => (event: Event) => {
    if (event instanceof KeyboardEvent && event.key === 'Enter') {
      event.preventDefault?.()
      ;(event.currentTarget as HTMLTableCellElement).blur?.()
    }
  }
</script>

<!-- note: `slide` transitions (which I prefer here) don't currently work on tables: https://github.com/sveltejs/svelte/issues/4948 -->
<tr transition:fade={{ duration: 300 }}>
  <td
    ><button aria-label="delete book" class="delete" on:click={() => removeBook(book.id)}
    ></button></td
  >
  <td
    contenteditable="true"
    on:blur={(e) => handleEdit(book, 'isbn10', e)}
    on:keydown={handleEnter()}>{book.isbn10 ?? book.isbn13}</td
  >
  <td contenteditable="true" on:blur={(e) => handleEdit(book, 'isbn10', e)}
    >{book.isbn10 ?? book.isbn13}</td
  >
  <td
    contenteditable="true"
    on:blur={(e) => handleEdit(book, 'title', e)}
    on:keydown={handleEnter()}
    >{book?.title || ''}
  </td>
  <td
    contenteditable="true"
    on:blur={(e) => handleEdit(book, 'authors', e)}
    on:keydown={handleEnter()}>{book.authors?.join(', ') || ''}</td
  >
  <td contenteditable="true" on:blur={(e) => handleEdit(book, 'tags', e)} on:keydown={handleEnter()}
    >{book.tags?.join(', ') || ''}</td
  >
  <td>
    <input type="checkbox" checked={book.hasRead} />
  </td>
  <td>
    {book.scanDate ? new Date(book.scanDate).toLocaleDateString() : ''}
  </td>
</tr>
