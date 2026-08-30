import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import EditableField from './EditableField.svelte'

describe('EditableField', () => {
  it('renders the label and the value', () => {
    render(EditableField, { label: 'Pages', value: '412', onChange: vi.fn() })

    const field = screen.getByRole('textbox', { name: 'Pages' })
    expect(field.innerText).toBe('412')
  })

  it('reports edits through onChange', async () => {
    const onChange = vi.fn()
    render(EditableField, { label: 'Published', value: '1965', onChange })

    const field = screen.getByRole('textbox', { name: 'Published' })
    field.innerText = 'October 1965'
    await fireEvent.input(field)
    await fireEvent.blur(field)

    expect(onChange).toHaveBeenCalledWith('October 1965')
  })
})
