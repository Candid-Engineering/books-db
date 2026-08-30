<script lang="ts">
  import { getBooksStore, type BooksStore } from '$lib/state/Books.svelte'
  import type { Book } from '$lib/types/book.js'
  import { fade } from 'svelte/transition'
  import Button from './core/Button.svelte'
  import { trim } from 'lodash'
  import Editable from './core/Editable.svelte'
  import BookDetail from './BookDetail.svelte'
  import BookCopiesList from './BookCopiesList.svelte'
  import { formatSeries, parseSeries, type ParsedSeries } from '$lib/series'
  import { converges, namesOf, readState } from '$lib/duplicates'

  // A group of copies of one edition (length >= 1). `books[0]` is the primary
  // (oldest-acquired) copy and stands in for the group in the collapsed row.
  export let books: Book[]
  export let booksStore: BooksStore = getBooksStore()

  let expanded = false

  $: primary = books[0]
  $: grouped = books.length > 1

  // A field is inline-editable only when every copy already agrees on it;
  // otherwise it shows the primary's value, greyed, and edits happen per-copy
  // in the expanded panel.
  $: titleEditable = !grouped || converges(books, (b) => b.title)
  $: authorsEditable = !grouped || converges(books, (b) => namesOf(b.authors))
  $: tagsEditable = !grouped || converges(books, (b) => namesOf(b.tags))
  $: seriesEditable = !grouped || converges(books, (b) => b.series.map(formatSeries).sort())

  $: authorsText = primary.authors.map((a) => a.name).join(', ')
  $: tagsText = primary.tags.map((t) => t.name).join(', ')
  $: seriesText = primary.series.map(formatSeries).join(', ')

  $: reads = readState(books)

  const VARIES = 'Varies across copies — expand to edit'

  const editTitle = (value: string): Promise<void> =>
    booksStore.editGroup(books, { title: value.trim() })

  const editAuthors = (csv: string): Promise<void> =>
    booksStore.updateGroupAuthors(books, csv.split(',').map(trim))

  const editTags = (csv: string): Promise<void> =>
    booksStore.updateGroupTags(books, csv.split(',').map(trim))

  const editSeries = (csv: string): Promise<void> =>
    booksStore.updateGroupSeries(
      books,
      csv
        .split(',')
        .map((entry) => parseSeries(entry))
        .filter((entry): entry is ParsedSeries => entry !== null)
    )

  const toggleRead = (): Promise<void> =>
    booksStore.editGroup(books, { readAt: reads === 'all' ? null : new Date() })

  const removeGroup = (): Promise<void> => booksStore.removeGroup(books)

  let coverFailed = false
  // Medium, not small: the thumbnail renders larger than the small cover's
  // native size. `?default=false` 404s a missing cover so `onerror` fires.
  $: coverSrc =
    primary.coverImages?.medium && !coverFailed
      ? `${primary.coverImages.medium}?default=false`
      : null
</script>

<!-- note: `slide` transitions (which I prefer here) don't currently work on tables: https://github.com/sveltejs/svelte/issues/4948 -->
<tr transition:fade={{ duration: 300 }}>
  <td class="disclosure-cell">
    <button
      type="button"
      class="disclosure"
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse details' : 'Expand details'}
      onclick={() => (expanded = !expanded)}
    >
      {expanded ? '▾' : '▸'}
    </button>
  </td>
  <td class="cover-cell">
    {#if coverSrc}
      <img class="cover-thumb" src={coverSrc} alt="" onerror={() => (coverFailed = true)} />
    {:else}
      <span class="cover-thumb cover-thumb--empty" aria-hidden="true"></span>
    {/if}
  </td>
  <td>
    {#if titleEditable}
      <Editable ariaLabel="Title" value={primary.title} onChange={(v: string) => editTitle(v)} />
    {:else}
      <span class="has-text-grey" title={VARIES}>{primary.title}</span>
    {/if}
    {#if grouped}<span class="tag is-light ml-2">×{books.length}</span>{/if}
  </td>
  <td class="clip-cell">
    {#if authorsEditable}
      <Editable ariaLabel="Authors" value={authorsText} onChange={(v: string) => editAuthors(v)} />
    {:else}
      <span class="varies has-text-grey" title={VARIES}>{authorsText}</span>
    {/if}
  </td>
  <td class="clip-cell">
    {#if tagsEditable}
      <Editable ariaLabel="Tags" value={tagsText} onChange={(v: string) => editTags(v)} />
    {:else}
      <span class="varies has-text-grey" title={VARIES}>{tagsText}</span>
    {/if}
  </td>
  <td class="clip-cell">
    {#if seriesEditable}
      <Editable ariaLabel="Series" value={seriesText} onChange={(v: string) => editSeries(v)} />
    {:else}
      <span class="varies has-text-grey" title={VARIES}>{seriesText}</span>
    {/if}
  </td>
  <td>
    <label class="b-checkbox checkbox is-regular m-1">
      <input
        type="checkbox"
        aria-label="Read"
        checked={reads === 'all'}
        indeterminate={reads === 'some'}
        onchange={toggleRead}
      />
      <span class="check"></span>
    </label>
  </td>
  <td>
    {primary.createdAt?.toLocaleDateString()}
  </td>
  <td>
    <Button
      aria-label={grouped ? `delete all ${books.length} copies` : 'delete book'}
      class="delete"
      onclick={removeGroup}
    ></Button>
  </td>
</tr>
{#if expanded}
  <tr class="detail-row">
    <td colspan="9">
      <BookDetail {books} {booksStore} />
      {#if grouped}
        <BookCopiesList {books} {booksStore} />
      {/if}
    </td>
  </tr>
{/if}

<style>
  .disclosure {
    border: none;
    background: none;
    cursor: pointer;
    padding: 0 0.25rem;
    font-size: 0.85rem;
    color: var(--bulma-text-weak, #7a7a7a);
  }

  .cover-cell {
    width: 3.75rem;
    min-width: 3.75rem;
  }

  .cover-thumb {
    display: block;
    width: 3.25rem;
    height: 4.75rem;
    object-fit: cover;
    border-radius: 3px;
  }

  .cover-thumb--empty {
    background: var(--bulma-border, #dbdbdb);
  }

  /* Long author / tag / series lists clip to three lines (about what a row is
     tall now); editing or hovering shows the whole thing. The width lives on
     the inner element because a <td> max-width isn't honoured under Bulma's
     `table-layout: auto`. */
  .clip-cell :global([contenteditable]),
  .clip-cell .varies {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    max-width: 16rem;
    overflow: hidden;
  }

  .clip-cell:hover :global([contenteditable]),
  .clip-cell :global([contenteditable]:focus),
  .clip-cell:hover .varies {
    display: block;
    -webkit-line-clamp: none;
    line-clamp: none;
    max-width: none;
    overflow: visible;
  }
</style>
