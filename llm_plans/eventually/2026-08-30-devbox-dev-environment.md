# Reproducible dev environment with devbox (or Nix / dev containers)

_Point-in-time note, filed 2026-08-30. Not implementation-ready — no scoped
steps. Captures an option raised while fixing a Node-version-manager snag
(`.node-version` "26" not resolving under nodenv), so the reasoning survives._

## The problem it would solve

Setting this project up from scratch currently means installing, by hand and
in the right versions: Node (26.x) + pnpm, a Rust toolchain (for `src-tauri/`
and `xtask/`), a C compiler and system libs (`rusqlite` is `bundled`; on Linux
also webkit/gtk for Tauri), and on the Rails side Ruby + PostgreSQL + libpq.
The integration tests boot a real Postgres and a real Rails server. "Works on
my machine" failures in this session alone: `better-sqlite3` won't compile on
Node 26, `@inquirer/confirm` needs Node ≥ 22, nodenv won't fuzzy-match a
version.

## What devbox is

A CLI wrapper over Nix. A `devbox.json` lists packages (from nixpkgs, pinned
via `devbox.lock`); `devbox shell` drops you into a shell with exactly those
on PATH, isolated from the system. Same lockfile → same environment on any
machine. Not container isolation like Docker — it's dependency isolation via
the Nix store + PATH composition — but the "one command, everything's here"
experience is similar. `devbox services` can also run Postgres/Redis for the
integration tests. `devbox generate direnv` auto-activates on `cd`.

## Shape if adopted

- `devbox.json` at the repo root pinning: nodejs 26.x, pnpm, rustup/cargo,
  the C toolchain + openssl/libpq, ruby, postgresql. Possibly a second one in
  `books-db-rails`, or one covering both if they move into a monorepo.
- `devbox.lock` committed.
- `.node-version` / `.ruby-version` can stay (devbox can read them) or be
  replaced by the devbox pins.
- CI could use `jetify-com/devbox-install-action` instead of per-tool setup
  steps.
- `devbox services up -b` before `pnpm test:integration` instead of the
  current bespoke Rails-boot in `integration/global-setup.ts`.

## Downsides / why deferred

- Nix is the engine. Smooth ~90% of the time; when it breaks, you're
  debugging Nix, which is opaque. devbox hides most of it, but the
  abstraction leaks.
- macOS: the `/nix` volume and OS-update breakage have historically been
  rough. Better by 2026 but not zero-friction.
- Disk: the Nix store is large and keeps every version; needs periodic
  `nix-collect-garbage`.
- First run downloads the world (cached after).
- Whole-team buy-in required; `devbox.json` is devbox-flavored (ejectable to
  a raw flake, but still).
- For *just* "pin the Node version," this is a sledgehammer — see the
  near-term options in the version-manager discussion.

## Alternatives in the same tier

- **flox** — also Nix-based, more polished packaging UX, optional hosted
  sharing.
- **Nix flakes directly** — max control, you write the flake, steeper.
- **Dev Containers / Docker** — non-Nix answer to the same goal; universally
  understood, heavier runtime, VM-ish on macOS.

## Trigger to revisit

When onboarding a new contributor takes more than `<manager> install` +
`pnpm install` + `bundle install`, or when a "works on my machine" native-build
failure costs real time again.
