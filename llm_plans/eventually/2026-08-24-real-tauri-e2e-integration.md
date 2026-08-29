# Fix the real e2e harness (the only path to a true JS<->Rust integration test)

_Point-in-time note, filed 2026-08-24. Not implementation-ready. Written
after confirming, by reading `tauri::test`'s `MockRuntime` source directly,
that there is no way to run real JS against a real Tauri backend without an
actual webview - `MockRuntime`'s `Webview` is a zero-field stub and its
`eval_script` only records the script string, never executes it. No JS ever
runs there. A real webview (a real JS engine) is unavoidable for a genuine
integration test._

## Why this is the only real option

Everything short of a real webview is either two separate tests sharing a
manually-maintained assumption about the wire format between them, or (what
was actually built alongside this note - see `src-ui/tauri-plugin-versions.test.ts`)
a mechanical version-lockstep check that catches this specific drift without
proving anything about actual behavior. Only a real webview proves the
actual installed JS package and the actual compiled Rust plugin agree, end
to end.

## Current state: broken, not just unbuilt

`e2e/test.e2e.ts` (WebdriverIO + `tauri-driver`) already exists and is the
right shape, but doesn't work here:
- `tauri-driver` isn't installed (`which tauri-driver` -> not found).
- `e2e/wdio.conf.ts` hardcodes `application: './src-tauri/target/release/books-db.exe'`
  - Windows-only, already flagged as a TODO in that file.
- Not part of `pnpm check`, only the full `test` script.
- Only asserts the `<h1>` text renders - wouldn't have failed even if run,
  since this session's regression didn't block rendering (caught by the
  `window.unhandledrejection` listener, shown as a toast instead).

## What fixing it for real needs

1. `cargo install tauri-driver`.
2. Make the binary path in `wdio.conf.ts` platform-aware (`books-db` vs
   `books-db.exe`), and build the release binary first (`onPrepare` already
   runs `pnpm build` - needs the Rust release build too, or point at
   `target/debug` instead).
3. Extend `test.e2e.ts` (or add a sibling spec) to fail on any console error
   or unhandled rejection during boot, not just check that the header text
   renders - that's what would actually have caught this session's bug.
4. Decide whether to add `e2e:test` to `pnpm check` (slower, but it's the
   only tier that would have caught this) or keep it a separate, less
   frequently run tier - and whether it can run in CI at all (needs a real
   display session; GitHub Actions macOS runners have one, a headless Linux
   box would need Xvfb-equivalent for the Linux target).

## Deliberately not scoped further here

Exact wdio spec structure, how many scenarios beyond boot-time errors are
worth driving through a real webview vs. covering some other way test,
and CI wiring are all left for whoever picks this up.
