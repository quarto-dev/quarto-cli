# Subtrees

We're using git subtrees to manage forks and upstreams.

https://www.atlassian.com/git/tutorials/git-subtree

## Creation

(You don't need to do this during regular maintenance, but I'm recording it here
so that I know what to do for _new_ forks)

```
git subtree add --prefix packages/ojs/external-d3-d3-require git@github.com:d3/d3-require.git main --squash
git subtree add --prefix packages/ojs/external-observablehq-parser git@github.com:observablehq/parser.git main --squash
git subtree add --prefix packages/ojs/external-observablehq-runtime git@github.com:observablehq/runtime.git main --squash
git subtree add --prefix packages/ojs/external-observablehq-stdlib git@github.com:observablehq/stdlib.git main --squash
git subtree add --prefix packages/ojs/external-asg017-unofficial-observablehq-compiler git@github.com:asg017/unofficial-observablehq-compiler.git beta --squash
```

## Updates

Updating subtrees from their upstreams:

```
git subtree pull --prefix packages/ojs/external-d3-d3-require git@github.com:d3/d3-require.git main --squash
git subtree pull --prefix packages/ojs/external-observablehq-parser git@github.com:observablehq/parser.git main --squash
git subtree pull --prefix packages/ojs/external-observablehq-runtime git@github.com:observablehq/runtime.git main --squash
git subtree pull --prefix packages/ojs/external-observablehq-stdlib git@github.com:observablehq/stdlib.git main --squash
git subtree pull --prefix packages/ojs/external-asg017-unofficial-observablehq-compiler git@github.com:asg017/unofficial-observablehq-compiler.git beta --squash
```