<script lang="ts">
  /** @type {import(''./$types').LayoutData}*/
  export let data
  console.log('data', data)
</script>

<nav>
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>

<slot></slot>
