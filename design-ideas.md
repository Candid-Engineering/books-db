# Design Ideas

## Do Next

### Merge books-db-rails into this repo as a monorepo

Currently `books-db` (Tauri/Svelte) and `books-db-rails` are separate sibling repos under `~/code`, coordinated only by convention (matching wire contracts, hardcoded relative paths like `../books-db-rails` in tooling). The two are tightly coupled — the auth flow alone spans both, and any API contract change ideally lands as one atomic, reviewed change rather than two independently-timed commits in separate repos. The `test:integration` tier (real Rails server + real HTTP, see below) already has to assume the sibling checkout exists at a fixed relative path — a monorepo would remove that fragility rather than working around it.

For a solo project with no team/access-control boundary between the two halves, the usual monorepo downsides (independent release cadences, org boundaries) don't really apply. The real cost is a one-time git-history migration (`git subtree`/`git filter-repo` to preserve history) plus CI restructuring — path-based triggers so a Rails-only change doesn't rebuild the Tauri app and vice versa, and keeping the Ruby and JS/Rust toolchains from interfering within one repo.

**Status:** not started — deliberately not folded into the current auth work. Needs its own design pass covering the migration mechanics and CI layout before starting.

**Trigger:** the next time cross-repo coordination causes real friction (this integration test is arguably already a mild instance of that, but we're proceeding with the two-repo assumption for now rather than blocking on the migration).

## Deferred

Ideas considered and deliberately deferred rather than built. Revisit if their triggering conditions show up.

### 1. Typed API client via rswag-generated OpenAPI spec

The books-db-rails API layer is consumed via hand-rolled `fetch` wrappers with TS types written by hand to match controller responses. This is fine for a small endpoint surface, but doesn't scale well and can silently drift from the Rails response shapes.

**Option:** add `rswag` (`rswag-api`, `rswag-specs`, `rswag-ui`) to books-db-rails. Rewrite (or add alongside) `spec/requests/tokens_spec.rb` / `users_spec.rb` using rswag's `path`/`response` DSL. These are real request specs that hit the actual controllers, so the generated `swagger.json` (via `rswag:specs:swaggerize`) can't drift from real behavior without breaking CI.

From there, run `openapi-typescript` against the generated JSON to produce `paths`/`components` types, output locally into `src-ui/lib/generated/` (same as `sqlite_proxy.ts` today) — no need to publish a package like `open-library-api` did, since this is a first-party API in the same monorepo.

**Trigger to revisit:** once the Rails API surface grows meaningfully beyond auth (book sync, multi-device, etc.), or once response-shape drift between Rails and the frontend has actually caused a bug.

### 2. Move token custody into Rust (Tauri backend)

Auth tokens are stored/retrieved via `tauri-plugin-keyring-api` invoke calls, but the JS/webview layer handles the actual HTTP calls (`fetch`) and therefore has the raw token value in memory to set `Authorization: Bearer ...`. That means an XSS/JS-injection in the webview could read live token values.

**Option:** move the network calls themselves into Rust (`reqwest` or `tauri-plugin-http`), exposed as a `#[tauri::command]` (e.g. `invoke('authenticated_fetch', { path, method, body })`). Rust reads the token from the keychain and attaches it to the outgoing request itself — JS never sees the raw token string, only triggers authenticated requests.

This isn't needed to make CORS/CSP work — `tauri.conf.json` already has `"csp": null` and Rails' `config/initializers/cors.rb` already allows `origins "*"` with `credentials: false`, so plain JS `fetch` from the webview already works today. This is purely a token-exposure hardening step.

**Trigger to revisit:** if the app ever renders untrusted/remote content in the webview (increasing XSS surface), or before a security-sensitive release/audit.

### 3. Real browser-driven E2E (WebdriverIO + Capybara)

The `test:integration` tier (`integration/`, backed by the `tauri_integration` Rails environment) verifies the wire contract between `auth-api.ts`/`AuthStore` and a real Rails server over real HTTP — but nothing drives an actual UI. It's an integration test, not end-to-end: no login/registration page exists yet to click through, and the `books-db://authenticate/?login_token=...` deep link is an OS-level custom URL scheme that automation tools can't make macOS actually dispatch — even a "real browser" test would need to synthesize that entry point some other way.

**Option:** once a login UI exists, extend `e2e/wdio.conf.ts` (which already spawns/kills `tauri-driver` around a real Tauri app instance) to drive the actual login flow through the UI. On the Rails side, this could reuse the *same* `tauri_integration` environment rather than needing a new one — the underlying need (a real, isolated, externally-driven Rails server) doesn't change, only the driving harness does (WebdriverIO/`tauri-driver` through a real app instead of Vitest hitting HTTP directly). Capybara/system-specs are the equivalent concept purely on the Rails side, if ever needed independently of the Tauri app.

**Trigger to revisit:** once login/registration pages and the deep-link utility library exist (both currently not-started per this project's roadmap).
