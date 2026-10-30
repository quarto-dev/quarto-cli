# Website highlights and blog preparation

## Locate the content and its rules

The website repository is [quarto-dev/quarto-web](https://github.com/quarto-dev/quarto-web). Unreleased website content lives on its `prerelease` branch; use that branch for the target release's highlights, documentation and authoring instructions. Resolve its current commit when reviewing and record it so the evidence remains reproducible.

Resolve other destination repositories from the current release checklist and configured git remotes. If the user supplies a checkout, verify its repository identity and branch rather than relying on its folder name.

For research and drafting, use upstream repository files at the relevant branch or commit through GitHub's API or raw source access. Fetch project instructions, highlights, guides and examples this way when no checkout is supplied. Record the reviewed refs; stable website pages alone cannot establish unreleased behavior. This work does not require finding or creating a local clone.

A local checkout is needed for destination edits or rendering. Use one provided by the user or identified by the workspace's repository tooling. Ask for a location only when those actions are required and no checkout is known. Read its project instructions, especially branch routing, documentation style and freeze rules, and compare with current upstream content to avoid duplicating completed documentation.

### Website rules

Read these sources from quarto-web's reviewed `prerelease` ref before preparing edits or a website handoff. Upstream links below follow their named branches; resolve those branches to commits when recording evidence.

- [Website workflow](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/rules/quarto-web-workflow.md): shared corrections target `main` first and are ported to `prerelease`; upcoming-version changes target `prerelease`. Source edits can invalidate computational freezes even when only prose or includes change. Use its engine-aware freeze procedure and look for existing shared partials before repeating content across pages.
- [Docs authoring](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/rules/docs-authoring.md): version callouts for substantial new features, format identifiers, UI controls, and headings versus example labels.
- [Image rules](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/rules/images-alt-text.md) and [style guide](https://github.com/quarto-dev/quarto-web/blob/prerelease/_style-guide.md): website link syntax, image purpose, `fig-alt`, and keeping shown example code in sync with rendered output. Check image alt attributes in rendered HTML, including content hidden from axe scans.

Use the [axe baseline rules](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/rules/axe-baseline.md) only when the task touches a scan baseline or an intentional accessibility example. Read the [screenshot skill](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/screenshot/SKILL.md) and its visual references when producing documentation screenshots. Read the [release-merge skill](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/release-merge/SKILL.md) and its [merge reference](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/release-merge/references/release-merge.md) when an authorized task includes the release-time merge; content preparation should only identify that dependency.

Highlights belong in `docs/prerelease/{version}/_highlights.qmd` in quarto-web's [prerelease content directory](https://github.com/quarto-dev/quarto-web/tree/prerelease/docs/prerelease). Inspect its include callers and version page to understand where the copy appears. The technical CLI changelog and promotional highlights serve different readers.

### Blog rules

Quarto release posts publish in [posit-dev/open-source-website](https://github.com/posit-dev/open-source-website), under `content/blog/quarto-{major}-{minor}/`, rather than quarto-web. Confirm the destination against the current release checklist and blog guidance. Read quarto-web's [blog-post skill](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/blog-post/SKILL.md) and its [Release Announcements reference](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/blog-post/references/post-types.md#release-announcements).

In the destination repository, read the [blog instructions](https://github.com/posit-dev/open-source-website/blob/main/content/blog/CLAUDE.md), [authoring guide](https://github.com/posit-dev/open-source-website/blob/main/content/blog/_authoring-guide.md) and [archetype](https://github.com/posit-dev/open-source-website/blob/main/archetypes/blog.md). Those sources govern metadata, scaffolding, rendering and validation; quarto-web supplies the Quarto editorial conventions. Read the [thumbnail guide](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/blog-post/references/thumbnail-guide.md) and, for its Typst path, the [Typst thumbnail reference](https://github.com/quarto-dev/quarto-web/blob/prerelease/.claude/skills/blog-post/references/typst-thumbnail.md) only when creating the image. Check source and rendered post together, and carry pending documentation-promotion links into the handoff.

## Choose and substantiate the story

Compare the release with the previous stable version, including intervening stable patches. Distinguish a newly introduced capability from improvements to an existing format, execution engine or option. Features backported to stable can merit coverage without being exclusive to the new release.

Keep an accelerated release's reason prominent when supported by the release context. Give substantial sections to consequential author-facing improvements; place smaller changes in Other Highlights. Keep hidden experimental commands and internal build details in technical notes unless the audience needs them.

Preserve upgrade consequences: metadata merging, stricter validation, changed styling variables or DOM contracts, and platform requirements can matter more than another feature bullet. Scope accessibility claims to the shipped behavior; individual fixes do not establish general WCAG conformance. Performance claims need measurements.

Use exact option names and configuration placement from implementation or shipped documentation. Distinguish outputs such as visible captions and alternative text, and ordinary blocks from cross-referenceable blocks. Run examples before describing their results; otherwise leave them as proposed examples with verification pending.

## Documentation and deliverables

Map each highlighted claim to existing documentation and identify only the gaps needed to support it. Before declaring a gap, follow the page's includes and shared partials: a section and its anchor may live outside the page source. Verify prerelease sources and anchors locally or at the relevant upstream ref. Use website-native links in highlights and absolute public documentation URLs in a cross-site blog post. Track which links require documentation promotion before publication.

If the current session is best suited to CLI review, prepare proposed highlight copy, a blog outline or preliminary body, and separate prompts for the destination repositories. Each handoff should name:

- The version, reviewed refs, evidence bundle and draft paths.
- The destination rules to read, appropriate base branch, existing docs and remaining gaps.
- Claims or examples still requiring verification.
- Required rendering and link checks, plus pending author, date, acknowledgements or image choices.
- The authorized scope and publication steps that remain outside it.

Keep prompts self-contained and update commit references after committing. Identify preliminary copy as such; avoid inventing publication metadata or implying an unreleased candidate is stable.

When editing in the destination is authorized, follow its render and validation workflow and report any pending promotion or publication dependencies. A content review does not substitute for the release checklists or final artifact validation.
