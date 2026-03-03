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
