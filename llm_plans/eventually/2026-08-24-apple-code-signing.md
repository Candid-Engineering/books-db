# Apple Developer ID signing + notarization for release builds

_Point-in-time note, filed 2026-08-24. Not an implementation-ready plan — no
commit steps, nothing scoped. Captures a deliberate deferral made when
building `.github/workflows/release.yml` (see
`../2026-08-24-auto-update-github-releases.md`), so the reasoning and the
trigger for revisiting it aren't lost._

## What's deferred

Release builds are currently ad-hoc signed only — Tauri's automatic
fallback when no `signingIdentity`/`APPLE_*` env vars are configured, just
enough for the binary to run at all on Apple Silicon. Not a real Developer
ID signature, and not notarized by Apple.

## Why that's a real (if currently acceptable) cost

Gatekeeper's "unidentified developer" warning isn't a one-time thing an
ad-hoc-signed app gets past after the first launch — it's a check against
the binary's actual signature, so it fires on **every** install, including
every auto-installed update from `tauri-plugin-updater`. Right now that
means: every playtester, every single release, right-clicks → Open (or digs
into Privacy & Security settings) forever. Tolerable for 2-5 people who've
been told to expect it; not tolerable if the tester pool grows past people
willing to do that repeatedly, or if this ever ships to someone who wasn't
walked through it directly.

## What doing it for real needs

- An Apple Developer Program membership ($99/yr), enrolled and verified.
- A "Developer ID Application" certificate (not "Apple Distribution" — that
  one's for App Store/TestFlight, which this project already decided
  against). Exported as `.p12`, base64-encoded.
- An app-specific password for notarization (Apple ID + password + Team
  ID route), or an App Store Connect API key as the alternative auth
  method.
- Six new GitHub Actions secrets on `.github/workflows/release.yml`:
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.

That's the entire change. The release workflow, the updater config, and the
Tauri update-artifact signing keypair are already structured to not need
anything else touched — this is additive, not a redesign.

## When to revisit

Whichever comes first: the tester group grows beyond people who'll tolerate
the recurring Gatekeeper click, or the Apple Developer Program enrollment
happens for an unrelated reason (e.g. wanting an iOS build) and the
marginal cost of wiring this up drops to near zero.
