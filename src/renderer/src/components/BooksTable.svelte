<script context="module" lang="ts">
  export type Book = {
    isbn: number
    title?: string
    author?: string
    genre?: string
    is_read?: boolean
  }
</script>

<script lang="ts">
  export let books: Book[] = []
</script>

<table class="table is-fullwidth">
  <thead>
    <tr>
      <th>ISBN</th>
      <th>Title</th>
      <th>Author</th>
      <th>Genre</th>
      <th>Read?</th>
    </tr>
  </thead>
  <tbody>
    {#each books as book}
      <tr>
        <td>{book.isbn}</td>
        <td>{book.title}</td>
        <td>{book.author}</td>
        <td>{book.genre}</td>
        <td>{book.is_read}</td>
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
