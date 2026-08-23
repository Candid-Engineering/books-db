<script lang="ts">
  import 'bulma/css/bulma.css'
  import { authStore } from '$lib/auth/auth-store.svelte'
  import { LoginForm } from '$lib/auth/login-form.svelte'
  import Button from './core/Button.svelte'

  interface Props {
    /**
     * Is the modal currently open?
     */
    isOpen?: boolean

    /**
     * Function that closes this modal
     */
    close: () => void
  }

  let { isOpen = false, close }: Props = $props()

  const form = new LoginForm(authStore)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()

    if (form.step === 'email') {
      await form.submitEmail()
    } else if (form.step === 'register') {
      await form.submitRegistration()
    } else {
      await form.submitToken()
      if (authStore.state.isAuthenticated) {
        close()
      }
    }
  }
</script>

{#if isOpen}
  <div class="modal is-active">
    <div aria-hidden="true" role="presentation" class="modal-background" onclick={close}></div>
    <form class="modal-card" onsubmit={handleSubmit}>
      <header class="modal-card-head">
        <p class="modal-card-title">
          {#if form.step === 'email'}
            Sign in
          {:else if form.step === 'register'}
            Create your account
          {:else}
            Enter your login code
          {/if}
        </p>
        <button class="delete" aria-label="close" onclick={close}></button>
      </header>
      <section class="modal-card-body">
        {#if form.error}
          <div class="notification is-danger">{form.error}</div>
        {/if}

        {#if form.step === 'email'}
          <div class="field">
            <label class="label" for="login-email">Email</label>
            <div class="control">
              <input
                id="login-email"
                class="input"
                type="email"
                bind:value={form.email}
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
        {:else if form.step === 'register'}
          <p class="mb-4">We don't recognize that email yet — what's your name?</p>
          <div class="field">
            <label class="label" for="login-name">Name</label>
            <div class="control">
              <input
                id="login-name"
                class="input"
                type="text"
                bind:value={form.name}
                placeholder="Ada Reader"
                required
              />
            </div>
          </div>
        {:else}
          <p class="mb-4">Check your email for a login link, and paste the token here.</p>
          <div class="field">
            <label class="label" for="login-token">Login token</label>
            <div class="control">
              <input
                id="login-token"
                class="input"
                type="text"
                bind:value={form.token}
                placeholder="Paste your login token"
                required
              />
            </div>
          </div>
        {/if}
      </section>
      <footer class="modal-card-foot">
        <div class="buttons">
          {#if form.step === 'email'}
            <Button type="submit" primary disabled={form.isLoading}>Continue</Button>
          {:else if form.step === 'register'}
            <Button type="submit" primary disabled={form.isLoading}>Create account</Button>
          {:else}
            <Button type="submit" primary disabled={form.isLoading}>Sign in</Button>
          {/if}
          <Button onclick={close}>Cancel</Button>
        </div>
      </footer>
    </form>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
  }
  .modal.is-active {
    pointer-events: auto;
  }
</style>
