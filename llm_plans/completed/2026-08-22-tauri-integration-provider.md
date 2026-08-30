# Real integration test against a live Rails server

_Point-in-time plan, agreed 2026-08-22. Preserved as-approved; the actual implementation may have evolved since — check current code/design-ideas.md for present state._

## Context

AuthStore's unit tests all mock the Rails HTTP boundary (MSW), so they verify our own code's logic but never prove the wire contract against the *actual* Rails app. This plan builds a genuine integration tier: boot a real Rails server, drive the real `auth-api.ts`/`AuthStore` against it, assert against real responses. Explicitly **not built now**: real browser/webview-driven E2E (WebdriverIO+`tauri-driver` on this side, Capybara/system-specs on the Rails side) — can't be built yet regardless (no login UI exists, and the `books-db://authenticate/` deep link is an OS-level scheme `tauri-driver` can't dispatch). Captured in `design-ideas.md` for later.

**Naming discipline** (went through several rounds on this — it matters): on the `books-db`/JS side, "integration test" is unambiguous, standard vocabulary — the dir (`integration/`), npm script (`pnpm test:integration`), and vitest config keep that name throughout. On the **Rails side**, bare "integration" already means something else internally (`ActionDispatch::IntegrationTest` / RSpec's `type: :request` specs — in-process, no real socket, no real server), so reusing it unqualified there would be misleading. Landed on **`tauri_integration`** for the Rails-side environment/namespace/controller: qualifying "integration" with "tauri" scopes it to a specific, custom env name rather than colliding with Rails' own bare term, while staying consistent with the vocabulary already used on the `books-db` side.

This also turned out to be the right name for a reason beyond just avoiding collision: the underlying setup here (a real, isolated, externally-driven Rails server) is exactly what a future real-browser tier would also need — same environment, just driven by WebdriverIO/`tauri-driver` through an actual Tauri app instead of Vitest hitting HTTP directly. So `tauri_integration` describes the *environment's role* ("however Tauri integrates with a real Rails backend") in a way that should hold up even if that later tier reuses this same environment rather than needing its own.

## Commit discipline & TDD

**Step 0** (first, standalone commit, `books-db`): create `llm_plans/` and commit this plan document into it as a dated, point-in-time snapshot — before any implementation starts, so the design as agreed today is preserved in the repo regardless of how the implementation itself evolves.

Small, separate commits per logical unit — don't batch the two repos' changes together (they're separate commits regardless), and don't batch multiple pieces within one repo into a single commit either. Suggested breakdown, each independently verifiable before moving to the next:

**Rails (`books-db-rails`):**
1. `Gemfile` (`:tauri_integration` added to the existing group) + `bundle install`.
2. `config/database.yml` + `config/environments/tauri_integration.rb` — verify with `bin/rails runner -e tauri_integration "puts 'ok'"` before moving on.
3. `lib/tasks/tauri_integration.rake` (`db:tauri_integration:prepare`) — verify by direct invocation (see Verification).
4. **TDD applies directly here**: pull the actual logic (FactoryBot creation, `login_token` lookup) into a small env-independent service object (e.g. `app/services/tauri_integration/factory_service.rb`), with its own RSpec unit spec written first. This is what resolves the env-gating wrinkle above — the logic itself is fully testable under normal `RAILS_ENV=test`/`bundle exec rspec`, same as everything else in `spec/`, even though the *route* that calls it only exists in the `tauri_integration` env.
5. Controller + routes — thin glue calling the already-tested service. Verified by direct HTTP calls against a running `tauri_integration`-env server (Verification section), not a request spec, since the routes aren't reachable under `test` env.

**`books-db`:**
6. `integration/rails-integration-client.ts` + a normal MSW-based unit test *in the existing suite* (`pnpm js:test`, alongside `auth-api.test.ts`) — its own correctness (URL construction, JSON parsing) doesn't need a real server to verify, same reasoning as `auth-api.ts`. TDD applies directly: write that test first.
7. `integration/global-setup.ts` — if the readiness-poll loop (`isServerUp`/`waitForServer`) is extracted as its own small function, it's also unit-testable with a mocked `fetch` in the normal suite (simulate down-then-up sequences). The detect-or-boot/spawn/kill orchestration itself isn't meaningfully unit-testable (it's process management) — that's verified by direct invocation instead (Verification section), not an RSpec-style exception so much as the honest limit of what a mock buys you here.
8. `vitest.integration.config.ts` — small, standalone.
9. `integration/auth-flow.integration.spec.ts` — write this first (red — nothing exists yet to make it pass), then bring 6-8 online until it goes green against the real server. This *is* still red-green TDD, just against a real system rather than a mock, which is the whole point of this tier.
10. `package.json`/`xtask` wiring into `check`/`test` — last, only after 1-9 are confirmed working standalone, since this is the "turn it on for everyone" step and its own verification step is measuring the runtime cost (see Verification).

## Design

### Rails side (`books-db-rails` — separate repo, separate commit)

- **`config/database.yml`**: new `tauri_integration:` block, `database: books_db_rails_tauri_integration` — isolated from both `development` and `test` (the latter is RSpec's own domain; a persistent server on that db risks colliding with `bundle exec rspec` runs).
- **`config/environments/tauri_integration.rb`**: copy of `test.rb` as a starting point.
- **`Gemfile:44`**: `group :development, :test do` → `group :development, :test, :tauri_integration do` (FactoryBot/Faker are currently gated to those two groups; confirmed via `Gemfile:44-62`).
- **`config/routes.rb`**: gated block, only mounted when `Rails.env.tauri_integration?` (works automatically — `Rails.env` is an `ActiveSupport::StringInquirer`, no special config needed for arbitrary `.foo?` predicates):
  ```ruby
  if Rails.env.tauri_integration?
    namespace :tauri_integration do
      post "factories/:name", to: "factories#create"
      get "users/:email/login_token", to: "factories#login_token"
    end
  end
  ```
- **`app/services/tauri_integration/factory_service.rb`** (new): the actual logic, env-independent and unit-tested via a normal RSpec spec written first (see Commit discipline above) — `create(name, attrs)` calls `FactoryBot.create(name.to_sym, **attrs)` (generic, reuses every factory in `spec/factories/`, today just `:user`, with zero new Rails code per future test scenario); `login_token_for(email)` looks up a user by email and returns `user.login_token.to_s` (the one thing that needs a real method call, not just attribute assignment — `app/models/user.rb:56`).
- **`app/controllers/tauri_integration/factories_controller.rb`** (new, namespaced): thin glue — `create`/`login_token` actions just call the service above and render its result as JSON. Double-checks `Rails.env.tauri_integration?` in a `before_action` (defense in depth beyond the route gate, since this is a real "create records" surface even though env-gated).
- **No explicit per-test teardown/reset endpoint**: `spec/factories/users.rb:20-21` already generates random `Faker::Internet.email`/name per call, so repeated runs create fresh rows rather than colliding — simplest thing that works. `bin/rails db:tauri_integration:prepare` (below) is a manual escape hatch if cruft ever becomes annoying, not something the harness automates.
- **`lib/tasks/tauri_integration.rake`** (new): a dedicated `db:tauri_integration:prepare` task, so callers never have to remember to set `RAILS_ENV` correctly themselves — it hardcodes its own target env, mirroring the exact pattern Rails' own `db:test:prepare` uses internally (and *why* that task is dangerous to reuse here: it hardcodes `test`, not whatever's ambient). Implemented as a thin, unmagical subprocess shell-out rather than reimplementing `ActiveRecord::Tasks::DatabaseTasks` internals:
  ```ruby
  namespace :db do
    namespace :tauri_integration do
      desc "Prepare the tauri_integration database, regardless of ambient RAILS_ENV"
      task :prepare do
        system({ "RAILS_ENV" => "tauri_integration" }, "bin/rails", "db:prepare", exception: true)
      end
    end
  end
  ```
  (Deliberately not depending on Rake's `:environment` task — this shells out rather than booting Rails in whatever the ambient env is first.)

### `books-db` side

- **`integration/global-setup.ts`** (Vitest `globalSetup`): **detect-or-boot**, not always-boot — poll `GET http://localhost:3099/up` (Rails' built-in health check) first; if already up (e.g. developer left `RAILS_ENV=tauri_integration bin/rails s -p 3099` running in a spare terminal for fast iteration), reuse it and don't touch it in teardown. Otherwise: `spawnSync('bin/rails', ['db:tauri_integration:prepare'], { cwd: <rails repo> })` (no `env` override needed — the task hardcodes its own target env) then `spawn('bin/rails', ['server', '-p', '3099'], { cwd: <rails repo>, env: { ...process.env, RAILS_ENV: 'tauri_integration' }, stdio: [null, process.stdout, process.stderr] })` (the server process itself still needs `RAILS_ENV` set, since unlike the rake task it isn't self-forcing) — same piping style as `beforeSession` in `e2e/wdio.conf.ts:210-213`. Poll `/up` again until healthy (manual loop, ~300ms interval, timeout ~20s — no `wait-on`-style package is installed, confirmed, small enough not to need one). Teardown: only kill what this run spawned, and **await** the kill (`tree-kill`'s callback form) before resolving — unlike `afterSession: () => kill(tauriDriver.pid)` in `wdio.conf.ts:299` (fire-and-forget), a lingering Puma process squatting on :3099 would break the *next* run.
- **`integration/rails-integration-client.ts`** (new): `createFactory<T>(name, attrs)` → `POST /tauri_integration/factories/:name`; `fetchLoginToken(email)` → `GET /tauri_integration/users/:email/login_token`. Thin `fetch` wrappers, real HTTP to `localhost:3099`.
- **`vitest.integration.config.ts`** (repo root, sibling to `vitest.config.js` — first second-config precedent in this repo): `environment: 'jsdom'`, `globalSetup: './integration/global-setup.ts'`, `setupFiles: ['./src-ui/testing/db-setup.ts']` (reuse the existing local-SQLite test harness — only the Rails leg needs to be real, so no MSW setup file here), `env: { VITE_API_BASE_URL: 'http://localhost:3099' }`, `include: ['./integration/**/*.integration.spec.ts']`.
- **`integration/auth-flow.integration.spec.ts`** (new): mirrors `auth-store.test.ts` conventions (mocked keychain via `setupMockKeyring()`, `createTestAuthStore` from `auth-store.svelte.ts`, `testDb` from `db-setup.ts`) but real `fetch`, no MSW. Two tests (contract smoke test, not exhaustive — that's the unit suite's job): happy path (`createFactory('user', {...})` → `authStore.requestLoginLink(email)` → `fetchLoginToken(email)` → `authStore.exchangeLoginToken(token)` → assert real user data lands in `authStore.state`); negative path (garbage login token against the real server → assert the real `token_invalid` message surfaces in `authStore.state.error`).
- **`package.json`**: add `"test:integration": "vitest run --config vitest.integration.config.ts"`. Wire it into the aggregate scripts per explicit instruction: `"check": "pnpm check:js && pnpm check:rust && pnpm test:integration"` and into `"test"` similarly. **Conscious tradeoff**: `pnpm check`/`pnpm test` will now hard-fail on any machine without Ruby/Postgres available — accepted for this solo project. Measure the actual runtime added; if it's large, the fallback (per instruction) is to back it back out to a separate opt-in script.
- **`xtask/src/main.rs`**: add a `"test:integration"` arm mirroring the existing `"gen:migration"` pattern (same `cmd!`-based dispatch structure already there), so this tier is reachable via `cargo xtask test:integration` too, consistent with how other cross-cutting dev tooling in this repo is exposed.

## Critical files

- `books-db-rails/config/database.yml`, `config/environments/tauri_integration.rb` (new), `Gemfile`, `config/routes.rb`, `app/services/tauri_integration/factory_service.rb` + its spec (new), `app/controllers/tauri_integration/factories_controller.rb` (new), `lib/tasks/tauri_integration.rake` (new) — separate repo/commit
- `books-db/integration/global-setup.ts`, `rails-integration-client.ts`, `auth-flow.integration.spec.ts` (all new)
- `books-db/vitest.integration.config.ts` (new)
- `books-db/package.json`, `books-db/xtask/src/main.rs`
- `books-db/design-ideas.md` — add the deferred real-browser-E2E tier as its own entry, noting it may reuse this same `tauri_integration` Rails environment rather than needing a new one

## Verification

- `bin/rails db:tauri_integration:prepare` succeeds against a real local Postgres *without* setting `RAILS_ENV` in the calling shell (proves it's self-forcing), and `psql -l` (or equivalent) confirms it created/targeted `books_db_rails_tauri_integration` specifically — not `books_db_rails_test` or whatever the ambient env was.
- `pnpm test:integration` run cold (nothing pre-running): spawns the server, health-checks, runs both tests green, tears down cleanly — confirm no orphaned process left on :3099 afterward (`lsof -i :3099`).
- Run it again immediately after: confirms idempotency (fresh Faker-generated data each time, no collision).
- Start `RAILS_ENV=tauri_integration bin/rails s -p 3099` manually in a spare terminal, then run `pnpm test:integration`: confirms detect-and-reuse works and that run's teardown does *not* kill the manually-started server.
- Time `pnpm check` and `pnpm test` before/after this change; if the added time is large, fall back to keeping `test:integration` as a separate, non-aggregated script (per the explicit fallback condition).
- `cargo xtask test:integration` runs the same thing successfully.
