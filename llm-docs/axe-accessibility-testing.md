---
main_commit: 10946d28a
analyzed_date: 2026-04-17
key_files:
  - src/format/html/format-html-axe.ts
  - src/resources/formats/html/axe/axe-check.js
  - src/resources/schema/document-a11y.yml
---

# Testing Axe Accessibility Checks

Workflow for exercising Quarto's `axe:` feature against real rendered output when triaging accessibility reports or validating fixes. For the internal architecture (dependency injection, reporters, sass bundles), see `axe-accessibility-architecture.md`.

## Quarto's Scan Configuration

`axe-check.js` calls `axe.run()` with only these options:

- `exclude: ["[data-tabster-dummy]"]` — works around microsoft/tabster#288
- `preload: { assets: ["cssom"], timeout: 50000 }`

No `runOnly` filter — Quarto surfaces the full default rule set (WCAG 2.0 A/AA + WCAG 2.1 + best-practice). This matters when comparing Quarto's output against an external axe scan: they should agree rule-for-rule.

## Runtime Signals

Two DOM markers are useful for automated testing:

- **`<script id="quarto-axe-checker-options" type="text/plain">...`** — base64-encoded JSON of the `axe:` options, injected at build time by `format-html-axe.ts`. Patching this string switches output mode in a pre-rendered HTML file without re-rendering:

  ```bash
  # Switch output: document → json in place
  sed -i 's|eyJvdXRwdXQiOiJkb2N1bWVudCJ9|eyJvdXRwdXQiOiJqc29uIn0=|g' output/index.html
  # ({"output":"document"} ↔ {"output":"json"})
  ```

- **`document.body.dataset.quartoAxeComplete === "true"`** — set by `axe-check.js` once the scan finishes. Use as a wait condition in headless-browser tests.

## Output Modes Recap

- `json` — one `console.log(JSON.stringify(result, null, 2))` call with the full axe result. Not stdout. Needs a browser to capture.
- `console` — one `console.log` per violation with targets.
- `document` — visual overlay (HTML), slide (RevealJS), or offcanvas (dashboard).

## Testing Pipeline

For a11y triage against a user's repro repo:

1. Clone the repro into a scratch dir (not inside `quarto-cli`).
2. Render with the dev Quarto build: `package/dist/bin/quarto.cmd render`.
3. Either run with `axe: output: json` in `_quarto.yml`, or patch the base64 config in the rendered HTML as above.
4. Serve the output locally — `simple-http-server.exe --nocache -i -p PORT path/`.
5. Scan with `agent-browser` (uses Chrome via CDP):

   ```bash
   agent-browser --session scan open "http://localhost:PORT/index.html"
   agent-browser --session scan wait --fn \
     'document.body.getAttribute("data-quarto-axe-complete") === "true"'
   agent-browser --session scan console > result.txt
   # extract the last [log] entry and feed to jq
   ```

## Running Axe Manually (Full Control)

Quarto's built-in scan fires soon after `DOMContentLoaded`. For pages with late-arriving content (htmlwidgets, profvis, late-mounted callouts), the built-in scan can miss violations that a later scan would catch. Run axe directly via `agent-browser eval`:

```bash
agent-browser --session scan eval --stdin <<'EOF'
(async () => {
  const axe = await import("https://cdn.jsdelivr.net/npm/axe-core@4.10.3/+esm");
  const results = await axe.default.run(document, { resultTypes: ["violations"] });
  return results.violations.map(v => ({
    id: v.id, impact: v.impact, nodes: v.nodes.length,
    targets: v.nodes.map(n => n.target), tags: v.tags
  }));
})()
EOF
```

Use the same axe-core version (`4.10.3` at the time of writing) as bundled in `axe-check.js` to keep rule parity with Quarto's own scan.

## Comparing With / Without Fixes

To identify which violations a proposed patch resolves vs. which remain, render twice — once with the patch disabled, once with it enabled — and diff the rule IDs. `include-after-body:` is the right hook for injecting a JS fix without touching Quarto internals during triage.

## Tips

- The axe-core bundled version is loaded from `cdn.skypack.dev` at runtime. Offline environments will silently fail; note this when triaging reports that blame a "missing" scan.
- If a scan only surfaces 1–2 violations where you expected many, the built-in scan likely ran before the page finished rendering. Run axe manually via eval to confirm.
- Some violations change with viewport size (sidebar visibility, scrollable regions). Note the viewport when recording findings — `agent-browser` defaults to 1262×568 in headless mode.
