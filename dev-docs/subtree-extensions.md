# Subtree extensions

Subtree extensions live in `src/resources/extension-subtrees`.

Each is the complete git repository of a Quarto extension, e.g. the directory tree for the Julia engine looks like

```
src/resources/extension-subtrees/
  julia-engine/
    _extensions/
      julia-engine/
        _extension.yml
        julia-engine.ts
        ...
```

The list of subtrees and their upstream repos lives in the `SUBTREES` table in [`src/command/dev-call/pull-git-subtree/cmd.ts`](../src/command/dev-call/pull-git-subtree/cmd.ts).

## Updating an extension

Fixes to extension files **must be authored upstream**, never edited directly inside `src/resources/extension-subtrees/<name>/`. The correct workflow:

1. Open a PR with the fix in the upstream repo (e.g. `quarto-ext/orange-book`, `PumasAI/quarto-julia-engine`)
2. Merge the PR upstream
3. From quarto-cli, run the pull command (see [Pulling subtree updates](#pulling-subtree-updates))

Editing directly inside the subtree prefix is wrong: the change will be overwritten the next time the subtree is pulled, and anyone who forked the upstream extension will not benefit from it.

## Pulling subtree updates

The command to add or update a subtree is

```
quarto dev-call pull-git-subtree subtree-name
```

Omit _subtree-name_ to add/update all.

The code in `src/command/dev-call/pull-git-subtree/cmd.ts` contains a table of subtree

- `name`
- `prefix` (subdirectory)
- `remoteUrl`
- `remoteBranch`

If the command is successful, it will add two commits, one the squashed changes from the remote repo and one a merge commit.

The commits have subtree status information in the message and metadata, so don't change them.

The commits can't be rebased -- you'll get weird errors indicating it tried to merge changes at the root of the repo.

So you must either

- run the command when ready to merge to main, or
- remove the commits when rebasing, and run the `dev-call` command again

## Recovery: edits made in-tree by mistake

If a fix has already been committed directly inside the subtree prefix (wrong workflow), it needs to be re-authored upstream before resuming the normal flow. Two paths:

### Option A — re-author upstream manually (recommended)

Faster and more predictable, especially in repos with many commits where `git subtree split` walks the full history.

1. Clone the upstream repo locally (e.g. `git clone https://github.com/quarto-ext/orange-book.git`)
2. Create a feature branch from upstream `main`
3. Apply the same change at the upstream repo's path (the subtree's `_extensions/...` becomes the repo root)
4. Commit (preserve original author and message) and push to the upstream repo
5. Open a PR upstream and merge

### Option B — `git subtree push`

Extracts the prefix-scoped history into a synthetic branch and pushes it. Works but is slow on large repos (the split walks every commit) and untested in this codebase.

```
git fetch <upstream-url> <upstream-branch>
git subtree push --prefix=src/resources/extension-subtrees/<name> \
  <upstream-url> <feature-branch>
```

Then open a PR upstream from `<feature-branch>`.

### After the upstream PR merges

Back in quarto-cli, on the branch holding the original in-tree commit:

1. Remove the in-tree edit from the local commit (amend or rebase out the lines under the subtree prefix) so `pull-git-subtree` does not conflict with itself
2. Run `quarto dev-call pull-git-subtree <name>` to bring the upstream change in via the normal two-commit pattern
3. Merge the branch to `main` without rebasing (the subtree-pull commits cannot be rebased — see [Pulling subtree updates](#pulling-subtree-updates))
