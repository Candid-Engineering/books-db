<script lang="ts">
  interface Props {
    /**
     * Value that can be edited in this table.
     */
    value: string | null

    /**
     * Function for handling value changes.
     */
    onChange: (newVal: string) => void
  }

  let { value, onChange }: Props = $props()

  // Writable $derived: tracks `value` when the prop changes (e.g. a row's
  // tags arriving from a second store update after the row already mounted,
  // since rows are reused by book id, not recreated), but the contenteditable
  // binding below can still overwrite it while the user types.
  let currVal = $derived(value)

  function handleBlur() {
    onChange(currVal || '')
  }

  function handleEnter(event: Event) {
    if (event instanceof KeyboardEvent && event.key === 'Enter') {
      event.preventDefault?.()
      ;(event.currentTarget as HTMLTableCellElement).blur?.()
    }
  }
</script>

<td contenteditable onblur={handleBlur} onkeydown={handleEnter} bind:innerText={currVal}></td>
