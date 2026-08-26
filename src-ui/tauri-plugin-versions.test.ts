import { describe, it, expect } from 'vitest'
import { findMismatches, collectPluginVersionPairs } from './tauri-plugin-versions'

// First-party @tauri-apps/plugin-* packages and their tauri-plugin-* Rust
// crate counterparts are published in lockstep by the Tauri project - the
// same version number on both sides is how they guarantee the JS bindings
// and the Rust command/IPC wire format actually agree. A `cargo update`
// bumping the Rust side alone (as happened this session, breaking app boot
// - see llm_plans/eventually/2026-08-24-real-tauri-e2e-integration.md)
// silently breaks that guarantee with no compiler or type error on either
// side. This doesn't prove the two sides behave correctly together (only a
// real integration test could) - it just catches the exact mechanical drift
// that caused this regression.
describe('findMismatches', () => {
  it('flags a pair whose JS and Rust versions differ', () => {
    const pairs = [{ name: 'fs', jsVersion: '2.0.2', rustVersion: '2.5.1' }]

    expect(findMismatches(pairs)).toEqual(pairs)
  })

  it('does not flag a pair with matching versions', () => {
    expect(findMismatches([{ name: 'fs', jsVersion: '2.5.1', rustVersion: '2.5.1' }])).toEqual([])
  })
})

describe('collectPluginVersionPairs', () => {
  it('finds no mismatches between installed @tauri-apps/plugin-* packages and their Cargo.lock crates', () => {
    expect(findMismatches(collectPluginVersionPairs())).toEqual([])
  })
})
