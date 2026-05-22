---
paths:
  - src/resources/extension-subtrees/**
---

# Extension Subtrees

Files under `src/resources/extension-subtrees/<name>/` are git subtrees from external repos. **Do NOT edit directly here.**

Current subtrees (see [`src/command/dev-call/pull-git-subtree/cmd.ts`](../../src/command/dev-call/pull-git-subtree/cmd.ts) for the source of truth):

| Name | Upstream repo |
|---|---|
| `julia-engine` | `PumasAI/quarto-julia-engine` |
| `orange-book` | `quarto-ext/orange-book` |

## Workflow

1. Open a PR with the fix in the upstream repo
2. Wait for upstream merge
3. From quarto-cli, run:
   ```bash
   quarto dev-call pull-git-subtree <name>
   ```
4. The command adds two commits (squash + merge) — **do not edit those commits**
5. **Do not rebase** a branch that contains the subtree-pull commits — they cannot be rebased cleanly. Merge to `main` without rebasing, or remove the two commits before rebasing and re-run the pull command.

## Reference

Full workflow: [`dev-docs/subtree-extensions.md`](../../dev-docs/subtree-extensions.md)
