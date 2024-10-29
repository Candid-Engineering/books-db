<script lang="ts">
  import type { Book } from '$lib/types/book.js'

  export let book: Book
  export let handleEdit: (book: Book, field: keyof Book, event: Event) => void
</script>

<tr>
  <td contenteditable="true" on:blur={(e) => handleEdit(book, 'isbn10', e)}
    >{book.isbn10 ?? book.isbn13}</td
  >
  <td contenteditable="true" on:blur={(e) => handleEdit(book, 'title', e)}>{book.title || ''} </td>
  <td contenteditable="true" on:blur={(e) => handleEdit(book, 'authors', e)}
    >{book.authors?.join(', ') || ''}</td
  >
  <td contenteditable="true" on:blur={(e) => handleEdit(book, 'tags', e)}
    >{book.tags?.join(', ') || ''}</td
  >
  <td>
    <input type="checkbox" checked={book.hasRead} />
  </td>
</tr>
