---
main_commit: 8487eaafe
analyzed_date: 2026-10-02
key_files:
  - src/command/render/render.ts
  - src/command/render/pandoc.ts
  - src/command/render/types.ts
  - src/config/types.ts
  - src/format/html/format-html-bootstrap.ts
  - src/project/types/website/website.ts
  - src/project/types/website/website-llms.ts
---

# HTML postprocessors and finalizers

After Pandoc writes an HTML file, Quarto parses it once into a deno-dom
`Document`, runs every HTML postprocessor and then every HTML finalizer on that
same document, and writes the result back to disk
(`runHtmlPostprocessors()` in `src/command/render/render.ts`).

## Contracts

| | Postprocessor | Finalizer |
|---|---|---|
| Type | `HtmlPostProcessor` (`src/command/render/types.ts`) | `(doc: Document) => Promise<void>` |
| Extras key | `kHtmlPostprocessors` | `kHtmlFinalizers` (`src/config/types.ts`) |
| Receives | `doc` + `{ inputMetadata, inputTraits, renderedFormats, quiet }` | `doc` only |
| Returns | `HtmlPostProcessResult` (`resources`, `supporting`) | nothing |
| Runs | in registration order | after **all** postprocessors |
| Kept for | `isHtmlOutput(format.pandoc)` | `isHtmlDocOutput(format.pandoc)` (html, html4, html5 only) |

Both mutate `doc` in place, and the mutations are written to the output file.
A finalizer that only *reads* the page to produce a side artifact must work on
a clone (`llmsHtmlFinalizer` → `extractMainContent` does
`doc.cloneNode(true)`), otherwise its cleanup leaks into the rendered page.

Use a postprocessor to transform the page or to report resources. Use a
finalizer when the work needs the page as every postprocessor left it: the
bootstrap column layout pass (`bootstrapHtmlFinalizer`) and the llms.txt
markdown export (`llmsHtmlFinalizer`) are the two in-tree finalizers.

## Registration and order

Both are contributed through `FormatExtras.html`, from a format's
`formatExtras()` or a project type's `formatExtras()`. `runPandoc()` in
`src/command/render/pandoc.ts` merges them with
`mergeConfigs(projectExtras, formatExtras, ...)`. Arrays concatenate, so
**project-type entries run before format entries** (website finalizers run
before the bootstrap finalizer). `runPandoc()` also adds built-in
postprocessors around the extras: code tools before, then overflow-x, KaTeX,
resource discovery and others after.

## Factory signature convention

Postprocessors and finalizers are built by a factory that closes over render
context and returns the `doc` callback. The factory takes the **render inputs
that `formatExtras()` already has** (`source`, `project`, `format`, `flags`,
`services`, ...) and derives whatever it needs inside, rather than having the
call site pre-compute narrow values:

```ts
function bootstrapHtmlFinalizer(format: Format, flags: PandocFlags) { ... }
export function llmsHtmlFinalizer(
  source: string,
  project: ProjectContext,
  format: Format,
  flags: PandocFlags,
) {
  const mathMethod = resolveHtmlMathMethod(format, flags)?.method;
  return async (doc: Document): Promise<void> => { ... };
}
```

This keeps the call site a one-line registration, keeps the derivation next to
the code that uses it, and leaves room to read more of the format later
without changing the signature. Derive once in the factory body, not per call
of the returned callback.

Pass `flags` alongside `format` whenever a value can come from the command
line: `format` does not reflect CLI flags. For example `--katex` lives only in
`flags`, which is why `resolveHtmlMathMethod(format, flags)` takes both.

A pre-computed value is fine when the caller builds it for its own use anyway
(`revealHtmlPostprocessor` receives the plugin init that `formatExtras()` also
uses for `kRevealJsScripts`). Don't compute one *only*
to hand it to the factory.
