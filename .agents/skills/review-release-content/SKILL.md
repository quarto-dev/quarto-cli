---
name: review-release-content
description: Review a Quarto release changelog for completeness, placement and wording, and prepare website highlights or a release blog handoff before release. Use for release content preparation, rather than building or publishing a release.
---

# Review release content

Produce a verified changelog and, when requested, evidence-backed website highlights and blog preparation. Derive the version, release scope and editorial emphasis from the current request and repository state.

## Establish the review scope

Read `.claude/rules/changelog.md` in full before editing. It is the source of truth for changelog structure and style, including its Backports section. Read the applicable release checklist in `dev-docs/` for context when preparing website or announcement content; executing the release is a separate task.

Identify the target `news/changelog-{version}.md`, intended release branch or candidate, previous stable release, and relevant commit range. Inspect local changes and upstream freshness before selecting a base. Record the refs and commits actually reviewed; do not assume the local default branch represents the candidate.

Preserve a baseline of entry identities and contributor credits before reorganizing. Existing local release assessments can supply context, but their conclusions need current evidence before reuse.

## Verify and edit the changelog

Compare landed changes across the release range with the changelog, not just the URLs already present. Use history, PR diffs, bundled engine changelogs and dependency configuration to find omissions. Include changes that affect users or supported developer workflows; distinguish shipped dependencies from experiments and build spikes. Check whether the merge deliberately omitted an entry before adding it.

For new or materially rewritten claims, establish the landed implementation and exact scope. Verify linked PRs are merged and their changes belong to the reviewed release. An open issue can track broader work than its landed fix: assess the narrow claim rather than treating issue closure as proof.

For claims involving bundled extensions, metadata, localization, dependencies or accessibility tooling, consult the matching sources in [references/cli-guidance.md](references/cli-guidance.md). Read only the guidance needed to resolve the claim.

### Regression fixes and backports

`Regression fixes` signals fixes also backported to stable. A bug introduced in an older version is not sufficient evidence for placement there.

- Before adding or moving an entry into this section, verify the stable backport is merged, using the stable history/changelog and backport PR where available. An open backport PR or backport label is insufficient.
- Preserve existing membership during editorial reorganization unless evidence warrants a correction. Put fixes without a merged stable backport in the appropriate regular section.
- Follow the rules' separate stable changelog structure when the requested work includes a stable changelog. Main and stable entries have different placement.
- Apply the same-cycle regression exclusion from the changelog rules; a fix to an unreleased change normally needs no separate entry.

Group by reader concern: keyboard and screen-reader changes belong in Accessibility; command failures belong under the affected command even if their implementation touched extensions. Sort references within their own repository namespace, keeping external engine references distinct from CLI issue numbers.

Write the user-visible symptom or capability in plain language. Trim mechanisms and repro detail while retaining compatibility consequences, affected formats, options and translation keys needed by users. Verify external credits against contribution history; reused tests or retained commits can justify attribution beyond the final PR author.

For bundled-tool platform requirements, distinguish each binary's requirement from the full product's rendering support. Name whether evidence comes from configuration, documentation, binary inspection or execution.

## Prepare highlights and announcement material

When requested, read [references/website-and-blog.md](references/website-and-blog.md). Select highlights from verified release changes and the previous stable release, including shipped backports. Scale the announcement to the actual release; choose stories because they matter to readers rather than aiming for a fixed number of highlights.

## Verify and hand off

Check the resulting diff against the baseline:

- Account for every original entry and contributor credit, using counts per reference plus credit so repeated references remain distinguishable. Explain intentional removals.
- List additions and their landed evidence. Check section hierarchy, reference ordering and any changed Regression fixes membership.
- Run `git diff --check` and parse the edited Markdown with an available Markdown parser. Check documentation links and anchors against the relevant sources; HTTP 200 alone does not establish prerelease content availability.

Report what changed, the evidence, unresolved claims and the exact checks run. Separate content verification from runtime, installer or release-candidate testing.

For work spanning repositories, save the report and requested drafts or handoff prompts in a location supplied by the user or established by repository conventions. If neither exists, choose a review directory in the current workspace and report its location and whether its files are tracked or ignored. Keep reusable guidance in this skill and version-specific facts in the review bundle.

Completion means the requested content is prepared, changes are accounted for, and unresolved publication dependencies are explicit. Commit when requested. Release publication, workflow dispatches and edits in another repository require authority from the user's task; preparing content does not grant that authority.
