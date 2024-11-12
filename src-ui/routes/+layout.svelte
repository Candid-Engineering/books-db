<script lang="ts">
  import NavBar from '$lib/components/core/NavBar.svelte'
  import 'bulma/css/bulma.css'
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<header>
  <NavBar>
    <a class="navbar-item" href="/">Home</a>
    <a class="navbar-item" href="/about">About</a>
  </NavBar>
</header>
<main>
  <section class="section">
    <slot></slot>
  </section>
</main>
