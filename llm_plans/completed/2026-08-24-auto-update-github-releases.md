# Auto-updating beta builds via GitHub Releases

## Context

Distribution plan for a 2-5 person playtest group. TestFlight was considered
and rejected: it requires an Apple Developer Program enrollment, submission
through App Store Connect, and — the real cost — building under Apple's App
Sandbox, a restrictive entitlements model this app was never designed
against (rusqlite's bundled SQLite file, arbitrary-path CSV writes via the
file dialog, keyring access). None of that is worth retrofitting for a
handful of testers.

Instead: Tauri's own updater plugin (`tauri-plugin-updater`), pointed at a
public GitHub Release's `latest.json` asset as a zero-infrastructure update
manifest. No server to run or maintain — GitHub Releases hosts both the
manifest and the downloadable app bundles. Confirmed the repo
(`Candid-Engineering/books-db`) is already public, so both the manifest and
the release assets are fetchable with no auth, from the app and from a
tester's browser for a first-time manual install.

**Apple code signing/notarization is explicitly deferred** (decided when
this plan was approved): builds ship ad-hoc-signed (Tauri's default when no
`signingIdentity`/`APPLE_*` env vars are configured — required just for an
executable to run at all on Apple Silicon, but not the same as a real
Developer ID signature). This means every install — the first one and every
subsequent auto-update — trips Gatekeeper's "unidentified developer"
warning, requiring the tester to right-click → Open (or Privacy & Security →
"Open Anyway") once per version. That friction is accepted for now in
exchange for shipping immediately; real signing (Apple Developer Program
membership, a Developer ID Application certificate, notarization) is a
clean, additive follow-up later — it only means adding `APPLE_*` secrets to
the release workflow already built here, no structural change.

Two signing mechanisms exist here and are easy to conflate — worth being
explicit:
- **Apple code signing/notarization** — Gatekeeper's trust check. Skipped
  in this pass, per above.
- **Tauri's own update-artifact signing** (`tauri signer generate`, an
  Ed25519 keypair) — the updater plugin's own integrity check, unrelated to
  Apple. **Not optional** — every update artifact must be signed with this
  keypair or the updater plugin refuses to install it. Built in this pass.

### Why `relaunch()` here doesn't repeat the reset-app-data decision

The reset-app-data plan explicitly rejected reopening the SQLite connection
in-place, because it would leave already-loaded Svelte state (`BooksStore`,
`authStore`, etc.) pointing at data that changed underneath it with no
guarantee every reactive consumer noticed. An update install is a different
shape of problem: it replaces the entire binary and restarts the whole
process from scratch — there is no "old in-memory state" to desync, since
literally everything (Rust state, the Svelte app, the webview) restarts
together. This is the same clean state a human quitting and reopening the
app gets manually; `relaunch()` just automates that same action, not an
in-place patch.

## Design

### Rust / Tauri config

- Add `tauri-plugin-updater` and `tauri-plugin-process` to
  `src-tauri/Cargo.toml`; `.plugin(tauri_plugin_updater::Builder::new().build())`
  and `.plugin(tauri_plugin_process::init())` in `main.rs`, alongside the
  existing plugin registrations.
- `tauri.conf.json`:
  ```json
  "bundle": { "createUpdaterArtifacts": true, ... },
  "plugins": {
    "fs": {},
    "updater": {
      "pubkey": "<public half of the generated keypair>",
      "endpoints": [
        "https://github.com/Candid-Engineering/books-db/releases/latest/download/latest.json"
      ]
    }
  }
  ```
- Capabilities: add `updater:default` (grants `allow-check`/`download`/
  `install`/`download-and-install`) and whatever the process plugin's
  relaunch permission is actually called — verify by reading the fetched
  crate's `permissions/*.toml` once it's a real dependency, same as every
  other capability string added this project (`keyring:default`,
  `dialog:default`, `fs:allow-*`) was nailed down empirically rather than
  guessed.
- Generate the Tauri signing keypair locally (`pnpm tauri signer generate`).
  The public key is not secret — goes straight into `tauri.conf.json`,
  committed. The private key is secret — added as a GitHub Actions repo
  secret (`TAURI_SIGNING_PRIVATE_KEY`, plus
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if one is set), never committed. No
  Rust unit tests here — this is plugin registration and config, the same
  category as adding `tauri-plugin-dialog` for CSV, which also had none.

### Frontend

- On app boot (alongside the existing `authStore.initialize()` /
  `syncEngine.sync()` wiring in `hooks.client.ts`): `check()` from
  `@tauri-apps/plugin-updater`. If an update is available, `ask()`
  (plugin-dialog) "Version X is available — install now?"; on confirm,
  `update.downloadAndInstall()` then `relaunch()`
  (`@tauri-apps/plugin-process`). Not unit-tested, matching this file's
  existing convention (`authStore.initialize()` wiring already isn't
  tested either) — verified manually.
