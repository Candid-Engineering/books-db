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

  let currVal = $state(value)

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
