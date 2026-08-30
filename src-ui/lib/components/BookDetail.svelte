<script lang="ts">
  import type { Book } from '$lib/types/book.js'
  import { getBooksStore, type BooksStore } from '$lib/state/Books.svelte'
  import { now } from '$lib/clock.js'
  import { trim } from 'lodash'
  import { formatSeries, parseSeries, type ParsedSeries } from '$lib/series'
  import EditableField from './core/EditableField.svelte'

  export let book: Book
  export let booksStore: BooksStore = getBooksStore()

  let coverFailed = false
  // `?default=false` makes Open Library 404 a missing cover rather than serve
  // a blank 1x1, so `onerror` can swap in the placeholder.
  $: coverSrc =
    book.coverImages?.medium && !coverFailed ? `${book.coverImages.medium}?default=false` : null

  const editText = (field: keyof Book, value: string): Promise<void> =>
    booksStore.edit({ ...book, [field]: value.trim() })

  const editPageCount = (value: string): Promise<void> =>
    booksStore.edit({ ...book, pageCount: Number(value) || null })

  const updateAuthors = (csv: string): Promise<void> =>
    booksStore.updateAuthors(book, csv.split(',').map(trim))

  const updateTags = (csv: string): Promise<void> =>
    booksStore.updateTags(book, csv.split(',').map(trim))

  const updateSeries = (csv: string): Promise<void> =>
    booksStore.updateSeries(
      book,
      csv
        .split(',')
        .map((entry) => parseSeries(entry))
        .filter((entry): entry is ParsedSeries => entry !== null)
    )

  const toggleRead = (): Promise<void> =>
    booksStore.edit({ ...book, readAt: book.readAt ? null : now() })
</script>

<article class="media box m-3">
  <figure class="media-left">
    {#if coverSrc}
      <img
        class="cover"
        src={coverSrc}
        alt="Cover of {book.title}"
        onerror={() => (coverFailed = true)}
      />
    {:else}
      <div class="cover cover--empty" role="img" aria-label="No cover for {book.title}">
        <span aria-hidden="true">📖</span>
      </div>
    {/if}
  </figure>

  <div class="media-content">
    <EditableField
      label="Title"
      value={book.title}
      onChange={(v: string) => editText('title', v)}
    />
    <EditableField
      label="Subtitle"
      value={book.subtitle}
      onChange={(v: string) => editText('subtitle', v)}
    />
    <EditableField
      label="Authors"
      value={book.authors.map((a) => a.name).join(', ')}
      onChange={(v: string) => updateAuthors(v)}
    />
    <EditableField
      label="Series"
      value={book.series.map(formatSeries).join(', ')}
      onChange={(v: string) => updateSeries(v)}
    />
    <EditableField
      label="Tags"
      value={book.tags.map((t) => t.name).join(', ')}
      onChange={(v: string) => updateTags(v)}
    />
    <EditableField
      label="Published"
      value={book.publicationDate}
      onChange={(v: string) => editText('publicationDate', v)}
    />
    <EditableField
      label="Copyright"
      value={book.copyrightDate}
      onChange={(v: string) => editText('copyrightDate', v)}
    />
    <EditableField
      label="Pages"
      value={book.pageCount != null ? String(book.pageCount) : null}
      onChange={(v: string) => editPageCount(v)}
    />
    <EditableField
      label="ISBN-10"
      value={book.isbn10}
      onChange={(v: string) => editText('isbn10', v)}
    />
    <EditableField
      label="ISBN-13"
      value={book.isbn13}
      onChange={(v: string) => editText('isbn13', v)}
    />

    <div class="field is-horizontal">
      <div class="field-label is-normal"><span class="label">Read</span></div>
      <div class="field-body">
        <label class="checkbox">
          <input type="checkbox" aria-label="Read" checked={!!book.readAt} onchange={toggleRead} />
          {#if book.readAt}
            <span class="ml-2 has-text-grey">on {book.readAt.toLocaleDateString()}</span>
          {/if}
        </label>
      </div>
    </div>

    <p class="is-size-7 has-text-grey mt-3">Added {book.createdAt?.toLocaleDateString()}</p>
  </div>
</article>

<style>
  .cover {
    display: block;
    width: 96px;
    height: 144px;
    object-fit: cover;
    border-radius: 3px;
    background: var(--bulma-border, #dbdbdb);
  }

  .cover--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
  }
</style>
