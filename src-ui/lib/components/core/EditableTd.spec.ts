import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import EditableTd from './EditableTd.svelte'

const cellOf = (container: HTMLElement) =>
  container.querySelector('[contenteditable]') as HTMLElement

// jsdom has no contenteditable editing engine: `innerText` is a bare property
// with no reflection to/from `textContent`, and keystrokes don't mutate the
// node. An edit is simulated the way the browser would surface one to Svelte's
// `bind:innerText` -- set `innerText`, then dispatch `input`. Realistic caret /
// IME behaviour is covered in the e2e suite.
const type = (cell: HTMLElement, text: string) => {
  cell.innerText = text
  return fireEvent.input(cell)
}

describe('EditableTd', () => {
  it('renders the value in the cell', () => {
    const { container } = render(EditableTd, { value: '9780261102217', onChange: vi.fn() })
    expect(cellOf(container).innerText).toBe('9780261102217')
  })

  it('reports the edited text on blur', async () => {
    const onChange = vi.fn()
    const { container } = render(EditableTd, { value: 'The Hobbit', onChange })

    const cell = cellOf(container)
    await type(cell, 'The Hobbit, revised')
    await fireEvent.blur(cell)

    expect(onChange).toHaveBeenCalledWith('The Hobbit, revised')
  })

  it('reports an empty string when the cell is cleared', async () => {
    const onChange = vi.fn()
    const { container } = render(EditableTd, { value: 'delete me', onChange })

    const cell = cellOf(container)
    await type(cell, '')
    await fireEvent.blur(cell)

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('commits on Enter without inserting a newline', async () => {
    const onChange = vi.fn()
    const { container } = render(EditableTd, { value: 'Dune', onChange })

    const cell = cellOf(container)
    cell.focus()
    await type(cell, 'Dune Messiah')
    const notPrevented = await fireEvent.keyDown(cell, { key: 'Enter' })

    expect(notPrevented).toBe(false) // handler called preventDefault
    expect(onChange).toHaveBeenCalledWith('Dune Messiah')
  })

  it('follows the value prop when it changes after mount', async () => {
    const { container, rerender } = render(EditableTd, { value: 'stale', onChange: vi.fn() })
    expect(cellOf(container).innerText).toBe('stale')

    await rerender({ value: 'fresh from the store', onChange: vi.fn() })
    expect(cellOf(container).innerText).toBe('fresh from the store')
  })
})
