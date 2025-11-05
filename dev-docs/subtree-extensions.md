# Subtree extensions

Subtree extensions live in `src/resources/subtree-extensions`.

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
