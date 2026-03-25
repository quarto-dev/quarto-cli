# Quarto Julia Engine changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.2.0](https://github.com/PumasAI/quarto-julia-engine/releases/tag/v0.2.0) - 2026-03-24

- Added `keep-ipynb` support. When `keep-ipynb: true` is set in document YAML, the executed notebook is written to `<stem>.ipynb` alongside the source file [#8](https://github.com/PumasAI/quarto-julia-engine/pull/8).
- Updated to QuartoNotebookRunner 0.18.1 [#11](https://github.com/PumasAI/quarto-julia-engine/pull/11):
  - **`fig-format: retina` support**: Normalized to `png` with doubled `fig-dpi`, matching Quarto's Jupyter and knitr backends. Fixes blurry plots with default HTML settings.
  - **Improved cache invalidation**: Cache key now hashes full `Manifest.toml` content (SHA-224) so dependency version changes correctly invalidate the cache.
- Updated to QuartoNotebookRunner 0.18.0 [#7](https://github.com/PumasAI/quarto-julia-engine/pull/7):
  - **Shared worker processes**: Multiple notebooks can share a single worker process when their configs match. Enable with `share_worker_process: true`.
  - **`execute-dir` support**: Quarto's `execute-dir` option (e.g. `execute-dir: project`) is now passed through correctly.
  - **Cached worker environments**: Worker envs persist across sessions, skipping environment setup on subsequent runs when Julia and QNR versions haven't changed.
  - **Relaxed manifest version checking**: Only major.minor is checked by default, matching Julia's Pkg behavior. Opt into strict major.minor.patch via `julia: strict_manifest_versions: true`.
  - **Diagnostic file logging**: Set `QUARTONOTEBOOKRUNNER_LOG` to a directory path to enable timestamped log files.
  - **Echo handling for Python/R cells**: Fixed duplicate YAML keys and added proper support for `echo: false` and `echo: fenced`.

## [0.1.0](https://github.com/PumasAI/quarto-julia-engine/releases/tag/v0.1.0) - 2026-03-19

- Initial release as a standalone Quarto extension, extracted from [quarto-cli](https://github.com/quarto-dev/quarto-cli).
- Bundled Julia resource files (`Project.toml`, `ensure_environment.jl`, `quartonotebookrunner.jl`, `start_quartonotebookrunner_detached.jl`) into the extension, making it fully self-contained [#6](https://github.com/PumasAI/quarto-julia-engine/pull/6).
- Added CI workflow with tests on Linux, macOS, and Windows [#6](https://github.com/PumasAI/quarto-julia-engine/pull/6).
