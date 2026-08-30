# Login/register modal (no route, no guard)

_Point-in-time plan, agreed 2026-08-23. Preserved as-approved; the actual implementation may have evolved since — check current code/design-ideas.md for present state._

_Revision note: this document originally described a dedicated `/login` route with a route guard forcing sign-in. That design was reconsidered before implementation started — see below for why — and this file was updated in place to reflect the revised design that was actually built, rather than keeping a stale doc around._

## Context

This app's core function (local book cataloging) doesn't need an account — auth is only for a future optional cloud-sync up-sell. So there's no guard, no forced redirect, and no dedicated `/login` route: login is opened as a small modal overlay from a nav link, exactly like `AddBookModal.svelte` already works (`svelte-modals`, already wired up in `+layout.svelte`/`+page.svelte`). Also: login and registration are functionally the same action from the user's perspective — submit an email, get a link — so they're merged into one flow, with a name prompt only appearing as a fallback step when the email turns out to be unregistered, rather than two separate flows/pages.

## Design

### One modal, three steps, no new route

`LoginModal.svelte` (new, `src-ui/lib/components/`), following `AddBookModal.svelte`'s exact contract (`isOpen`/`close` props, opened via `await modals.open(LoginModal, {})`):

1. **`email` step**: email field → `authStore.requestLoginLink(email)`.
   - Success → advance to `enter-token`.
   - Fails with "No such user" → advance to `register` (the email is already known to be unregistered; carry it forward).
   - Any other failure → show the error, stay put.
2. **`register` step**: name field (email already captured) → new `authStore.register(email, name)` → `POST /users` (existing endpoint, already sends its own login-link welcome email — confirmed via `UsersController#create` → `UserMailer#welcome_email`, same `?login_token=` link format).
   - Success → advance to `enter-token`.
3. **`enter-token` step**: token field (pasted from the dev email) → `authStore.exchangeLoginToken(token)` → on success, `authStore.state.isAuthenticated` flips true; the modal closes (`close()`) and the header updates reactively.

No Rails changes needed — both `POST /tokens/request_login_link` and `POST /users` already exist and already behave exactly as this flow needs.

**Known simplification, called out deliberately**: detecting "should fall back to registration" is done by string-matching `authStore.state.error === 'No such user'` — the exact message Rails hardcodes in `tokens_controller.rb`. `AuthApiError` already carries a machine-readable `.code`, but `AuthState.error` (the already-shipped, tested public interface) only exposes a plain string, and widening it now would ripple through already-committed code for a "minimal" pass. Fragile-but-scoped; worth threading a real code through later if this string ever needs to change.

### New: `AuthStore#register` + `auth-api.ts#registerUser`