- A "Check for Updates" button on the Settings page, next to the existing
  Export/Import/Reset buttons, running the same `check()` → `ask()` →
  `downloadAndInstall()` → `relaunch()` flow on demand. Reuses
  `reportError()`/`errorToast.show()` on failure, matching every other
  Settings action already there.
- No periodic re-check while the app stays open (only on boot + manual) —
  right-sized for a 2-5 person beta; a `setInterval`-based periodic check
  (mirroring the sync engine's existing pattern) is a reasonable future
  addition, not built now.

### Release workflow (new: `.github/workflows/release.yml`)

- Triggers: push of a tag matching `app-v*`, plus `workflow_dispatch` for a
  manual re-run. Cutting a release = bump `"version"` in
  `src-tauri/tauri.conf.json` (the single source of truth `tauri-action`
  reads for the tag/version), commit, `git tag app-v0.2.0 && git push origin app-v0.2.0`.
- `tauri-apps/tauri-action` (pin to its current major version tag — verify
  at implementation time rather than guessing a possibly-stale one), matrix
  over `aarch64-apple-darwin` and `x86_64-apple-darwin` so both Apple
  Silicon and Intel testers are covered without knowing each tester's
  hardware ahead of time.
- `with: releaseDraft: true` — new releases land as GitHub drafts, reviewed
  and published by hand rather than going live to testers' auto-updaters
  the instant CI finishes. `includeUpdaterJson: true` (generates and
  attaches `latest.json`, keyed by this run's `createUpdaterArtifacts`
  output) — this is what makes the GitHub-Releases-as-update-server
  approach work with zero extra infrastructure.
- Env: `GITHUB_TOKEN` (automatic, for release creation) and
  `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (the
  Tauri updater keypair's secret half). No `APPLE_*` secrets in this pass —
  deferred with Apple signing, per Context above. Adding real signing later
  is just adding those env vars to this same job, no other changes.

### Tester-facing distribution

- First install: point testers at the repo's public Releases page directly
  (`https://github.com/Candid-Engineering/books-db/releases`) to download
  the `.dmg` for their Mac's architecture. Since builds are unsigned, note
  for them explicitly (in the release body, and told directly the first
  time): right-click the app → Open (or System Settings → Privacy &
  Security → "Open Anyway") once, past Gatekeeper's warning. This applies
  to every subsequent version too, including auto-installed updates — not
  just the first install — since it's the binary's signature status, not
  a one-time download flag, that Gatekeeper is objecting to.
- After that: fully automatic. The app checks on boot, prompts, and
  installs — no re-visiting GitHub Releases for future versions (aside
  from the recurring Gatekeeper click).

### Not built in this pass

- Apple Developer ID signing/notarization — deferred by explicit choice;
  additive later (see Context).
- Periodic in-session update checks (boot + manual only).
- Windows/Linux release targets — this app's only real users right now are
  on macOS.
- A CI job that also runs the existing JS/Rust checks before releasing —
  worth considering once this is proven out, not required for a first pass
  aimed at 2-5 people who already expect a rougher edge.

## Commit discipline & TDD

No new pure business logic here — this is plugin registration, config, CI
YAML, and Tauri-plugin-orchestration code, the same category as the CSV
Settings-page wiring and the reset-app-data button (neither of which had
unit tests, both verified manually). Small commits, in this order:

1. `tauri-plugin-updater`/`tauri-plugin-process` deps + `main.rs` wiring +
   capabilities (verified capability strings, not guessed).
2. Generate the Tauri signing keypair; commit the public key into
   `tauri.conf.json`; hand the private key to the user to add as a GitHub
   secret (not committed, not handled by me directly — it's credential
   material the user should control the custody of).
3. Boot-time update check + Settings page "Check for Updates" button.
4. `.github/workflows/release.yml`.

## Critical files

- `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`,
  `src-tauri/capabilities/main.json`, `src-tauri/tauri.conf.json`
- `src-ui/hooks.client.ts`
- `src-ui/routes/settings/+page.svelte`
- `.github/workflows/release.yml` (new)

## Verification

- `pnpm check:js` / `cargo test` green after steps 1-3 (no new logic to
  test, but nothing should break).
- Manual: cut a real `app-v0.1.1`-style tag, confirm the workflow builds,
  signs (ad-hoc), and produces a draft release with `latest.json` and both
  `.dmg` architectures attached. Publish the draft. Install it on a Mac
  from the Releases page (right-click → Open past Gatekeeper), confirm it
  runs. Cut a second tag, confirm the already-installed app detects it on
  next boot (or via "Check for Updates"), prompts, downloads, installs, and
  relaunches into the new version cleanly.
