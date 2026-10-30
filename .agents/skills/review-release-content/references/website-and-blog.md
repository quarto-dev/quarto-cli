# Website highlights and blog preparation

## Locate the content and its rules

Resolve the destination repositories from the current release checklist and configured git remotes. If the user supplies a checkout, verify its repository identity and branch rather than relying on its folder name.

For research and drafting, use upstream repository files at the relevant branch or commit through GitHub's API or raw source access. Fetch project instructions, highlights, guides and examples this way when no checkout is supplied. Record the reviewed refs; stable website pages alone cannot establish unreleased behavior. This work does not require finding or creating a local clone.

A local checkout is needed for destination edits or rendering. Use one provided by the user or identified by the workspace's repository tooling. Ask for a location only when those actions are required and no checkout is known. Read its project instructions, especially branch routing, documentation style and freeze rules, and compare with current upstream content to avoid duplicating completed documentation.

Highlights belong in `docs/prerelease/{version}/_highlights.qmd` in quarto-web. Inspect its include callers and version page to understand where the copy appears. The technical CLI changelog and promotional highlights serve different readers.

Quarto release posts publish in `posit-dev/open-source-website`, under `content/blog/quarto-{major}-{minor}/`, rather than quarto-web. Confirm the destination against the current release checklist and blog guidance. Read quarto-web's `.claude/skills/blog-post/SKILL.md` and its release-post reference when available, then the destination's authoring guide and archetype. Those sources govern post structure, metadata, acknowledgements, images, rendering and validation.

## Choose and substantiate the story

Compare the release with the previous stable version, including intervening stable patches. Distinguish a newly introduced capability from improvements to an existing format, execution engine or option. Features backported to stable can merit coverage without being exclusive to the new release.

Keep an accelerated release's reason prominent when supported by the release context. Give substantial sections to consequential author-facing improvements; place smaller changes in Other Highlights. Keep hidden experimental commands and internal build details in technical notes unless the audience needs them.

Preserve upgrade consequences: metadata merging, stricter validation, changed styling variables or DOM contracts, and platform requirements can matter more than another feature bullet. Scope accessibility claims to the shipped behavior; individual fixes do not establish general WCAG conformance. Performance claims need measurements.

Use exact option names and configuration placement from implementation or shipped documentation. Distinguish outputs such as visible captions and alternative text, and ordinary blocks from cross-referenceable blocks. Run examples before describing their results; otherwise leave them as proposed examples with verification pending.

## Documentation and deliverables

Map each highlighted claim to existing documentation and identify only the gaps needed to support it. Verify prerelease sources and anchors locally or at the relevant upstream ref. Use website-native links in highlights and absolute public documentation URLs in a cross-site blog post. Track which links require documentation promotion before publication.

If the current session is best suited to CLI review, prepare proposed highlight copy, a blog outline or preliminary body, and separate prompts for the destination repositories. Each handoff should name:

- The version, reviewed refs, evidence bundle and draft paths.
- The destination rules to read, appropriate base branch, existing docs and remaining gaps.
- Claims or examples still requiring verification.
- Required rendering and link checks, plus pending author, date, acknowledgements or image choices.
- The authorized scope and publication steps that remain outside it.

Keep prompts self-contained and update commit references after committing. Identify preliminary copy as such; avoid inventing publication metadata or implying an unreleased candidate is stable.

When editing in the destination is authorized, follow its render and validation workflow and report any pending promotion or publication dependencies. A content review does not substitute for the release checklists or final artifact validation.
