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

  // $state only captures the prop's *initial* value - it won't pick up a
  // later change to `value` (e.g. a row's tags arriving from a second store
  // update after the row already mounted, such as after add() then
  // updateTags()) without this effect, since the row is reused (keyed by
  // book id), not recreated.
  let currVal = $state(value)
  $effect(() => {
    currVal = value
  })

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
