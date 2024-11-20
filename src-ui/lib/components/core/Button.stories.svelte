<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import { fn } from '@storybook/test'
  import Button from './Button.svelte'

  // More on how to set up stories at: https://storybook.js.org/docs/writing-stories
  const { Story } = defineMeta({
    title: 'Components/Core/Button',
    component: Button,
    tags: ['basic', 'autodocs'],
    args: {
      label: 'click me',
      onclick: fn(),
    },
    argTypes: {
      size: {
        control: { type: 'select' },
        options: ['small', 'medium', 'large', 'regular'],
      },
    },
  })
  // export default meta;
</script>

<Story name="Primary" args={{ primary: true }} />
<Story name="Secondary" />
<Story name="Small" args={{ size: 'small' }} />
<Story name="Large" args={{ size: 'large' }} />
