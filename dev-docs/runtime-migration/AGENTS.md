# Agent instructions: runtime migration

These apply to any work in this directory or on a PR listed in README "The sequence": executing, reviewing or amending a plan.

Execute at most one plan task per session.
Tick its checkboxes, fold its execution-log updates into the task commit (a task with no commit step still commits the plan file), run the post-commit review, and stop at that task boundary.
Keep any file a later task reads (a baseline, captured output) somewhere that survives the session, not `/tmp`, and record its path in the execution log.
Later tasks read it from that logged path, even if their commands name another one.
A fresh session resumes with the continuation prompt in README "How to execute a plan".
A maintainer-only step (a push, `gh workflow run`, `gh pr create`) is a handoff: the maintainer runs it, and execution resumes at the first unticked step.
After the last executor step, the coordinator's wrap-up session runs the plan's Verification, its review checklist and the whole-branch checks of "How to execute a plan", lists the checks that need the open PR as pending in the PR description, then hands the branch to the maintainer.
A PR opened before the wrap-up stays a draft until the wrap-up has run.

Before you finish, bring these docs in line with what changed:

1. README "The sequence": set the PR's row to `in progress` when its execution starts, and to `merged` once the PR is merged (README "How to execute a plan").
2. `HANDOFF.md`: if it names the PR as the next one or as in progress, update it.
3. A finding that changes another plan's prerequisites (a new blocker, a command that no longer works, a defect in a plan's steps) becomes a row in README "Open decisions with an owner" that names the affected plan.
   Do not edit the affected plan itself: its step 0 picks the row up.
