All changes included in 1.10:

## Engines

### `julia`

- Update `julia` engine extension from 0.1.0 to 0.2.0 and QuartoNotebookRunner from 0.17.4 to 0.18.1.
- Add `keep-ipynb` support. When `keep-ipynb: true` is set in document YAML, the executed notebook is written alongside the source file.
- Add shared worker processes. Multiple notebooks sharing the same config can reuse a single worker process via `julia: share_worker_process: true`.
- Add support for `execute-dir: project` to set working directory to project root.
- Add diagnostic file logging via `QUARTONOTEBOOKRUNNER_LOG` environment variable.
- Cache worker package environments across sessions, skipping environment setup on subsequent runs when Julia and QNR versions haven't changed.
- Relax manifest version checking to major.minor by default, matching Julia's Pkg behavior. Opt into strict checking via `julia: strict_manifest_versions: true`.
- Fix `fig-format: retina` by normalizing to `png` with doubled `fig-dpi`, matching Jupyter and knitr backends.
- Fix cache invalidation to hash full `Manifest.toml` content so dependency version changes correctly invalidate the cache.
- Fix duplicate YAML keys when Python/R cells have cell options like `echo`.

## Formats

### `typst`

- ([#14261](https://github.com/quarto-dev/quarto-cli/issues/14261)): Fix theorem/example block titles containing inline code producing invalid Typst markup when syntax highlighting is applied.

