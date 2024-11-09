<script lang="ts">
  import onScan from 'onscan.js'
  import BooksTable from '$lib/components/BooksTable.svelte'
</script>

<div class="level">
  <div class="level-left">
    <h1 class="title">Your Friendly Book Catalog</h1>
  </div>
  <div class="level-right">
    <button class="button is-primary" on:click={() => onScan.simulate(document, '1234567890123')}>
      📖 Simulate ISBN
    </button>
  </div>
</div>

<BooksTable />
