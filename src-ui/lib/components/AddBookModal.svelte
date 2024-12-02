<script lang="ts">
  import 'bulma/css/bulma.css'
  import { getBooksStore } from '$lib/state/Books.svelte'

  import type { NewBook } from '$lib/types/book.js'


  interface Props {
    /**
     * Is the modal currently open?
     */
    isOpen?: boolean

    /**
     * Function that closes this modal
     */
    close: () => void
  }

  let {isOpen = false, close}: Props = $props()

  let book = $state<Partial<NewBook>>({})

  let authors = $state('')
  let tags = $state('')

  let hasRead = {
    get bool() {
      return !!book.readAt
    },
    set bool(v) {
      if (v) {
        book.readAt = new Date()
      } else {
        delete book.readAt
      }
    }
  }

  let booksStore = getBooksStore()

  const saveBook = async () => {
    // For now, only validate that the title and author fields aren't empty
    if (!book?.title?.trim()) {
      console.error('Title is required.')
      return
    }
    if (!authors.trim()) {
      console.error('Author is required.')
      return
    }
    const authorsStr = authors.split(',').map((v) => v.trim())
    const tagsStr = tags.split(',').map((v) => v.trim())
    const newBook = {...book, title: book.title, authors: authorsStr, tags: tagsStr}
    try {
      await booksStore.add(newBook)
      close()
    } catch (error) {
      console.error('Error saving book:', error)
    }
  }
</script>

{#if isOpen}
  <div class="modal is-active">
    <div aria-hidden="true" role="presentation" class="modal-background" onclick={close}></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Add a New Book</p>
        <button class="delete" aria-label="close" onclick={close}></button>
      </header>
      <section class="modal-card-body">
        <!-- Form Fields -->
        <div class="field">
          <label class="label" for="isbn-10">ISBN-10</label>
          <div class="control">
            <input class="input" type="text" bind:value={book.isbn10} placeholder="Enter ISBN-10" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="isbn-13">ISBN-13</label>
          <div class="control">
            <input class="input" type="text" bind:value={book.isbn13} placeholder="Enter ISBN-13" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="title">Title</label>
          <div class="control">
            <input class="input" type="text" bind:value={book.title} placeholder="Enter Title" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="author">Author(s)</label>
          <div class="control">
            <input
              class="input"
              type="text"
              bind:value={authors}
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
            <input type="checkbox" bind:checked={hasRead.bool} />
            Read?
          </label>
        </div>
      </section>
      <footer class="modal-card-foot">
        <div class="buttons">
          <button class="button is-success" onclick={saveBook}>Save Book</button>
          <button class="button" onclick={close}>Cancel</button>
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