`AuthStore`'s interface currently has no registration method at all. Add one, mirroring `requestLoginLink`'s exact shape (`isLoading`/`error` handling, `AuthApiError` → `authState.error`, non-`AuthApiError` rethrown):
```ts
// AuthStore interface addition
register(email: string, name: string): Promise<void>
```
Backed by a new `auth-api.ts` function `registerUser(email, name)`: `POST /users` with body `{ user: { email, name } }` (note: unlike the token endpoints, `UsersController` does *not* disable `wrap_parameters`, so this nested shape is required — confirmed via `UsersController#create`'s `params.permit(user: [:name, :email]).require(:user)`). Failure response shape here is different too — Rails' default `render json: @user.errors` is a validation-errors hash (`{"email": ["has already been taken"]}`), not either of the two shapes `auth-api.ts` already normalizes (`{error}` / `{errors: [...]}`) — needs its own small extraction (first message found, generic fallback otherwise).

### `LoginForm` (`.svelte.ts` view-model, unchanged pattern from before)

Same "logic in a plain runes class, thin template, no component-test infra introduced" reasoning as the prior plan — still the right call here, nothing about the modal pivot changes that reasoning.
```ts
export type LoginFormStep = 'email' | 'register' | 'enter-token'

export class LoginForm {
  step = $state<LoginFormStep>('email')
  email = $state('')
  name = $state('')
  token = $state('')

  constructor(private authStore: AuthStore) {}

  get isLoading() { return this.authStore.state.isLoading }
  get error() { return this.authStore.state.error }

  async submitEmail(): Promise<void> {
    await this.authStore.requestLoginLink(this.email)
    if (!this.authStore.state.error) this.step = 'enter-token'
    else if (this.authStore.state.error === 'No such user') this.step = 'register'
  }

  async submitRegistration(): Promise<void> {
    await this.authStore.register(this.email, this.name)
    if (!this.authStore.state.error) this.step = 'enter-token'
  }

  async submitToken(): Promise<void> {
    await this.authStore.exchangeLoginToken(this.token)
  }
}
```

### Header: current user + logout, `NavBar.svelte` + `+layout.svelte` (unchanged from prior plan)

Same as before: extend `NavBar.svelte` with an optional `end` snippet prop rendered into a new `navbar-end` div (today it only has `navbar-start`). `+layout.svelte` puts either a `Login` nav-item (`onclick` → `modals.open(LoginModal, {})`, mirroring `+page.svelte:21-23`'s exact `handleAddBookClick` pattern) or `Signed in as {user.name}` + `Logout` (`authStore.logout()`) into that slot, depending on `authStore.state.isAuthenticated`.

### Session bootstrap: `hooks.client.ts` (unchanged from prior plan)

Still add `await authStore.initialize()` + `window.authStore = authStore` alongside the existing `await migrate(db)` — restoring an existing session on boot is still wanted, it's just no longer *required* to use the app.

### Explicitly removed from the prior plan

No `/login` route, no `+layout.svelte` guard `$effect`, no `$page`/`goto` redirect logic — the app is fully usable unauthenticated, so none of that applies anymore.

## Commit discipline & TDD

**Also, standalone** (already landed as its own commit): append a new entry to `design-ideas.md`'s Deferred section — *"Add a component test framework (e.g. `@testing-library/svelte`) and backfill tests for existing components."* This work deliberately keeps `.svelte` templates untested (per the reasoning above — no such framework exists in this repo yet, and introducing one is its own decision), so the gap should be written down as a real, named deferred item rather than silently left implicit.

Small commits, tests first wherever there's real logic:
1. `auth-api.ts#registerUser` — test first (success; validation-error shape extraction), then implement.
2. `AuthStoreImpl#register` + `AuthStore` interface — test first (success sets nothing wrong; `AuthApiError` → `authState.error`), then implement.
3. `LoginForm#submitEmail` (including the register-fallback branch) — test first, then implement.
4. `LoginForm#submitRegistration` — test first, then implement.
5. `LoginForm#submitToken` — test first, then implement.
6. `LoginModal.svelte` — the three-step template. Not automatically tested (matches this repo's existing convention, same as before); verified manually.
7. `NavBar.svelte` — add the `end` snippet prop + `navbar-end` div. Small, standalone, no behavior change for existing callers.
8. `+layout.svelte` — wire the `Login`/`Signed-in-as+Logout` content into `NavBar`'s new `end` slot. Verified manually.
9. `hooks.client.ts` — `await authStore.initialize()` + `window.authStore`. Verified manually.

## Critical files

- `src-ui/lib/auth/auth-api.ts`, `auth-api.test.ts`
- `src-ui/lib/auth/auth-store.svelte.ts`, `auth-store.test.ts`
- `src-ui/lib/auth/login-form.svelte.ts` (new), `login-form.test.ts` (new)
- `src-ui/lib/components/LoginModal.svelte` (new)
- `src-ui/lib/components/core/NavBar.svelte`
- `src-ui/routes/+layout.svelte`
- `src-ui/hooks.client.ts`

## Verification

- `pnpm check:js` green after each of steps 1-5 and after 7/8/9.
- Manual, end to end: start Rails dev (`rails server`, real dev DB + `letter_opener`) and the Tauri app (`pnpm tauri dev`).
  - Confirm the app loads and is fully usable signed out (no redirect, book catalog works).
  - Click Login → email step → for an existing seeded user, confirm it advances straight to enter-token; pull the token from `letter_opener`, paste it, confirm the modal closes and the header shows the signed-in user.
  - Repeat with a brand-new email → confirm it falls to the register step, submit a name, confirm a *welcome* email appears in `letter_opener` with its own token, paste it, confirm sign-in.
  - Click Logout → confirm the header reverts to showing Login, app remains usable.
