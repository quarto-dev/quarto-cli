We backport development PRs to the stable branch using the following steps:

- Identify the set of commits in the development branch that should be backported.
- Check out the stable branch (say, `v1.4`).
- Cherry-pick the commits from the development branch:
  - `git cherry-pick <commit>` for every commit identified above.
  - Resolve conflicts as needed.
- Revert the changelog file changes if it was included in the original commits.
- Move the new changelog entries to the top of old changelog, under "New in this release".
  There are change categories in the development release but not in the backport release, so just add them chronologically to the section.
- Run the test suite GHA workflow on the stable branch manually.
