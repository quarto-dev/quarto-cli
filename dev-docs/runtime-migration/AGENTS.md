# Agent instructions: runtime migration

These apply to any work in this directory or on a PR listed in README "The sequence": executing, reviewing or amending a plan.

Before you finish, bring these docs in line with what changed:

1. README "The sequence": set the PR's row to `in progress` when its execution starts, and to `merged` once the PR is merged (README "How to execute a plan").
2. `HANDOFF.md`: if it names the PR as the next one or as in progress, update it.
3. A finding that changes another plan's prerequisites (a new blocker, a command that no longer works, a defect in a plan's steps) becomes a row in README "Open decisions with an owner" that names the affected plan.
   Do not edit the affected plan itself: its step 0 picks the row up.
