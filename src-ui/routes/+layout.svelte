<script lang="ts">
  import Nav from '$lib/components/core/Nav.svelte'
  import 'bulma/css/bulma.css'
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<header>
  <Nav>
    <a class="navbar-item" href="/">Home</a>
    <a class="navbar-item" href="/about">About</a>
  </Nav>
</header>
<main>
  <section class="section">
    <slot></slot>
  </section>
</main>
