// jest-dom matchers (`toBeInTheDocument`, `toHaveClass`, ...) for component
// specs. DOM cleanup between tests is handled by the `svelteTesting` plugin in
// vitest.config.js.
import '@testing-library/jest-dom/vitest'

// jsdom implements no Web Animations API, but Svelte's transitions call
// `element.animate()` on mount. Stub it with an animation that finishes on the
// next microtask so transition-bearing components render in tests. (Realistic
// transition behaviour is an e2e concern.)
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  class ImmediateAnimation {
    onfinish: (() => void) | null = null
    oncancel: (() => void) | null = null
    finished = Promise.resolve(this)
    currentTime: number | null = 0
    playbackRate = 1
    effect: unknown = null
    cancel(): void {}
    play(): void {}
    pause(): void {}
  }
  Element.prototype.animate = function animate() {
    const animation = new ImmediateAnimation()
    queueMicrotask(() => animation.onfinish?.())
    return animation as unknown as Animation
  }
}
