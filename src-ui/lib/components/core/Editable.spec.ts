import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Editable from './Editable.svelte'

const fieldOf = (container: HTMLElement) =>
  container.querySelector('[contenteditable]') as HTMLElement

// jsdom has no contenteditable editing engine: `innerText` is a bare property
// with no reflection to/from `textContent`, and keystrokes don't mutate the
// node. An edit is simulated the way the browser surfaces one to Svelte's
// `bind:innerText` -- set `innerText`, then dispatch `input`. Realistic caret /
// IME behaviour lives in the e2e suite.
const type = (field: HTMLElement, text: string) => {
  field.innerText = text
  return fireEvent.input(field)
}

describe('Editable', () => {
  it('renders the value', () => {
    const { container } = render(Editable, { value: '9780261102217', onChange: vi.fn() })
    expect(fieldOf(container).innerText).toBe('9780261102217')
  })

  it('reports the edited text on blur', async () => {
    const onChange = vi.fn()
    const { container } = render(Editable, { value: 'The Hobbit', onChange })

    const field = fieldOf(container)
    await type(field, 'The Hobbit, revised')
    await fireEvent.blur(field)

    expect(onChange).toHaveBeenCalledWith('The Hobbit, revised')
  })

  it('reports an empty string when cleared', async () => {
    const onChange = vi.fn()
    const { container } = render(Editable, { value: 'delete me', onChange })

    const field = fieldOf(container)
    await type(field, '')
    await fireEvent.blur(field)

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('commits on Enter without inserting a newline', async () => {
    const onChange = vi.fn()
    const { container } = render(Editable, { value: 'Dune', onChange })

    const field = fieldOf(container)
    field.focus()
    await type(field, 'Dune Messiah')
    const notPrevented = await fireEvent.keyDown(field, { key: 'Enter' })

    expect(notPrevented).toBe(false) // handler called preventDefault
    expect(onChange).toHaveBeenCalledWith('Dune Messiah')
  })

  it('follows the value prop when it changes after mount', async () => {
    const { container, rerender } = render(Editable, { value: 'stale', onChange: vi.fn() })
    expect(fieldOf(container).innerText).toBe('stale')

    await rerender({ value: 'fresh from the store', onChange: vi.fn() })
    expect(fieldOf(container).innerText).toBe('fresh from the store')
  })
})
