We backport development PRs to the stable branch using the following steps:

- Identify the set of commits in the development branch that should be backported.
- Check out the stable branch (say, `v1.4`).
- Cherry-pick the commits from the development branch:
  - `git cherry-pick <commit>` for every commit identified above.
  - Resolve conflicts as needed.
- Revert the changelog file changes if they were included in the original commits (the dev-branch `changelog-1.(x+1).md` does not exist on the stable branch, so the cherry-pick shows a modify/delete conflict — drop that hunk).
- Add the new changelog entries to `news/changelog-1.x.md`, under `# v1.(x+1) backports` > `## In this release` at the top of the file.
  There are change categories in the development release but not in the backport release, so just add them chronologically to the section.
  If that scaffold heading is missing, the stable branch was cut without it — seed it per the branch-creation step in `checklist-make-a-new-quarto-release.md` rather than filing the entry under the frozen `## Regression fixes` (that section is the previous version's own release fixes).
- Run the test suite GHA workflow on the stable branch manually.
