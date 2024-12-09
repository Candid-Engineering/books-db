<script lang="ts">
  import { getBooksStore } from '$lib/state/Books.svelte'
  import type { Book, BookTag } from '$lib/types/book.js'
  import { fade } from 'svelte/transition'
  import Button from './core/Button.svelte'
  import { trim } from 'lodash'

  export let book: Book

  let booksStore = getBooksStore()
  const handleEdit = async (book: Book, field: keyof Book, e: Event) => {
    const target = e.target as HTMLElement
    let value: string | string[] | BookTag[] = target.innerText.trim()
    if (field === 'authors' || field == 'tags') {
      value = target.innerText.split(',').map(trim)
      if (field == 'tags') {
        value = (value as string[]).map((name) => ({bookId: book.id, name }) )
      }
    }

    await booksStore.edit({ ...book, [field]: value })
  }

  async function updateTags(book: Book, commaSeparatedTags: string): Promise<void> {
      const tags = commaSeparatedTags.split(',').map(trim)
      await booksStore.updateTags(book, tags)
  }

  const removeBook = async (id: string): Promise<void> => {
    await booksStore.remove(id)
  }

  function handleEnter(event: Event) {
    if (event instanceof KeyboardEvent && event.key === 'Enter') {
      event.preventDefault?.()
      ;(event.currentTarget as HTMLTableCellElement).blur?.()
    }
  }

  async function toggleRead(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
    book: Book
  ) {
    // TODO(rkofman): instead of updating the whole book element, there should be a method on the store
    // to set the single field to a new value; filtered by ID.
    const readAt = book.readAt ? null : new Date()
    await booksStore.edit({ ...book, readAt })
  }
</script>

<!-- note: `slide` transitions (which I prefer here) don't currently work on tables: https://github.com/sveltejs/svelte/issues/4948 -->
<tr transition:fade={{ duration: 300 }}>
  <td
    ><Button aria-label="delete book" class="delete" onclick={() => removeBook(book.id)}
    ></Button></td
  >
  <td contenteditable="true" onblur={(e) => handleEdit(book, 'isbn10', e)} onkeydown={handleEnter}
    >{book.isbn10}</td
  >
  <td contenteditable="true" onblur={(e) => handleEdit(book, 'isbn13', e)}>{book.isbn13}</td>
  <td contenteditable="true" onblur={(e) => handleEdit(book, 'title', e)} onkeydown={handleEnter}
    >{book?.title || ''}
  </td>
  <td contenteditable="true" onblur={(e) => handleEdit(book, 'authors', e)} onkeydown={handleEnter}
    >{book.authors?.join(', ') || ''}</td
  >
  <td contenteditable="true" onblur={(e) => updateTags(book, e.currentTarget.innerHTML)} onkeydown={handleEnter}
    >{book.tags?.map((bookTag) => bookTag.name).join(', ') || ''}</td
  >
  <td>
    <label class="b-checkbox checkbox is-regular m-1">
      <input
        type="checkbox"
        value="false"
        checked={!!book.readAt}
        onchange={(e) => toggleRead(e, book)}
      />
      <span class="check"></span>
    </label>
  </td>
  <td>
    {book.createdAt?.toLocaleDateString()}
  </td>
</tr>
