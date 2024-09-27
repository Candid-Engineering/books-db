<script lang="ts">
  import type { Book } from '../types/book.js'
  export let book: Book
</script>

<tr>
  <td>{book.isbn10 ?? book.isbn13}</td>
  <td>{book.title || ''} </td>
  <td>{book.authors || ''}</td>
  <td>{book.tags || ''}</td>
  <td>
    <input type="checkbox" checked={book.hasRead} />
  </td>
</tr>
