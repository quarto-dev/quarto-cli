# CLI guidance for release claims

Paths below are relative to quarto-cli. Use the current rules and their linked architecture documents to resolve specific claims rather than loading every rule for a content review.

| Claim or task | Source to consult | Why it matters |
| --- | --- | --- |
| Release scope or checklist changes | `.claude/rules/release-checklists.md` and the applicable `dev-docs/checklist-make-a-new-*.md` | Human release steps belong in the checklist; agent conduct belongs in the release skill. Content review does not drive publication. |
| Bundled Julia engine or another extension subtree | `.claude/rules/extension-subtrees.md` | An upstream merge alone does not establish inclusion in Quarto; verify the subtree import in the candidate. |
| Metadata inheritance or list merging | `.claude/rules/typescript/config-merging.md` | Different merging helpers have specific exceptions; scope claims to the affected metadata contract. |
| Translation keys or template visibility | `.claude/rules/rendering/localization.md` | Follow the language values through the documented pipeline before describing what templates or filters receive. |
| Translation correctness requiring investigation | `.claude/skills/verify-l10n-pr/SKILL.md` | Structural checks and semantic translation review provide different evidence. A release entry review need not re-review every translation. |
| Vendored HTML dependencies | `.claude/rules/formats/vendored-html-dependencies.md` | Check shipped versions and provenance; generated bundles may differ from raw upstream files through documented postprocessing. |
| Pandoc template integration | `.claude/rules/formats/pandoc-templates.md` | Quarto restructures upstream templates; changes to the bundled Pandoc version alone do not describe every template change. |
| Render-time axe checks | `.claude/rules/formats/axe-accessibility.md` | This integration is distinct from the hidden site-scanning command. |
| Site-scanning command | `.claude/rules/dev-tools/axe-scan.md` and `dev-docs/axe-scan.md` | Verify scanner scope, baseline behavior and CI flags independently of render-time checks. |
| Hidden developer commands or generated schemas | `.claude/rules/dev-tools/dev-call-commands.md` | Clarifies the developer audience and generated outputs without turning internal tooling into a public feature headline. |

For an extension-subtree import, inspect the landed import merge against its first parent, restricted to that subtree:

```sh
git diff IMPORT_MERGE^1 IMPORT_MERGE -- src/resources/extension-subtrees/NAME/
```

Substitute the merge commit and subtree name. An unscoped `git show` of the intermediate subtree squash can compare different repository roots and produce a misleading whole-repository diff.

If a claim needs fresh runtime evidence, read `.claude/rules/testing/overview.md` and the relevant test-type rules before running focused tests. Use `.claude/skills/quarto-preview-test/SKILL.md` when the requested verification concerns preview or live reload. These are conditional verification paths, not mandatory release-content checks.
