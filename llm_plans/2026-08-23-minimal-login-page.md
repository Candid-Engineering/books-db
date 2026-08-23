# Minimal login page

_Point-in-time plan, agreed 2026-08-23. Preserved as-approved; the actual implementation may have evolved since — check current code/design-ideas.md for present state._

## Context

`AuthStore` (`src-ui/lib/auth/auth-store.svelte.ts`) is fully built and tested, but there's no UI to actually drive it — no route, no form, no guard, no session bootstrapping on app start. The user wants to manually sign in through a real page rather than devtools console calls, and wants the app to actually behave like an authenticated app: redirect to `/login` when signed out, redirect back to `/` after signing in, and show who's signed in (with a logout link) in the header once authenticated. Deep-link handling (OS custom-URL-scheme dispatch) isn't built yet and is out of scope here — so instead of relying on clicking the emailed link, the page includes a manual "paste your login token" step as its second stage, which is both a reasonable permanent fallback UX and exactly what's needed to test the full flow today.

## Design

### Two-step flow, one route

`src-ui/routes/login/+page.svelte` (new — no `/login` route exists yet):
1. **Request-link step**: email input → `authStore.requestLoginLink(email)`. On success, advance to step 2.
2. **Enter-token step**: token input (pasted from the dev email, viewable via `letter_opener` in Rails dev) → `authStore.exchangeLoginToken(token)`. On success, `authStore.state.isAuthenticated` flips true and the page shows a signed-in confirmation inline.

### Session bootstrap: `hooks.client.ts`

`src-ui/hooks.client.ts` already does exactly the "boot client-only runtime dependencies before the app renders" thing this needs — it currently does `await migrate(db)` then `window.booksStore = getBooksStore()` (both blocking, top-level-await, before SvelteKit mounts anything — this is *why* `await migrate(db)` already works without a race: SvelteKit awaits client hook module evaluation before starting the router). Add `await authStore.initialize()` here the same way, plus `window.authStore = authStore` (matching the existing `window.booksStore` devtools-console convenience — genuinely useful given how this whole thread started).

Because this resolves before any route/layout ever renders, `authStore.state.isAuthenticated` is already settled by the time the guard below runs — no loading-flicker/race handling needed.

### Guard + redirect: `+layout.svelte`

A single reactive `$effect`, symmetric in both directions:
```ts
$effect(() => {
  if (!authStore.state.isAuthenticated && $page.url.pathname !== '/login') {
    goto('/login')
  } else if (authStore.state.isAuthenticated && $page.url.pathname === '/login') {
    goto('/')
  }
})
```
Uses `$page` from `$app/stores` (not `$app/state` — confirmed the installed `@sveltejs/kit` is `2.8.1`, and `$app/state` needs 2.12+; `$app/stores`' `$page` is what's actually available, and works fine auto-subscribed inside a rune-based `$effect`) and `goto` from `$app/navigation`. Logout doesn't need its own redirect call — calling `authStore.logout()` flips `isAuthenticated` false, which this same effect already reacts to.

### Header: current user + logout, `NavBar.svelte` + `+layout.svelte`

`NavBar.svelte` today only renders a single `children` snippet into `navbar-menu > navbar-start` (confirmed, full file read) — there's no right-aligned `navbar-end` section yet. Extend it with a second, optional snippet prop (e.g. `end`) rendered into a new `navbar-end` div — keeps `NavBar` itself generic/reusable (no auth-specific knowledge baked into it), while `+layout.svelte` decides what goes in each slot: existing `Home`/`About` links in `start`, and either a `Login` link (unauthenticated) or `Signed in as {user.name}` + a `Logout` link (authenticated, calling `authStore.logout()`) in `end` — styled as plain `<a class="navbar-item">` to match the existing `Home`/`About` markup, not the `Button` component (that's for form actions, not nav items).

### Logic lives in a plain `.svelte.ts` class, not the template

This repo already has an established pattern for this: `BooksStore` (`src-ui/lib/state/Books.svelte.ts`) is a plain runes-based class, fully unit-tested (`Books.spec.ts`), completely separate from any `.svelte` template. `AuthStoreImpl` follows the same shape. There is **no existing `.svelte` component test anywhere in this repo** (confirmed — no `@testing-library/svelte` or equivalent installed, no component test files exist), so introducing one now would mean pulling in a whole new testing dependency/setup as its own decision, not something to fold in silently.

Instead: a new `LoginForm` class in `src-ui/lib/auth/login-form.svelte.ts` holds all the actual logic (`step`/`email`/`token` as `$state`, `submitEmail()`/`submitToken()` wrapping `authStore` calls, `error`/`isLoading` getters delegating to `authStore.state`) and gets full TDD coverage using the exact same test infrastructure already built for `auth-store.test.ts` (MSW for the Rails calls, `setupMockKeyring()`, `createTestAuthStore`). The `+page.svelte` file itself is a thin template — `const form = new LoginForm(authStore)`, then Bulma markup bound to `form`'s fields — matching how thin `.svelte` files already are elsewhere (e.g. `AddBookModal.svelte` delegates to `booksStore`/props rather than holding its own business logic). It's verified manually by actually clicking through the running app, same as every other `.svelte` template in this repo today.

