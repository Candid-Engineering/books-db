<script lang="ts">
  import type { Book } from '$lib/types/book.js'
  import { fade } from 'svelte/transition'

  export let book: Book
  export let handleEdit: (book: Book, field: keyof Book, event: Event) => void

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
    contenteditable="true"
    on:blur={(e) => handleEdit(book, 'isbn10', e)}
    on:keydown={handleEnter()}>{book.isbn10 ?? book.isbn13}</td
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
</tr>
