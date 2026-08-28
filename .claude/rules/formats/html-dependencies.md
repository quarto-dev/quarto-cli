---
paths:
  - "src/format/html/**/*"
---

# HTML FormatDependency Pattern

**Reference:** `axeHtmlDependency()` in `src/format/html/format-html-axe.ts`

## Use `head` Field for Dynamic HTML

```typescript
function myHtmlDependency(config: unknown): FormatDependency {
  return {
    name: "my-feature",
    head: `<script type="text/plain">${encodeBase64(JSON.stringify(config))}</script>`,
    scripts: [{ name: "file.js", path: formatResourcePath(...) }],
  };
}
```

- Use `head` for inline/dynamic content (config scripts, meta tags)
- Use `scripts`/`stylesheets` fields for external files
- Don't create temp files manually with `temp.createFileFromString()`
- Base64-encode JSON in script tags (prevents `</script>` parser issues)

## Verify a vendored file's provenance

Vendored third-party scripts under `src/resources/formats/html/*/` (e.g. `axe`, `anchor`,
`popper`) are updated by `package/src/common/update-html-dependencies.ts`, not hand-edited.
Reviewing a change to one of these files: fetch the same version from upstream and compare
hashes rather than trusting the diff — `curl -sL <upstream-url> | sha256sum` against the
committed file. These same-origin vendored files don't need SRI (`integrity=`); that only
protects cross-origin CDN loads, which is what vendoring replaces.
