<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet | undefined
  }
  // TODO(rkofman): this _shouldn't_ be necessary if we have the right eslint/svelte rules setup; but alas.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  let { children }: Props = $props()
  let isOpen = $state(false)
  function handleHamburgerClick() {
    isOpen = !isOpen
  }
</script>

<nav class="navbar section pt-4" aria-label="main navigation">
  <!-- See: https://bulma.io/documentation/components/navbar/ -->
  <div class="navbar-brand">
    <a class="navbar-item" href="/">📚 BooksDB </a>
    <a
      onclick={handleHamburgerClick}
      href="#placeholder"
      role="button"
      class="navbar-burger"
      class:is-active={isOpen}
      aria-label="menu"
      aria-expanded="false"
      data-target="navbarBasicExample"
    >
      <!-- "hamburger menu" icon: -->
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <!-- end "hamburger menu" icon: -->
    </a>
  </div>
  <div class="navbar-menu" class:is-active={isOpen}>
    <div class="navbar-start">
      {@render children?.()}
    </div>
  </div>
</nav>
