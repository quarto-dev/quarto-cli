---
paths:
  - dev-docs/checklist-make-a-new-*.md
  - .claude/skills/make-release/**
---

# Release Checklists and the `/make-release` Skill

The `dev-docs/checklist-make-a-new-*.md` files are the human-first source of truth: anyone releasing by hand gets every step, command, and conditional from the checklist (or a link it follows). The `make-release` skill holds only how an agent carries itself while driving them: detecting which checklist applies, verifying real state before ticking a step, confirmation gates, escalating a stale step.

When editing either side, ask whether a human releasing by hand needs the sentence. If yes, it goes in the checklist. If it is about agent conduct, it goes in the skill, which routes to the checklist steps without restating them. `checklist-backport-a-pr.md` is outside the skill's scope.
