# Svelte component testing (jsdom + @testing-library/svelte)

_Point-in-time plan, agreed 2026-08-30. Adds the ability to test `.svelte`
components and covers a first couple of existing ones to establish the pattern;
later PRs widen coverage. The change that motivated it (hiding the ISBN columns
behind an expandable row) is a separate follow-up PR with its own plan._

## Context

The repo has ~20 test files, every one against a plain `.ts` module — store
logic, API clients, CSV, sync. There is **no way to test a `.svelte`
component**: no `@testing-library/svelte`, no render helper, no precedent.
Component behaviour (which columns render, does a row expand, does an inline
edit reach the store) is only reachable today through the `@wdio` e2e suite,
which is slow and boots a real Tauri build.

Several near-term changes are component-shaped: hiding the ISBN columns behind a
per-row disclosure, and Stage 1 of `2026-08-30-duplicate-copies.md` (collapsing
re-scanned copies into one expandable row). Both want fast unit-level assertions
on markup and wiring. This plan adds that capability and specs for the two
context-free primitives (`Button`, `EditableTd`) to prove the pattern; the
store-backed components (`BooksTable`, `NavBar`, `ErrorToast`, …) follow in
later PRs.

## Decision: jsdom, not a real browser

| | jsdom + `@testing-library/svelte` | `@vitest/browser` + `vitest-browser-svelte` |
|---|---|---|
| Test env | same as today (`environment: 'jsdom'`) | real Chromium/WebKit (Playwright or the wdio provider) |
| MSW | existing `msw/node` setup, unchanged | needs the service-worker integration → second MSW setup + split config |
| CI | no change | browser download + browser step |
| Fidelity | no layout; no real `contenteditable` editing; `transition:` runs but is inert | faithful |

**Chosen: jsdom.** One MSW setup, one vitest config, no CI change. The fidelity
gap is real but narrow — it bites keystroke-by-keystroke editing of a
`contenteditable` region and visual transition behaviour, both of which already
belong to `e2e/` (wdio). Revisit `@vitest/browser` only if component specs start
contorting around jsdom.

### jsdom + contenteditable — the known limit

`EditableTd.svelte` (the repo's one interactive primitive) is a `contenteditable`
`<td>` with `bind:innerText`. jsdom reflects the `contenteditable` attribute and
implements `innerText` as a rough `textContent` alias (no layout), but has **no
editing engine** — `fireEvent` / `user-event` typing does not mutate the region.
Specs simulate an edit by setting `element.textContent` directly, then firing
`blur`. Enough to assert the component contract (`onChange` fires with the cell
text); not enough for caret / IME / keystroke behaviour, which stays in e2e.

## Design

### 1. Dependencies (`package.json`, devDependencies)

- `@testing-library/svelte@^5.4.2` — Svelte 5 compatible; renders through the
  `sveltekit()` vite plugin already in `vitest.config.js`.
- `@testing-library/jest-dom@^7.0.1` — `toBeInTheDocument`, `toHaveTextContent`,
  etc.; keeps component assertions readable.

No `@testing-library/user-event` yet — `fireEvent` covers these specs; add it
when one needs realistic click/tab sequencing. Neither package has a native
build (no `neverBuiltDependencies` concern). `pnpm install` → lockfile update.

### 2. `src-ui/testing/component-setup.ts` (new)

Mirrors `msw-setup.ts` / `db-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/svelte'

// This project doesn't enable Vitest globals, so @testing-library/svelte's
// automatic cleanup detection never fires — register it explicitly.
afterEach(cleanup)
```

### 3. `vitest.config.js`

Append `'./src-ui/testing/component-setup.ts'` to `test.setupFiles`. Shared
config — component specs and module specs run in one pass, same jsdom env, same
MSW server. `tsconfig.json` already globs `./src-ui/**/*.ts`, so the jest-dom
matcher augmentation reaches `pnpm js:typecheck` with no `types` change.

### 4. First specs — two context-free primitives (new)

Both live next to the component. Neither touches a store or `$app/*`, so they're
the safe first proof of the harness.

**`src-ui/lib/components/core/Button.spec.ts`** — the simple one:

- renders `label` as the button text
- renders a `children` snippet instead when given one
- `primary` adds `is-primary`; `size` maps to `is-{size}`
- forwarded rest props reach the DOM element (`onclick` fires, `aria-label`
  lands)

**`src-ui/lib/components/core/EditableTd.spec.ts`** — the behavioural one:

- renders the `value` prop as the cell text
- `blur` calls `onChange` with the current cell text (edit simulated via
  `element.textContent = …`)
- clearing the cell calls `onChange('')` (the `currVal || ''` path)
- `Enter` blurs the cell (→ `onChange` fires; newline not inserted)
- **`value` prop changing after mount re-flows into the cell** — locks in the
  writable-`$derived` behaviour the component comment calls out (rows are reused
  by book id, so a late store update must reach the cell)

## Explicitly out of scope

- A store-backed render helper (`renderWithBooksStore`; a `booksStore` prop seam
  on `BooksTable` / `BooksTableRow`). Only the ISBN PR exercises it — built
  there, not as unused infra here.
- Specs for `NavBar`, `ErrorToast`, `AddBookModal`, `BooksTable`,
  `BooksTableRow`. Later PRs; this one proves the harness on the two primitives.
- `@vitest/browser`, `@testing-library/user-event`.
- Any component or production-code change. This PR = two dev deps, one setup
  file, one config line, two spec files.
- Storybook interaction tests (`@storybook/test` is installed and unrelated).

## Commit discipline & TDD

1. Write `Button.spec.ts` with the cases above. `pnpm js:test run Button` →
   **red** (can't resolve `@testing-library/svelte`).
2. Add the two devDeps, `pnpm install`.
3. Add `component-setup.ts`, wire it into `vitest.config.js`. Re-run → **green**.
4. Write `EditableTd.spec.ts` — red on each case first, then it's already wired,
   so this is straight red→green per assertion.
5. `pnpm check:js` — format, typecheck, lint, full suite; all green.

Commits: (a) deps + `component-setup.ts` + config + `Button.spec.ts`;
(b) `EditableTd.spec.ts`.

## Critical files

- `package.json` (devDependencies, lockfile)
- `vitest.config.js`
- `src-ui/testing/component-setup.ts` (new)
- `src-ui/lib/components/core/Button.spec.ts` (new)
- `src-ui/lib/components/core/EditableTd.spec.ts` (new)

## Verification

- `pnpm js:test run Button EditableTd` — green; were red before step 2.
- `pnpm check:js` — green end to end.
- `pnpm js:test run` — existing suite unaffected (prior count + the new cases).
- CI (`.github/workflows/vitest.js.yml`) — file unchanged, stays green, no new
  job, no browser download.

## Follow-up PRs (each gets its own plan)

- **Widen component coverage**: specs for `NavBar`, `ErrorToast`, and — via a
  `booksStore` prop seam + a `renderWithBooksStore` helper — `BooksTable` /
  `BooksTableRow` / `AddBookModal`.
- **Hide ISBN columns**: drop ISBN-10/13 from the catalogue table, move them
  into an editable per-row expandable sub-row; reorder `AddBookModal` fields so
  identifiers come last. Builds on the seam above.
- **Duplicate-copies Stage 1** (`2026-08-30-duplicate-copies.md`).
- Eventually: manual "Add Book" becomes an empty editable row in the table
  rather than a modal (user's steer, 2026-08-30).
