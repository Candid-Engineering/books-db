# Design Ideas (Deferred)

Ideas considered and deliberately deferred rather than built. Revisit if their triggering conditions show up.

## 1. Typed API client via rswag-generated OpenAPI spec

The books-db-rails API layer is consumed via hand-rolled `fetch` wrappers with TS types written by hand to match controller responses. This is fine for a small endpoint surface, but doesn't scale well and can silently drift from the Rails response shapes.

**Option:** add `rswag` (`rswag-api`, `rswag-specs`, `rswag-ui`) to books-db-rails. Rewrite (or add alongside) `spec/requests/tokens_spec.rb` / `users_spec.rb` using rswag's `path`/`response` DSL. These are real request specs that hit the actual controllers, so the generated `swagger.json` (via `rswag:specs:swaggerize`) can't drift from real behavior without breaking CI.

From there, run `openapi-typescript` against the generated JSON to produce `paths`/`components` types, output locally into `src-ui/lib/generated/` (same as `sqlite_proxy.ts` today) — no need to publish a package like `open-library-api` did, since this is a first-party API in the same monorepo.

**Trigger to revisit:** once the Rails API surface grows meaningfully beyond auth (book sync, multi-device, etc.), or once response-shape drift between Rails and the frontend has actually caused a bug.

## 2. Move token custody into Rust (Tauri backend)

Auth tokens are stored/retrieved via `tauri-plugin-keyring-api` invoke calls, but the JS/webview layer handles the actual HTTP calls (`fetch`) and therefore has the raw token value in memory to set `Authorization: Bearer ...`. That means an XSS/JS-injection in the webview could read live token values.

**Option:** move the network calls themselves into Rust (`reqwest` or `tauri-plugin-http`), exposed as a `#[tauri::command]` (e.g. `invoke('authenticated_fetch', { path, method, body })`). Rust reads the token from the keychain and attaches it to the outgoing request itself — JS never sees the raw token string, only triggers authenticated requests.

This isn't needed to make CORS/CSP work — `tauri.conf.json` already has `"csp": null` and Rails' `config/initializers/cors.rb` already allows `origins "*"` with `credentials: false`, so plain JS `fetch` from the webview already works today. This is purely a token-exposure hardening step.

**Trigger to revisit:** if the app ever renders untrusted/remote content in the webview (increasing XSS surface), or before a security-sensitive release/audit.
