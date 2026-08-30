<script lang="ts">
  import type { Book } from '$lib/types/book.js'
  import { getBooksStore, type BooksStore } from '$lib/state/Books.svelte'
  import Button from './core/Button.svelte'

  export let books: Book[]
  export let booksStore: BooksStore = getBooksStore()

  const toggleRead = (copy: Book): Promise<void> =>
    booksStore.edit({ ...copy, readAt: copy.readAt ? null : new Date() })

  const removeCopy = (copy: Book): Promise<void> => booksStore.remove(copy.id)
</script>

<div class="copies mt-4">
  <p class="label">Copies ({books.length})</p>
  <ul>
    {#each books as copy, i (copy.id)}
      <li class="is-flex is-align-items-center py-1">
        <span class="has-text-grey mr-3">acquired {copy.createdAt?.toLocaleDateString()}</span>
        <label class="checkbox mr-3">
          <input
            type="checkbox"
            aria-label="Copy {i + 1} read"
            checked={!!copy.readAt}
            onchange={() => toggleRead(copy)}
          />
          read
        </label>
        <Button aria-label="delete copy {i + 1}" class="delete" onclick={() => removeCopy(copy)}
        ></Button>
      </li>
    {/each}
  </ul>
</div>
