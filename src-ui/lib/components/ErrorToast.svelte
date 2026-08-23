<script lang="ts">
  import 'bulma/css/bulma.css'
  import { errorToast } from '$lib/error-toast.svelte'
</script>

{#if errorToast.message}
  <div class="notification is-danger error-toast">
    <button type="button" class="delete" aria-label="close" onclick={() => errorToast.dismiss()}></button>
    {errorToast.message}
  </div>
{/if}

<style>
  .notification.error-toast {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 1000;
    max-width: 24rem;
  }
</style>
