<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface Props extends HTMLButtonAttributes {
    /**
     * Is this the principal call to action on the page?
     */
    primary?: boolean
    /**
     * How large should the button be?
     */
    size?: 'small' | 'normal' | 'medium' | 'large'
    /**
     * Button contents. Omit for an icon-only button (pair it with `aria-label`).
     */
    children?: Snippet
  }

  let {
    primary = false,
    size = 'normal',
    children,
    class: classProp,
    ...restProps
  }: Props = $props()
</script>

<button
  type="button"
  class:is-primary={primary}
  class="button is-{size} {classProp}"
  {...restProps}
>
  {@render children?.()}
</button>
