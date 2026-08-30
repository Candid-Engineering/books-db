<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Button from './Button.svelte'

  const { Story } = defineMeta({
    title: 'Components/Core/Button',
    component: Button,
    tags: ['basic', 'autodocs'],
    args: {},
  })
</script>

<Story name="Primary">
  <Button primary>Click me</Button>
</Story>

<Story name="Secondary">
  <Button>Click me</Button>
</Story>

<Story name="Small">
  <Button size="small">Small</Button>
</Story>

<Story name="Large">
  <Button size="large">Large</Button>
</Story>
