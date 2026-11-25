# Agent instructions: runtime migration

These apply to any work in this directory or on a PR listed in README "The sequence": executing, reviewing, amending or closing out a plan.

Execute at most one plan task per session.
Tick its checkboxes, fold its execution-log updates into the task commit (a task with no commit step still commits the plan file), run the post-commit review, and stop at that task boundary.
Keep any file a later task reads (a baseline, captured output) somewhere that survives the session, not `/tmp`, and record its path in the execution log.
Later tasks read it from that logged path, even if their commands name another one.
A fresh session resumes with the continuation prompt in README "How to execute a plan".
A maintainer-only step (a push, `gh workflow run`, `gh pr create`) is a handoff: the maintainer runs it, and execution resumes at the first unticked step.
After the last executor step, the coordinator's wrap-up session runs the plan's Verification, its review checklist and the whole-branch checks of "How to execute a plan", lists the checks that need the open PR as pending in the PR description, then hands the branch to the maintainer.
A PR opened before the wrap-up stays a draft until the wrap-up has run.

At step 0, set the PR's row in README "The sequence" to `in progress` and update `HANDOFF.md` if it names the PR as next.
When the PR merges, the coordinator follows [post-merge closeout](README.md#after-a-pr-merges) on a fresh docs branch.

Record a finding that changes another plan (a new blocker, a command that no longer works, a defect in its steps) in README "Open decisions with an owner" and name the affected plan.
Its step 0 picks up the finding; leave the plan itself unchanged.
