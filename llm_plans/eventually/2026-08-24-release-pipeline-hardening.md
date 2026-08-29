# Release pipeline hardening: hard to fake, hard to tamper with

_Point-in-time plan, filed 2026-08-24. Explicitly planning-only per user
request — nothing here has been built. Scoped against
`.github/workflows/release.yml` as it exists after
`../2026-08-24-auto-update-github-releases.md` landed._

## Why this matters more than a typical CI hardening pass

Auto-update changes the blast radius of this specific workflow. Before it
existed, a compromised release process meant a bad build sitting in
Releases until someone noticed. Now, every playtester's app checks in and
installs whatever this workflow produces, automatically, on its own
schedule. Compromising this one YAML file (or the account of anyone who can
push a tag matching it) is a path to silently pushing arbitrary code to
every tester's machine. The three items below each close a different way
that could happen.

## 1. Pin third-party actions to a commit SHA, not a mutable tag

`release.yml` currently references `actions/checkout@v4`,
`pnpm/action-setup@v4`, `actions-rust-lang/setup-rust-toolchain@v1`,
`actions/setup-node@v4`, and `tauri-apps/tauri-action@v1`. A version tag
like `@v1` is a mutable pointer — its maintainer (or anyone who compromises
their account/repo) can repoint it to different code at any time, and nothing
in *this* repo changes to reflect that; the next run just silently executes
whatever the tag now points to.

Fix: resolve each tag to its current commit SHA and pin to that instead,
with the human-readable version kept as a trailing comment (GitHub's own
documented pattern for this):

```yaml
- uses: actions/checkout@<full 40-char sha>  # v4.x.x
- uses: tauri-apps/tauri-action@<full 40-char sha>  # v1.x.x
```

Resolve each SHA at implementation time (`gh api repos/<owner>/<repo>/git/refs/tags/<tag>`
or the repo's Releases page) — don't reuse SHAs recorded in this doc, they'll
be stale by the time this is built. This needs to be deliberately
re-reviewed periodically (a bot like Dependabot/Renovate can automate
bumping pinned SHAs with a PR, rather than this silently drifting out of
date forever) — worth deciding on that mechanism at implementation time
rather than pinning once and never revisiting.

## 2. Tag protection rule on `app-v*`

Today anyone with push access to the repo can push a tag matching `app-v*`
(the release trigger) or manually fire `workflow_dispatch`. Neither is
currently restricted to people who should be cutting releases.

Fix: GitHub repo Settings → Tags → "New rule", pattern `app-v*`, restricted
to repo admins (or a specific allowlist). This doesn't touch the workflow
YAML at all — it's a repo-level setting that rejects the tag push itself
before any workflow run is even triggered.

## 3. Environment-gated secrets with a required reviewer

Right now `TAURI_SIGNING_PRIVATE_KEY` (and, later, the `APPLE_*` secrets
from `2026-08-24-apple-code-signing.md`) are plain repo secrets, available
to any run of any workflow with access to them the moment it starts — a
release triggered by a stolen token, or a workflow file modified via a
malicious PR from a compromised collaborator account, gets the secrets
immediately, no human in the loop.

Fix: move those secrets onto a GitHub Environment (e.g. named `release`)
with required reviewers set to the maintainer(s), and scope the release
job to that environment:

```yaml
jobs:
  release:
    environment: release
    ...
```

A run still starts and does its non-secret work (checkout, install, build
up to the signing step), but pauses for manual approval before the
environment's secrets become available to it — an extra, deliberate human
checkpoint between "something triggered a release" and "signing keys got
used."

## 4. Build provenance attestation

Even with 1-3, `TAURI_SIGNING_PRIVATE_KEY` signs *artifact integrity*
("this file wasn't corrupted/tampered with in transit") but says nothing
about *provenance* ("this file was actually built by this exact CI run from
this exact source commit," as opposed to signed locally by anyone who has
the key and uploaded some other content). GitHub's build provenance
attestation (SLSA-style) closes that gap:

```yaml
- uses: actions/attest-build-provenance@<sha>  # pin per item 1
  with:
    subject-path: 'src-tauri/target/**/release/bundle/dmg/*.dmg'
```

Produces a cryptographically verifiable, GitHub-hosted attestation tying
the artifact to the specific workflow run, commit, and repo. Verifiable
later (by the maintainer, or in principle by a curious tester) with:

```bash
gh attestation verify <path-to-dmg> -R Candid-Engineering/books-db
```

This is additive on top of 1-3, not a replacement for any of them — it
proves *what built the artifact*, not *who was allowed to trigger the
build* (that's tag protection) or *what code the build ran* (that's SHA
pinning).

## Sequencing note

1 and 2 are cheap, mechanical, and worth doing together whenever this gets
picked up. 3 adds real friction to every release (a manual approval click)
— worth it once there's an established release cadence, probably premature
while still cutting the very first few beta builds. 4 is independent of the
other three and can land whenever; it's the one most worth deferring until
there's an actual reason to prove provenance to someone (e.g. a tester
asking "how do I know this .dmg is really yours").
