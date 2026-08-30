import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import Button from './Button.svelte'

describe('Button', () => {
  it('renders its label', () => {
    render(Button, { label: 'Scan' })
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument()
  })

  it('renders children instead of the label when given', () => {
    const children = createRawSnippet(() => ({ render: () => '<span>📖 Simulate</span>' }))
    render(Button, { label: 'ignored', children })
    expect(screen.getByRole('button')).toHaveTextContent('📖 Simulate')
    expect(screen.getByRole('button')).not.toHaveTextContent('ignored')
  })

  it('is not primary by default, and becomes primary on request', async () => {
    const { rerender } = render(Button, { label: 'Save' })
    expect(screen.getByRole('button')).not.toHaveClass('is-primary')

    await rerender({ label: 'Save', primary: true })
    expect(screen.getByRole('button')).toHaveClass('is-primary')
  })

  it('maps the size prop to a bulma size class, defaulting to normal', async () => {
    const { rerender } = render(Button, { label: 'Save' })
    expect(screen.getByRole('button')).toHaveClass('is-normal')

    await rerender({ label: 'Save', size: 'large' })
    expect(screen.getByRole('button')).toHaveClass('is-large')
  })

  it('forwards arbitrary attributes and handlers to the element', async () => {
    const onclick = vi.fn()
    render(Button, { label: 'Delete', onclick, 'aria-label': 'delete book' })

    const button = screen.getByRole('button', { name: 'delete book' })
    await fireEvent.click(button)
    expect(onclick).toHaveBeenCalledOnce()
  })
})
