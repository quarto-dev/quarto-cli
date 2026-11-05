---
name: make-release
disable-model-invocation: true
description: Drive a Quarto release end-to-end from the dev-docs release checklists. Handles three release types — a routine dev prerelease off main, the first stable release of a new major.minor cycle, or a patch release on an existing stable branch — by asking which one applies (or reading it from an unambiguous request), then follows the matching checklist, verifying real git/gh state at each step and pausing for explicit human confirmation before every irreversible or externally-visible action.
---

# Make Release

Command-only helper that follows an existing release checklist. This skill does not restate the release steps; the checklists below are the source of truth. Read the applicable checklist, verify the current state, and request confirmation at the required points.

## 1. Determine which checklist applies

There are three release types, each with its own checklist. Branch-existence alone doesn't distinguish all three — a routine prerelease and a first-stable-of-cycle release can both start with no `v1.x` branch yet — so first establish intent, then verify with git where that disambiguates:

- **Routine dev prerelease off `main`** (no version bump beyond the prerelease counter, no new branch) → drive
  `dev-docs/checklist-make-a-new-quarto-prerelease.md`
- **First stable release of a new major.minor cycle** (cuts a new `v1.x` branch) → drive
  `dev-docs/checklist-make-a-new-quarto-release.md`
- **Patch release on an already-cut stable branch** (e.g. another `v1.9.x`) → drive
  `dev-docs/checklist-make-a-new-stable-quarto-release.md`

If the user's request doesn't make the type unambiguous, ask. For a stable release, use the
repository state to determine whether it is the first release in the cycle or a patch release:

```bash
git ls-remote --heads https://github.com/quarto-dev/quarto-cli.git v1.x   # substitute the target major.minor, e.g. v1.10
```

Query quarto-dev directly: in a contributor's clone `origin` is often their fork, where the branch may be missing.

An absent branch indicates the first stable release of the cycle. An existing branch indicates
a patch release.

Backporting an individual merged PR to a stable branch is outside this skill's scope. Follow
`dev-docs/checklist-backport-a-pr.md` directly instead.

**Always confirm the selected checklist before starting**, even when the release type appears
obvious. State it plainly, e.g. "I will follow this checklist:
`dev-docs/checklist-make-a-new-quarto-release.md`", and wait for the user's confirmation.

## 2. Drive the checklist top to bottom, verifying real state, narrating as you go

Read the matching checklist and follow it in order. Before each step, state in one line what
you are about to do and why. Pause for the user only at the gates in section 3; narrate the
other steps and continue.

For the first stable release, `references/first-stable-commands.md` has the exact verification
commands for each checklist section. Use them rather than composing your own.

At each step, use `git` or `gh` to verify that the expected action occurred. For example,
confirm that a branch or tag exists, a workflow run succeeded (`gh run view <id>`), a release
has the expected flags, or a version field has the expected value. A step is complete only
after this verification. When a check fails, stop at that step and report: do not continue on
the assumption that it will resolve.

Working conventions:

- **Worktrees.** Make every edit in a fresh worktree on the remote branch (the checklist names
  which ones). Never edit or switch a clone that has another branch checked out.
- **SHAs by subject.** Capture commit SHAs with `git log --fixed-strings --grep='<subject>'`,
  not by position, and re-capture after any rebase or added commit.
- **CI by commit or run ID.** Query `gh run list --commit <sha>` or `gh run view <id>`, never a
  recent-runs window: a nightly run can fall outside it. Read a failed run's log before calling
  it a blocker or a flake.
- **Waiting.** Start `gh run watch <id> --exit-status` in the background and act on its
  notification. Do not poll.

## 3. Hard-confirm gates (stop and get explicit human OK before running)

Do not perform these actions without confirmation. Every step the checklist marks **GATE** is
one, as is anything in this list:

- Pushing the new stable branch (`git push upstream v1.x`)
- Pushing version-bump / release-checklist commits to `main` or a stable `v1.x` branch
- Any `workflow_dispatch` carrying a publish flag (e.g. `publish-release=true`, chocolatey publish checkbox, Cloudsmith `dry-run=false`)
- Editing a live GitHub release's flags (pre-release / "Set as latest release")
- Pushing the release tag
- Production package-registry publishes: pypi (`publish-release=true`), chocolatey, Cloudsmith manual publish

- Removing worktrees or branches at clean-up (show the dry run first)

Present each gate as one block, one approval per gate:

- **Precondition**: what must already be true, and the check that showed it.
- **Affects**: who reads the state you are about to change (other repositories' workflows,
  quarto.org, package registries), and what they do with it.
- **Command**: the exact command.
- **Verify**: the exact check you will run after it.
- **Stop if**: the result that means stop and report.

If the user approves a gate before its precondition holds, run it only once the precondition
check passes, then report.

Dry-runs and read-only verification don't need a gate — run them freely.

## 4. Cross-repo flow

The release flow spans up to four repositories, with real ordering dependencies:

- `quarto-dev/quarto-cli` — the release build and tag
- `quarto-dev/quarto-web` — quarto.org site, downloads, highlights, announcement
- `quarto-dev/quarto-cli-pypi` — pypi publish
- `quarto-dev/quarto-release-bundles` — Chocolatey package build and publish

Ordering matters: e.g. quarto-cli's release build must fully publish before quarto-web's `update-downloads.yml` will pick it up, and Chocolatey waits for the quarto.org download page to update. State which repo each step targets. Use `gh --repo <owner>/<name> ...` so verification works even without a local clone of every repo.

**No local quarto-web clone:** if a step needs local content edits to quarto-web (e.g. the `docs/prerelease/<version>/` highlights `.qmd` files, or `_quarto.yml` edits) and no local quarto-web clone is present, stop and ask the user for the clone path or to make the edit themselves. Do not attempt the edit through the GitHub API and do not silently skip the step.

**Release announcement:** the matching checklist step already documents where and how it's published. Follow that step rather than restating the mechanism yourself.

## 5. When the checklist doesn't match reality

If the state described by a step does not match the current state (for example, a stale path,
incorrect ordering, completed step, or renamed workflow), report the discrepancy and ask the
user how to proceed. Do not work around it silently or edit the checklist during the release;
suggest a follow-up documentation PR instead.

## 6. Non-blocking gaps found along the way

If you spot a non-blocking gap during the release (e.g. a CI automation that only covers one branch, a doc-archival gap), don't try to fix it inline. Tell the user to track it in whatever task tracker they/their project use, and continue the release.

## 7. Windows and tool pitfalls

- Git Bash rewrites arguments that start with `/` and `<ref>:<path>` arguments such as
  `upstream/main:_quarto.yml`. Prefix such commands with `MSYS_NO_PATHCONV=1`.
- A GPG passphrase prompt that times out stops a commit or a rebase midway. Ask the user to
  unlock the key, check `git status`, then retry.
- Run R (`_tools/release-notes.R`) from PowerShell where Git Bash lacks R on `PATH`.

## 8. Model and effort

The checklist and the reference commands are written so that a mid-size model at medium effort
can drive the release, with the user approving each gate. Skill frontmatter cannot set this:
it applies to the invoking turn only, so choose the session model when you start the session.
