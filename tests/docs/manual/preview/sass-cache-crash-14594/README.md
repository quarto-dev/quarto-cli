# Sass cache reuse during preview (#14594)

Manual fixture for the bug where `quarto preview` of a book (or website) project
crashed with `BadResource: Bad resource ID` while recompiling the theme Sass on a
re-render. `SassCache.cleanup()` closed the session `Deno.Kv` handle but left the
stale instance in the module-level `_sassCache` registry, so the next
`sassCache(path, temp)` resolve reused the now-closed handle.

On each re-render the serve/watch reload path runs `refreshProjectConfig`
(`src/project/serve/watch.ts`, ~line 277 for HTML; also on any config change,
~line 305), which calls `project.cleanup()` and closes that session Sass KV
handle. The next render must open a fresh handle. RStudio's and Positron's live
preview hit the same persistent server, so they saw the same crash.

Drive this with the `/quarto-preview-test` workflow. See the parent `../README.md`
"Test Matrix: Sass Cache Reuse (#14594)" for the T34-T36 cases.

## Files

| File | Role |
|------|------|
| `_quarto.yml` | Flat multi-chapter book with `theme: cosmo` + `css: styles.css` (routes the theme through the session Sass cache) |
| `index.qmd`, `chapter1.qmd`, `chapter2.qmd` | Minimal chapters; a project preview re-renders these |
| `styles.css` | Custom CSS so a real Sass compile runs alongside the cosmo theme |

`_book/` and `.quarto/` are scratch produced by a run and are git-ignored.

## Crash signal

Before the fix, after the first re-render the preview log shows:

```
BadResource: Bad resource ID
```

and pages stop reloading. After the fix, every re-render completes and reloads.

Deterministic unit coverage lives in `tests/unit/sass-cache.test.ts`; this fixture
is the interactive regression guide the unit test can't cover (live serve/watch
path).
