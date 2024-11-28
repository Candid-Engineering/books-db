<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import NavBar from './NavBar.svelte'

  const { Story } = defineMeta({
    title: 'Components/NavBar',
    component: NavBar,
    tags: ['basic', 'autodocs'],
    args: {},
  })
</script>

<Story name="Primary">
  <NavBar>
    <a class="navbar-item" href="#top">Header link 1</a>
    <a class="navbar-item" href="#top">Header link 2</a>
    <a class="navbar-item" href="#top">Header link 3</a>
  </NavBar>
</Story>
