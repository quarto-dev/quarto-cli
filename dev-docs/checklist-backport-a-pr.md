A fix is a backport candidate only when the behavior worked in the previous stable minor (say, v1.8) and broke in the current one (v1.9). A bug in a feature that is new this cycle has no working baseline to regress from, even if that feature already shipped in v1.9.x patch releases: fix it on `main` only, with its changelog entry in the normal feature section rather than `## Regression fixes`.

We backport development PRs to the stable branch using the following steps:

- Identify the set of commits in the development branch that should be backported.
- Check out the stable branch (say, `v1.4`).
- If a backport branch for this work already exists from earlier, confirm it has every related fix that landed on `main` since, before cherry-picking the newest one: `git log --oneline` on it, and `git diff --stat <backport-branch> main -- <touched-paths>`. A branch that already carries a commit for this issue can still be missing an earlier fix.
- Cherry-pick the commits from the development branch:
  - `git cherry-pick <commit>` for every commit identified above.
  - Resolve conflicts as needed.
- If the stable branch predates the runtime-layer codemods (v1.10 and earlier: `src/deno_ral/fs.ts` there has no `readTextFileSync`) and a commit touches TypeScript, cherry-picking conflicts wherever its context lines were codemodded. Build the patch in the stable branch's `Deno.*` form instead, from the `main` checkout:

  ```bash
  c=<commit>
  w=$(mktemp -d)/bp
  git worktree add --detach "$w" "$c^"
  rev() {
    for f in $(git diff --name-only --diff-filter=$1 "$c^" "$c" -- '*.ts'); do
      quarto run --dev tools/codemod-deno-ral.ts --reverse --rules fs,temp,env,process,platform \
        --ral-dir "$w/src/deno_ral" --file "$w/$f"
    done
  }
  rev M && git -C "$w" commit -qam "reversed base" --allow-empty
  git -C "$w" checkout "$c" -- $(git diff --name-only --diff-filter=AM "$c^" "$c")
  for f in $(git diff --name-only --diff-filter=D "$c^" "$c"); do git -C "$w" rm -q "$f"; done
  rev AM
  git -C "$w" add -A && git -C "$w" diff --cached HEAD > "$w.patch"
  git worktree remove --force "$w"
  ```

  Then, on the stable branch: `git apply -3 "$w.patch" && git commit -C "$c"`. The tool prints `left:` for any layer name it cannot express (for example `args` used without a call) and never rewrites `deno_ral/errors.ts` predicates: grep the patch for `deno_ral/errors.ts` and `isNotFound(` and turn them into `instanceof Deno.errors.X` by hand. The tool reports `canonicalPathSync` as `left` (stable branches patch `Deno.realPathSync`): import `originalRealPathSync` from `deno_ral/original-real-path.ts` there.

- Revert the changelog file changes if they were included in the original commits (the dev-branch `changelog-1.(x+1).md` does not exist on the stable branch, so the cherry-pick shows a modify/delete conflict — drop that hunk).
- Add the new changelog entries to `news/changelog-1.x.md`, under `# v1.(x+1) backports` > `## In this release` at the top of the file.
  There are change categories in the development release but not in the backport release, so just add them chronologically to the section.
  If that scaffold heading is missing, the stable branch was cut without it — seed it per the branch-creation step in `checklist-make-a-new-quarto-release.md` rather than filing the entry under the frozen `## Regression fixes` (that section is the previous version's own release fixes).
- Run the test suite GHA workflow on the stable branch manually.
- If the backport adds a regression test, check that `main` has the same coverage. `main` usually already has the fix, but not always a test for that exact failure; when it lacks one, cherry-pick the test commit onto a branch off `main` and open a companion PR that references the backport PR.
