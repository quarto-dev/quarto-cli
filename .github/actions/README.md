# Composite Actions

Reusable steps shared across workflows in this repo. See also `.github/workflows/actions/` for another set of composite actions (historical split, no functional difference).

| Action | Purpose |
|--------|---------|
| [`cache-typst`](cache-typst/action.yml) | Configures caching for Typst packages. |
| [`docker`](docker/action.yml) | Builds and pushes a Quarto Docker container to the GitHub Container Registry. |
| [`merge-extension-tests`](merge-extension-tests/action.yml) | Copies test files from extension subtrees into the main test directories. |
