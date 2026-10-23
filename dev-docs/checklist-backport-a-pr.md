A fix is a backport candidate only when the behavior worked in the previous stable minor (say, v1.8) and broke in the current one (v1.9). A bug in a feature that is new this cycle has no working baseline to regress from, even if that feature already shipped in v1.9.x patch releases: fix it on `main` only, with its changelog entry in the normal feature section rather than `## Regression fixes`.

We backport development PRs to the stable branch using the following steps:

- Identify the set of commits in the development branch that should be backported.
- Check out the stable branch (say, `v1.4`).
- If a backport branch for this work already exists from earlier, confirm it has every related fix that landed on `main` since, before cherry-picking the newest one: `git log --oneline` on it, and `git diff --stat <backport-branch> main -- <touched-paths>`. A branch that already carries a commit for this issue can still be missing an earlier fix.
- Cherry-pick the commits from the development branch:
  - `git cherry-pick <commit>` for every commit identified above.
  - Resolve conflicts as needed.
- Revert the changelog file changes if they were included in the original commits (the dev-branch `changelog-1.(x+1).md` does not exist on the stable branch, so the cherry-pick shows a modify/delete conflict — drop that hunk).
- Add the new changelog entries to `news/changelog-1.x.md`, under `# v1.(x+1) backports` > `## In this release` at the top of the file.
  There are change categories in the development release but not in the backport release, so just add them chronologically to the section.
  If that scaffold heading is missing, the stable branch was cut without it — seed it per the branch-creation step in `checklist-make-a-new-quarto-release.md` rather than filing the entry under the frozen `## Regression fixes` (that section is the previous version's own release fixes).
- Run the test suite GHA workflow on the stable branch manually.
- If the backport adds a regression test, check that `main` has the same coverage. `main` usually already has the fix, but not always a test for that exact failure; when it lacks one, cherry-pick the test commit onto a branch off `main` and open a companion PR that references the backport PR.
