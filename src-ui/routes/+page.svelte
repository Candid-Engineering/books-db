<script lang="ts">
  import onScan from 'onscan.js'
  import BooksTable from '$lib/components/BooksTable.svelte'
  import _ from 'lodash'
  import Button from '$lib/components/core/Button.svelte'
  import AddBookModal from '$lib/components/AddBookModal.svelte'
  import { modals } from 'svelte-modals'

  function simulateScan() {
    const sampleBooks = {
      '9780316514828': 'Hunting Prince Dracula',
      '978-0307292063': 'The Foundation Trilogy',
      '9780553418026': 'The Martian',
      '978-0593818749': 'We\'ll Prescribe You a Cat',
      '9781250214713': 'All Systems Red',
    }
    const isbn = _(sampleBooks).keys().sample() as string
    onScan.simulate(document, isbn)
  }

  function handleAddBookClick() {
    modals.open(AddBookModal, { title: 'Add Book Manually', message: 'wow a modal' })
  }

</script>

<div class="level">
  <div class="level-left">
    <h1 class="title">Your Friendly Book Catalog</h1>
  </div>
  <div class="level-right">
    <Button primary onclick={simulateScan}>
      📖 Simulate ISBN
    </Button>
    <Button primary onclick={handleAddBookClick}>Add Book</Button>
  </div>
</div>

<BooksTable />
