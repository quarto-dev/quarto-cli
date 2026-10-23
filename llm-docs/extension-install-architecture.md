---
main_commit: 4c7b5d25d
analyzed_date: 2026-10-19
key_files:
  - src/extension/install.ts
  - src/extension/extension.ts
  - src/extension/extension-host.ts
  - src/extension/remove.ts
  - src/command/add/cmd.ts
  - src/command/update/cmd.ts
  - src/command/remove/cmd.ts
  - src/command/use/commands/template.ts
  - tests/smoke/extensions/install.test.ts
  - tests/smoke/use/template.test.ts
---

# Extension installation and namespaces

How `quarto add`, `quarto update`, `quarto remove` and `quarto use template` place extensions under `_extensions/`, and how a document finds them again. Read this before changing the install layout or the extension lookup.

## The namespace rule

An installed extension lives at `_extensions/<owner>/<name>/` or `_extensions/<name>/`.

- `<owner>` comes from **where the extension is installed from**, never from the source tree. For GitHub sources (`org/repo`, `org/repo/subdir`, `org/repo@ref`, and github.com archive URLs) it is the GitHub owner (`ExtensionSource.owner`, set from `host.organization` in `extension-host.ts`).
- Local directories, local archives and non-GitHub URLs have no owner: their extensions go directly under `_extensions/`. The user docs say archives "share a single namespace" (quarto-web `docs/extensions/distributing.qmd`, "Archive Distribution").
- `<name>` is the extension's folder name in the source.
- An owner folder found in the source (`_extensions/<other-owner>/<name>/`) is **dropped**. Since #15111 the installer prints an INFO note when this happens, naming the id to use.

The documented purpose of the namespace is avoiding name conflicts ("the use of organizations as a 'namespace' for managing name conflicts", `distributing.qmd`). Deriving it from the install origin means a fork or copy installed from another owner lands under that owner and cannot overwrite the original. Do not change install to keep the source owner folder: a fork shipping `_extensions/quarto-ext/x/` would then install into `quarto-ext/`.

### History

- Before June 2022 the install copied the source tree as is, so the namespace was whatever folder the source shipped (`name@org`, later `org/name`).
- June 2022 (`959f25f85`, `dc94a9673`, `e72966d30`): ids became `org/name`, the owner comes from GitHub, local sources are flattened.
- July 2022: author guidance changed to an unowned source layout `_extensions/<name>/` (quarto-web `903cc7ca7`, and `9fafe706a` whose message says sources "used to have owner name space"). quarto-journals repos were moved out of their owner folders. `quarto-journals/acm` got its owner folder back by an accidental merge and still has it.
- `92458565d` (v1.5.15) passed the template root to `copyExtensions`, so templates with an owner folder installed nothing (#14008). Fixed by #14010 (1.11).

## Source layout (what extension authors ship)

`_extensions/<name>/_extension.yml` at the root of the repo or archive, optionally inside a single wrapper directory (GitHub archive tarballs). `quarto create extension` scaffolds this. An extension that needs another owner's extension embeds it with `quarto add <other> --embed <name>`, which places it at `_extensions/<name>/_extensions/<other-owner>/<other>/` inside the host extension and keeps its owner folder there.

## Install pipeline (`src/extension/install.ts`)

1. `installExtension` resolves the source (`extensionSource` in `extension-host.ts`): `{type: "local"}` for an existing path, `{type: "remote", owner, targetSubdir}` for a resolved URL.
2. `stageExtension` builds a staged `_extensions` tree in a temp dir:
   - remote or local archive → `unzipAndStage` → `copyExtensions(source, <archive _extensions>, staged)`;
   - local directory → `readAndCopyExtensions(<dir>/_extensions, staged/_extensions)` with no owner.
3. `copyExtensions` targets `_extensions/<source.owner>/` (or the root) and calls `readAndCopyExtensions`, which copies each extension to `<target>/<id.name>` and prints the owner note when the source owner folder differs.
4. `confirmInstallation` compares staged extensions with installed ones by **name and organization** and prints the `[Install]`/`[Update]`/`[Revert]`/`[No Change]` table. A flattened `acm` and an owned `quarto-journals/acm` count as different extensions, so a reinstall that changes the owner installs a second copy instead of updating.
5. `completeInstallation` moves the staged tree into the install directory chosen by `determineInstallDir`: the current directory (inside a project, a prompt offers the project root instead; `--no-prompt` keeps the current directory), or, with `--embed <name>`, the folder of that extension, which must contribute a format.

`quarto use template` (`src/command/use/commands/template.ts`) stages the template, reads `<template>/_extensions` for the confirmation list, then runs `copyExtensions(source, <template>/_extensions, …)` and `completeInstallation`. Template files other than `_extensions` are copied separately.

## Reading and lookup (`src/extension/extension.ts`)

- `readExtensions(dir)` reads one owner level: a child folder with `_extension.yml` is an unowned extension; a child without it is treated as an owner folder and read once more. The source owner folder ends up in `extension.id.organization`.
- `discoverExtensionPath` resolves an id from a document. A qualified id `org/name` matches only `<org>/<name>/`. An unqualified `name` matches `name/` and `*/name/`; with several matches it warns "More than one extension is available" and returns the first glob match (`paths[0]`), so an older copy can win.
- Formats are referenced as `<name>-<base>` (`acm-pdf`). User docs only show the unqualified form; `org/name-base` works only when the extension sits under that owner.

## Tests

`tests/smoke/extensions/install.test.ts` and `tests/smoke/use/template.test.ts` are the only tests asserting install layout:

- GitHub installs land under the repo owner (`quarto-ext/lightbox`, `quarto-journals/jss|jasa|acm`); `quarto-ext/manuscript-template-vscode` covers a cross-owner source (`quarto-journals/agu` → `quarto-ext/agu`) and its note.
- Local archives in `tests/docs/extensions/ext-repo/` (all owner-scoped) and the local directory `tests/docs/extensions/owned-local/` install flattened.

Not covered: same-name extensions from two owners, installing or updating over an existing install, `quarto remove`, qualified id lookup and the "More than one extension" warning. `unowned-multiple.tar.gz` contains `acs` and `coolster` both unowned and under `quarto-test/`; they flatten onto the same folder and the test does not check which copy wins. Most install tests need network access to GitHub.
