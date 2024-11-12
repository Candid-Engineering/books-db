<script lang="ts">
  import 'bulma/css/bulma.css'
  import { createBooksStore } from '$lib/state/Books.svelte'

  import type { NewBook } from '$lib/types/book.js'

  export let isOpen = false
  export let close

  let isbn10 = ''
  let isbn13 = ''
  let bookTitle = ''
  let subtitle = ''
  let author = ''
  let tags = ''
  let series = ''
  let pageCount = 0
  let publicationDate = ''
  let copyrightDate = ''
  let hasRead = false

  function createNewBook(): NewBook {
    return {
      isbn10: isbn10 || undefined,
      isbn13: isbn13 || undefined,
      title: bookTitle,
      subtitle: subtitle || undefined,
      authors: author.split(',').map((a) => a.trim()),
      tags: tags.split(',').map((t) => t.trim()),
      series: series || undefined,
      pageCount: pageCount > 0 ? pageCount : undefined,
      publicationDate: publicationDate || undefined,
      copyrightDate: copyrightDate || undefined,
      coverImages: {
        small: '',
        medium: '',
        large: '',
      },
    }
  }
  let booksStorePromise = createBooksStore()

  const saveBook = async () => {
    // For now, only validate that the title and author fields aren't empty
    if (!bookTitle.trim()) {
      alert('Title is required.')
      return
    }
    if (!author.trim()) {
      alert('Author is required.')
      return
    }
    try {
      const newBook = createNewBook()
      const booksStore = await booksStorePromise
      await booksStore.add(newBook)
      close()
    } catch (error) {
      console.error('Error saving book:', error)
    }
  }
</script>

{#if isOpen}
  <div class="modal is-active">
    <div aria-hidden="true" role="presentation" class="modal-background" on:click={close}></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Add a New Book</p>
        <button class="delete" aria-label="close" on:click={close}></button>
      </header>
      <section class="modal-card-body">
        <!-- Form Fields -->
        <div class="field">
          <label class="label" for="isbn-10">ISBN-10</label>
          <div class="control">
            <input class="input" type="text" bind:value={isbn10} placeholder="Enter ISBN-10" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="isbn-13">ISBN-13</label>
          <div class="control">
            <input class="input" type="text" bind:value={isbn13} placeholder="Enter ISBN-13" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="title">Title</label>
          <div class="control">
            <input class="input" type="text" bind:value={bookTitle} placeholder="Enter Title" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="author">Author(s)</label>
          <div class="control">
            <input
              class="input"
              type="text"
              bind:value={author}
              placeholder="Enter Author(s), separated by commas"
            />
          </div>
        </div>
        <div class="field">
          <label class="label" for="tags">Tags</label>
          <div class="control">
            <input
              class="input"
              type="text"
              bind:value={tags}
              placeholder="Enter Tags, separated by commas"
            />
          </div>
        </div>
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" bind:checked={hasRead} />
            Read?
          </label>
        </div>
      </section>
      <footer class="modal-card-foot">
        <div class="buttons">
          <button class="button is-success" on:click={saveBook}>Save Book</button>
          <button class="button" on:click={close}>Cancel</button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
  }
  .modal.is-active {
    pointer-events: auto;
  }
</style>
