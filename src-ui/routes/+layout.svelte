<script lang="ts">
  import NavBar from '$lib/components/core/NavBar.svelte'
  import 'bulma/css/bulma.css'
  import { Modals, modals, type ModalStack } from 'svelte-modals'
  import 'bulma-checkbox/css/main.css'
  import { authStore } from '$lib/auth/auth-store.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'

  async function handleLoginClick() {
    await modals.open(LoginModal, {})
  }
</script>

<Modals>
  <!-- shown when any modal is opened -->
  {#snippet backdrop(modals: ModalStack)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => modals.close()}></div>
  {/snippet}
</Modals>
<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<header>
  <NavBar>
    <a class="navbar-item" href="/">Home</a>
    <a class="navbar-item" href="/about">About</a>
    {#snippet end()}
      {#if authStore.state.isAuthenticated}
        <span class="navbar-item">Signed in as {authStore.state.user?.name}</span>
        <a class="navbar-item" href="#placeholder" role="button" onclick={() => authStore.logout()}>
          Logout
        </a>
      {:else}
        <a class="navbar-item" href="#placeholder" role="button" onclick={handleLoginClick}>Login</a>
      {/if}
    {/snippet}
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
