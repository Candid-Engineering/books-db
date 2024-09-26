<script lang="ts">
  import { books } from '../state/Books.svelte'
</script>

<table class="table is-fullwidth">
  <thead>
    <tr>
      <th>ISBN</th>
      <th>Title</th>
      <th>Author</th>
      <th>Tags</th>
      <th>Read?</th>
    </tr>
  </thead>
  <tbody>
    {#each books.value as book}
      <tr>
        <td>{book.isbn10 ?? book.isbn13}</td>
        <td>{book.title || ''} </td>
        <td>{book.authors?.join(', ') || ''}</td>
        <td>{book.tags?.join(', ') || ''}</td>
        <td>
          <input type="checkbox" checked={book.hasRead} />
        </td>
      </tr>
    {:else}
      <tr>
        <td colspan="5">
          <section class="section">
            <div class="content has-text-grey has-text-centered">
              <p><i class="far fa-3x fa-frown"></i></p>
              <p>No books</p>
            </div>
          </section>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