**Design shape of `LoginForm`:**
```ts
export type LoginFormStep = 'request-link' | 'enter-token'

export class LoginForm {
  step = $state<LoginFormStep>('request-link')
  email = $state('')
  token = $state('')

  constructor(private authStore: AuthStore) {}

  get isLoading() { return this.authStore.state.isLoading }
  get error() { return this.authStore.state.error }

  async submitEmail(): Promise<void> {
    await this.authStore.requestLoginLink(this.email)
    if (!this.authStore.state.error) this.step = 'enter-token'
  }

  async submitToken(): Promise<void> {
    await this.authStore.exchangeLoginToken(this.token)
  }
}
```

### Template conventions to follow (confirmed from `AddBookModal.svelte`, `Button.svelte`, `NavBar.svelte`)

- Bulma `field`/`control`/`input`/`label` markup (e.g. `AddBookModal.svelte:88-99`).
- Reuse `Button.svelte` (`$lib/components/core/Button.svelte`) for the submit button (`primary`, `label`, spreads `type="submit"` via `restProps`).
- Svelte 5 event-handler property syntax throughout this repo (`onsubmit={...}`, not `on:submit`) — confirmed zero uses of legacy `on:` directives anywhere in `src-ui/**/*.svelte`.
- No existing error-notification convention in this codebase (grep for `is-danger`/`notification` returned nothing) — this page establishes it: `<div class="notification is-danger">{form.error}</div>`, a plain, standard Bulma pattern, not inventing anything novel.

## Commit discipline & TDD

**Step 0** (first, standalone commit): archive this plan document into `llm_plans/2026-08-23-minimal-login-page.md`, same as the `tauri_integration` plan before it — before any implementation starts.

**Also, standalone**: append a new entry to `design-ideas.md`'s Deferred section — *"Add a component test framework (e.g. `@testing-library/svelte`) and backfill tests for existing components."* This work deliberately keeps `.svelte` templates untested (per the reasoning above — no such framework exists in this repo yet, and introducing one is its own decision), so the gap should be written down as a real, named deferred item rather than silently left implicit.

Small, separate commits, tests first wherever there's real logic to test:
1. `LoginForm.submitEmail()` — write `login-form.test.ts` first (success advances to `enter-token`; failure sets `error`, stays on `request-link`), then implement just that method and the `step`/`email` state.
2. `LoginForm.submitToken()` — same pattern (success → `authStore.state.isAuthenticated` true; failure → `error` set), then implement.
3. `src-ui/routes/login/+page.svelte` — the template wiring. Not automatically tested (matches this repo's existing convention — no `.svelte` files are unit-tested today); verified by running the app and clicking through manually.
4. `hooks.client.ts` — `await authStore.initialize()` + `window.authStore`. Small, standalone; not unit-tested (same reasoning as the existing `await migrate(db)` line — it's app-boot wiring, not logic), verified manually.
5. `NavBar.svelte` — add the `end` snippet prop + `navbar-end` div. Small, standalone, no behavior change for existing callers (optional prop).
6. `+layout.svelte` — the guard `$effect` + wiring the user-info/logout content into `NavBar`'s new `end` slot. Verified manually (this is exactly the kind of cross-cutting, runtime-state-dependent behavior that's genuinely hard to unit test meaningfully without component-rendering infra this repo doesn't have yet).

## Critical files

- `src-ui/lib/auth/login-form.svelte.ts` (new)
- `src-ui/lib/auth/login-form.test.ts` (new)
- `src-ui/routes/login/+page.svelte` (new)
- `src-ui/hooks.client.ts`
- `src-ui/lib/components/core/NavBar.svelte`
- `src-ui/routes/+layout.svelte`

## Verification

- `pnpm check:js` green after each logic-bearing commit (1, 2, and after 4/5/6 to confirm no typecheck/lint regressions).
- Manual, end to end: start Rails dev (`rails server`, real dev DB + `letter_opener` for email preview) and the Tauri app (`pnpm tauri dev`).
  - Load the app signed out → confirm it auto-redirects to `/login` (guard direction 1).
  - Request a link for a real seeded user, pull the token from the `letter_opener` preview, paste it in → confirm redirect to `/` (guard direction 2) and the header shows the signed-in user.
  - Click Logout → confirm redirect back to `/login` and the header reverts to showing a Login link.
  - Confirm real tokens land in the real (not mocked) OS keychain throughout.
