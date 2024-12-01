<script lang="ts">
  import NavBar from '$lib/components/core/NavBar.svelte'
  import 'bulma/css/bulma.css'
  import { Modals } from 'svelte-modals'
  import 'bulma-checkbox/css/main.css'
</script>

<Modals>
  <!-- shown when any modal is opened -->
  {#snippet backdrop({ close })}
    <div class="backdrop" onclick={() => close()}></div>
  {/snippet}
</Modals>
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

<style>
  .backdrop {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
  }
</style>
