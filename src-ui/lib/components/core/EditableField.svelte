<script lang="ts">
  import Editable from './Editable.svelte'

  interface Props {
    /**
     * Field name, shown beside the value and used as its accessible name.
     */
    label: string

    /**
     * Value that can be edited.
     */
    value: string | null

    /**
     * Function for handling value changes.
     */
    onChange: (newVal: string) => void
  }

  let { label, value, onChange }: Props = $props()
</script>

<div class="field is-horizontal">
  <div class="field-label is-normal">
    <span class="label">{label}</span>
  </div>
  <div class="field-body">
    <div class="control">
      <Editable {value} {onChange} ariaLabel={label} />
    </div>
  </div>
</div>
