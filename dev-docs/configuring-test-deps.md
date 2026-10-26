# Installing and configuring the main tools

## Julia

- Install `juliaup`
- Install version to use e.g `juliaup add 1.10`
- Configure `tests` folder to use a specific version

  ```
  cd tests
  juliaup override unset
  juliaup override 1.10
  ```

  This way when calling `julia` in `tests` folder it will always be Julia 1.10 version

## Python

- Install `uv`

  About uv: https://docs.astral.sh/uv/

  `uv` will handle the python versions and virtual environments based on the `.python-version` we have in `tests/` folder.

  To set the version to use to

  ```
  cd tests
  echo '3.12.7' > .python-version
  ```

  This `uv run` and `uv sync` will create the right virtual environment and use it.

## R

- Install `rig`
- Install R version e.g `rig add 4.3.2`
- For now, no way to just configure a folder to use a specific version, so you need to set the version globally

  ```
  rig default 4.3.2
  ```

## NPM

- Install `npm` needed for meca

# Installing the dependencies in each languages packages

- From `tests` folder, run `configure-test-env.sh` or `configure-test-env.ps1` scripts to restore dependencies for each tools

# Adding some tests dependencies

## Python

- Use `uv add` to add the deps to `pyproject.toml`, install related dependencies in the virtual environment and lock the versions in `uv.lock`.
  Example:
  ```
  cd tests
  uv add jupyter
  ```

## R

- Add the dependencies in `DESCRIPTION` file
- Run `renv::install(<package>)` to install the dependencies
- Run `renv::snapshot()` to lock the versions in `renv.lock`

## Julia

- Run Julia in the `tests/` project and add the dependencies
  Example:
  ```bash
  cd tests
  julia --project=.
  ```
  then in Julia console
  ```julia
  using Pkg
  Pkg.add("DataFrames")
  ```

# Updating test dependencies

- When `main` updates the test environment (`tests/renv.lock`, `tests/uv.lock`, `tests/Manifest.toml`, or the R / Python / Julia versions in `.github/workflows/test-smokes.yml`), backport the update to the current stable branch (e.g. `v1.10`) while it still receives patch releases, as its own PR (see `checklist-backport-a-pr.md`).
  - Patch releases are then tested against the same current R, Python, Julia and package versions users install.
  - CI caches are shared: the R cache key is built from the OS, the R version and the `tests/renv.lock` hash, and any branch can read caches saved on `main`. A stable branch with identical lock files gets cache hits; a diverged one does a slow cold restore on each PR.
