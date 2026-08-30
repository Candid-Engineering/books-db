import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import Button from './Button.svelte'

const content = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))

describe('Button', () => {
  it('renders its children as the button content', () => {
    render(Button, { children: content('Save Book') })
    expect(screen.getByRole('button', { name: 'Save Book' })).toBeInTheDocument()
  })

  it('renders an empty button when given no children (icon-only case)', () => {
    render(Button, { class: 'delete', 'aria-label': 'delete book' })

    const button = screen.getByRole('button', { name: 'delete book' })
    expect(button).toHaveClass('delete')
    expect(button.textContent).toBe('')
  })

  it('is not primary by default, and becomes primary on request', async () => {
    const { rerender } = render(Button, { children: content('Save') })
    expect(screen.getByRole('button')).not.toHaveClass('is-primary')

    await rerender({ children: content('Save'), primary: true })
    expect(screen.getByRole('button')).toHaveClass('is-primary')
  })

  it('maps the size prop to a bulma size class, defaulting to normal', async () => {
    const { rerender } = render(Button, { children: content('Save') })
    expect(screen.getByRole('button')).toHaveClass('is-normal')

    await rerender({ children: content('Save'), size: 'large' })
    expect(screen.getByRole('button')).toHaveClass('is-large')
  })

  it('forwards arbitrary attributes and handlers to the element', async () => {
    const onclick = vi.fn()
    render(Button, { children: content('Delete'), onclick, 'aria-label': 'delete book' })

    await fireEvent.click(screen.getByRole('button', { name: 'delete book' }))
    expect(onclick).toHaveBeenCalledOnce()
  })
})
