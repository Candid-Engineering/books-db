# Reset app data ("nuke button")

## Context

Extends the Settings page (built alongside CSV export/import) with a full data
wipe, for a friend playtesting the app who may want to start over cleanly —
modeled on a device's "reset to factory settings," not a soft in-app clear.
That means actually deleting the local SQLite database file, not just
truncating its tables, plus clearing anything auth-related stored outside
that file (the OS keychain in a production build).

### The restart constraint

Tauri's `sqlite-proxy` plugin (`src-tauri/src/plugins/sqlite_proxy/mod.rs`)
opens one `rusqlite::Connection` at app startup and holds it in Tauri-managed
state (`Mutex<Connection>`) for the entire process lifetime. Deleting the
underlying file out from under that live connection doesn't make the app
"empty" — on POSIX, an open file descriptor keeps working against the
unlinked file's data until it's closed, so the app would keep reading and
writing against a **deleted-but-still-live** copy of the old database. Only a
fresh process start creates a new, genuinely empty file (`connection_for()`
runs again on boot).

Two ways to get back to a clean state were considered:

- **Auto-relaunch** (`@tauri-apps/plugin-process`'s `relaunch()`) — a new
  Tauri plugin dependency, restarts the process for the user automatically.
- **Reopen the connection in place** (a new Rust command to close and
  recreate the `Mutex<Connection>` without a full process restart) — avoids
  a new plugin, but leaves every piece of already-loaded Svelte state
  (`BooksStore`, `authStore`, etc.) pointing at data that no longer exists
  underneath it, with no guarantee every reactive consumer notices and
  reloads correctly.

Decided against both: a full **manual restart** (user quits and reopens the
app themselves) sidesteps the in-place-reopen desync risk entirely and adds
no new plugin. The UX cost is one extra manual step for the user, accepted
as the right tradeoff for a wipe that only happens rarely and deliberately.

## Design

All new logic lives in `src-ui/routes/settings/+page.svelte`, alongside the
existing Export/Import handlers — no new Rust code, no new Tauri plugin.

```
handleReset():
  1. confirm() (plugin-dialog) — destructive, irreversible, must be explicit
  2. authStore.logout() — already clears the refresh + auth tokens (keychain
     in production, the dev-only SQLite table in dev) and the in-memory/
     local_user auth state. Nothing new to build here.
  3. delete the SQLite DB file (+ any -journal/-wal/-shm sidecar, checked
     with exists() first since rollback-journal mode — the app's default,
     no WAL pragma is set anywhere — only creates a -journal file transiently
     during a write) via @tauri-apps/plugin-fs's remove(), scoped with
     BaseDirectory.AppConfig to match the Rust side's app_config_dir().
  4. message() (plugin-dialog) — tell the user the reset is done and they
     need to quit and reopen the app.
```

Filename: hardcoded as `'books-dev.db'`, matching the literal string
`main.rs` passes to `plugins::sqlite_proxy::init(...)` today (there's a
pre-existing TODO there about varying it per environment — out of scope
here, but this constant needs to be kept in sync with that string until that
TODO is resolved).

Errors during deletion are reported the same way Export/Import already do:
`reportError()` + `errorToast.show()`, not a silent failure.

### Not built in this pass

- Auto-relaunch — explicitly rejected above.
- Any change to how/when the DB filename is chosen — pre-existing TODO,
  unrelated to this feature.

## Commit discipline & TDD

One commit. Not unit-tested, matching this repo's existing convention for
`.svelte` files (the Export/Import handlers already in this file aren't
unit-tested either) — verified manually instead, since the logic here is
almost entirely orchestration over Tauri plugin calls (`confirm`, `logout`,
`remove`, `message`) rather than pure business logic. `authStore.logout()`
itself is already covered by `auth-store.test.ts`.

## Critical files

- `src-ui/routes/settings/+page.svelte`

## Verification

Manual, in `pnpm tauri dev`:
- Add a book, click Reset, cancel at the confirmation — confirm nothing
  changed.
- Click Reset, confirm — see the "quit and reopen" message, quit and
  reopen the app, confirm the catalog is empty and the app is signed out.
- Sign in again, confirm login still works cleanly after a reset (nothing
  left over in the keychain/dev token table causes a stale-state bug).
