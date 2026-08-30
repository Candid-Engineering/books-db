<script lang="ts">
  interface Props {
    /**
     * Value that can be edited.
     */
    value: string | null

    /**
     * Function for handling value changes.
     */
    onChange: (newVal: string) => void

    /**
     * Accessible name, when the field isn't already labelled by a column
     * header or nearby text.
     */
    ariaLabel?: string
  }

  let { value, onChange, ariaLabel }: Props = $props()

  // Writable $derived: tracks `value` when the prop changes (e.g. a row's
  // fields arriving from a later store update, since rows are reused by book
  // id, not recreated), but the contenteditable binding below can still
  // overwrite it while the user types.
  let currVal = $derived(value)

  function handleBlur() {
    onChange(currVal || '')
  }

  function handleEnter(event: Event) {
    if (event instanceof KeyboardEvent && event.key === 'Enter') {
      event.preventDefault?.()
      ;(event.currentTarget as HTMLElement).blur?.()
    }
  }
</script>

<span
  role="textbox"
  tabindex="0"
  contenteditable
  aria-label={ariaLabel}
  onblur={handleBlur}
  onkeydown={handleEnter}
  bind:innerText={currVal}
></span>

<style>
  span {
    display: block;
    min-height: 1.2em;
    padding: 0.15em 0.35em;
    margin: -0.15em -0.35em;
    border-radius: 3px;
    outline: none;
  }

  span:hover {
    background: var(--bulma-background, #f5f5f5);
  }

  span:focus {
    background: var(--bulma-scheme-main, #fff);
    box-shadow: 0 0 0 2px var(--bulma-link, #485fc7);
  }
</style>
