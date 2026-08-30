# Move the app source from `src-ui/` back to the conventional `src/`

_Point-in-time note, filed 2026-08-30. Not implementation-ready — no commit
steps, no full impact list. Captures a deferral made while modernizing the JS
toolchain for Node 26, so the reasoning survives._

## Why this exists

`svelte.config.js` remaps every `kit.files.*` entry (`routes`, `lib`, `hooks`,
`params`, `appTemplate`, `serviceWorker`, `errorTemplate`, `assets`) into
`src-ui/` instead of the SvelteKit default `src/`. The config even carries a
comment about it: _"Wish we could just do a top-level files: 'src-ui' but,
alas, we cannot."_

That one non-standard choice forces a chain of workarounds:

- **`tsconfig.json` overrides `include`.** SvelteKit's generated
  `.svelte-kit/tsconfig.json` only knows about the dirs it was told about via
  `kit.files`, and it doesn't cover things like `src-ui/hooks.client.ts`,
  `src-ui/testing/**`, `integration/**`, or the root `*.config.js` files. So
  the project re-lists includes by hand. TypeScript *replaces* `include` from
  an extended config rather than merging it, so that hand-list has to also
  re-list everything `.svelte-kit/tsconfig.json` covers - `ambient.d.ts`,
  `non-ambient.d.ts`, `types/**/$types.d.ts`. A stale copy of that list (a
  missing leading `.` on `.svelte-kit`) silently dropped the generated route
  types, which broke `resolve()` and route-aware `$types` until it was found
  during the Node 26 work. The current fix globs `.svelte-kit/*.d.ts` to be
  drift-resistant, but the override still exists only because of the remap.
- Every tool that has a "src" assumption (Storybook, test config globs, IDE
  plugins) needs its paths spelled out.

## The fix - two sizes

### Minimal: `src-ui/` -> `src/`

Move the dir, delete the `kit.files` block from `svelte.config.js`, and let
`tsconfig.json` shrink to just `extends` + `compilerOptions` (the SvelteKit
default - no `include` override). `src-tauri/` and the root `package.json`
stay where they are.

### Fuller: split into packages

The `src-ui/` / `src-tauri/` sibling naming is Tauri scaffolding convention.
`src-tauri/` isn't a backend - it's the native host (bundles the webview,
owns the local SQLite via rusqlite, does keychain / deep-link / updater
integration). The real backend is the separate `books-db-rails` repo, so
naming this `backend/` would be actively confusing.

```
books-db/
├── ui/                 # SvelteKit - src/, package.json, tests, migrations
│   └── tsconfig.json       # just extends + compilerOptions
├── tauri/  (or native/)    # the Rust crate: src/main.rs, Cargo.toml, tauri.conf.json
├── xtask/                  # Rust helper crate
├── Cargo.toml              # Rust workspace
└── pnpm-workspace.yaml
```

All JS moves under `ui/` (`migrations/`, `integration/`, `e2e/` included).
`tauri.conf.json` `frontendDist` / `beforeDevCommand` repoint into `ui/`.
Inside `ui/` the layout is conventional, so no tsconfig override at all.

## Why it's deferred

Either size touches every relative import, the `$lib` alias base, the Tauri
side's paths (`tauri.conf.json` `frontendDist` / `devUrl`, the `sqlite_proxy`
generated-bindings location), the CI workflows, and Storybook. The fuller one
also adds a pnpm workspace and moves the Rust crates. Mechanical but wide -
its own PR, nothing else in it.

## Check afterwards

`pnpm check`, `pnpm test:integration`, `pnpm svelte:check`, `pnpm tauri build`,
and a Storybook build all green; `resolve()` / `$types` still type-check.
