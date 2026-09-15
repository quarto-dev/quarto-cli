# Running tests for Quarto

The `tests/` folder is the place for everything related to testing of `quarto-cli`.

We run several type of tests

- Unit tests, located in `unit/` folder
- Integration tests, located in `integration/` folder
- smoke tests located in `smoke` folder

Tests are run in our CI workflow on GHA at each commit, and for each PR.

## How the tests are created and organized ?

Tests use the `Deno.test()` framework with Quarto-specific helpers.
The test infrastructure is in `test.ts`, `test-deps.ts`, `quarto-cmd.ts`, `verify.ts`, and `utils.ts`.

- `unit/` and `integration/`, `smoke/`contain some `.ts` script representing each tests.
- `docs/` is a special folder containing of the necessary files and projects used for the tests.

## Running the tests locally

### Dependencies requirements

Here are what is expected in the environment for the tests :

- R should be installed and on `PATH`. [**rig**](https://github.com/r-lib/rig) can manage R versions.
  For example, run `rig install 4.4.2` and `rig default 4.4.2`.
  - On Windows, Rtools should be too (for source package installation)
- Python should be installed and in PATH - [**pyenv**](https://github.com/pyenv/pyenv) is a good option to manage Python versions.
  - On Windows, use [`pyenv-win`](https://pyenv-win.github.io/pyenv-win/), install Python from <https://www.python.org/>, or use `winget`.
- Julia should be installed and in PATH - [**juliaup**](https://github.com/JuliaLang/juliaup) is a good option to manage Julia versions.
  - On Windows, one way is using `winget install julia -s msstore` and then add `%LOCALAPPDATA%/Programs/Julia/bin` to PATH

Running tests require to have a local environment setup with Quarto development, TinyTeX, R, Python and Julia.

The `tests/` folder contains `configure-test-env.sh` and `configure-test-env.ps1`.
These scripts check the required tools and synchronize test dependencies.
Run the appropriate script at least once. It also runs before tests by default.
Set `QUARTO_TESTS_NO_CONFIG` to skip this step when running tests.

#### Optional test dependencies

The configure scripts also check for optional tools that some tests require.
Tests will gracefully skip when these tools are not available, but having them installed enables full test coverage:

**Java** (version 8, 11, 17, or 21)

- Required for: PDF standard validation tests using veraPDF
- The script will install veraPDF automatically if Java is found using `quarto install verapdf`

**Node.js** (version 18 or later) and **npm**

- Required for: Playwright integration tests and JATS/MECA validation
- Installation: Download from https://nodejs.org/ or use a version manager like nvm
- The script will:
  - Check Node.js version and warn if < 18
  - Install the `meca` package globally for MECA validation
  - Install Playwright and its dependencies
  - Set up the multiplex server for Playwright tests
  - Install Playwright browsers (Chrome, Firefox, etc.)

**pdftotext** (from poppler)

- Required for: Some PDF text extraction tests
- Installation:
  - Ubuntu/Debian: `sudo apt-get install poppler-utils`
  - macOS: `brew install poppler`
  - Windows: `scoop install poppler` (auto-installed if Scoop is available)

**rsvg-convert** (from librsvg)

- Required for: PDF tests with SVG image conversion
- Installation:
  - Ubuntu/Debian: `sudo apt-get install librsvg2-bin`
  - macOS: `brew install librsvg`
  - Windows: `scoop install librsvg` (auto-installed if Scoop is available)

On Windows, the scripts will attempt to auto-install poppler and librsvg via Scoop if it's available on your system.

Dependencies are managed using the following tools:

#### R

We use [**renv**](https://rstudio.github.io/renv/).
The `renv.lock` file and `renv/` folder define the R environment.

Updating `renv.lock` is done using `renv::snapshot()`.
Do not modify the file manually.

The test project uses [explicit dependency discovery](https://rstudio.github.io/renv/reference/dependencies.html?q=dependen#explicit-dependencies) through a `DESCRIPTION` file.
This avoids scanning every file under `tests/` for R dependencies.
To add an R package dependency:

- Add package(s) to `DESCRIPTION` in `tests/`
- `renv::install()` the package into the project library
- Finish to work on your test
- `renv::snapshot()` to record the new dependency in the `renv.lock`
- Commit the new `DESCRIPTION` and `renv.lock`

See [documentation](https://rstudio.github.io/renv/) if you need to tweak the R environment.

After a dependency update, you can run `configure-test-env.sh` or `configure-test-env.ps1` to update the environment, or manually run `renv::restore()` to recreate the environment with new versions.
Be sure to update your R version if needed.

#### Python

We use [**uv**](https://docs.astral.sh/uv) to manage Python and its test dependencies on all platforms.
Install `uv` separately by following its [installation instructions](https://docs.astral.sh/uv/getting-started/installation/).

`uv` installs the Python version specified in `tests/.python-version` and manages the `.venv` virtual environment.

The test scripts activate the local `.venv`, which Git ignores.
Use `uv run` to run other commands in that environment.

`pyproject.toml` defines the test project's Python dependencies.
Use commands such as `uv add plotly` to update `pyproject.toml`, update `uv.lock`, and install the package.
Do not edit `uv.lock` manually. Git tracks it so local and CI environments use the same dependency versions.

See other [`uv` command](https://docs.astral.sh/uv/getting-started/features/) if you need to do more.

To change the Python version, update `.python-version`.
The `configure-test-env` script runs `uv sync` when `uv` is installed.

Note that `./run-test.ps1` and `.run-tests.sh` :

- run `configure-test-env` script by default, unless `QUARTO_TESTS_NO_CONFIG` environment variable is set to a non-empty value.
- Activate the local virtual environment in `.venv`.
  Set `QUARTO_TESTS_FORCE_NO_VENV` to a non-empty value to prevent this behavior.
  The deprecated `QUARTO_TESTS_FORCE_NO_PIPENV` variable remains supported for compatibility.

#### Julia

Julia uses built-in package manager [**Pkg.jl**](https://pkgdocs.julialang.org/v1/)- we provide `Project.toml` and `Manifest.toml` to recreate the environment.

`Project.toml` contains our direct dependency and `Manifest.toml` is the lock file that will be created (`Pkg.resolve()`).

**Important:** All test dependencies must be in the main `tests/` environment.
Julia searches UP the directory tree for `Project.toml` starting from the document being rendered.

**Adding a new package dependency:**

```bash
cd tests
julia --project=. -e 'using Pkg; Pkg.add("PackageName")'
./configure-test-env.sh   # or .ps1 on Windows
```

**Do NOT create** local `Project.toml` files in test subdirectories (e.g., `tests/docs/*/Project.toml`).
Julia will use that environment instead of the main `tests/` environment.
The `configure-test-env` scripts only manage the main environment, so tests with local environments will fail in CI even if they work locally.

**Note:** This applies to ALL engines (Julia, Python, R).
Python and R will also use local `.venv/` or `renv.lock` if present.
The quarto-cli test infrastructure uses a single managed environment per language at `tests/`, and CI only configures these main environments.

See [documentation](https://pkgdocs.julialang.org/v1/managing-packages/) on how to add, remove, update if you need to tweak the Julia environment.

### How to run tests locally ?

Tests are run using `run-tests.sh` on UNIX, and `run-tests.ps1` on Windows.

```bash
# run all tests
./run-tests.sh

# run a specific tests file
./run-tests.sh smoke/extensions/extension-render-doc.test.ts
```

```powershell
# run all tests
./run-tests.ps1

# run a specific tests file
./run-tests.ps1 smoke/extensions/extension-render-doc.test.ts
```

#### Test environment variables

The test scripts support several environment variables to control their behavior:

**QUARTO_TESTS_NO_CONFIG**
- Skip running `configure-test-env` scripts
- Useful for faster test runs when environment is already configured
- Tests will still activate `.venv` if present

```bash
QUARTO_TESTS_NO_CONFIG="true" ./run-tests.sh
```

```powershell
$env:QUARTO_TESTS_NO_CONFIG="true"
./run-tests.ps1
```

**QUARTO_TESTS_FORCE_NO_VENV** (replaces deprecated `QUARTO_TESTS_FORCE_NO_PIPENV`)
- Skip activating the `.venv` virtual environment
- Tests will use system Python packages instead of UV-managed dependencies
- Use with caution: Python tests may fail if dependencies aren't in system Python

```bash
QUARTO_TESTS_FORCE_NO_VENV="true" ./run-tests.sh
```

```powershell
$env:QUARTO_TESTS_FORCE_NO_VENV="true"
./run-tests.ps1
```

**Quick test runs with run-fast-tests scripts**

For convenience, `run-fast-tests.sh` and `run-fast-tests.ps1` are provided to skip environment configuration:

```bash
# Linux/macOS
./run-fast-tests.sh

# Windows
./run-fast-tests.ps1
```

These scripts set `QUARTO_TESTS_NO_CONFIG` automatically.
Use after running `configure-test-env` at least once.

**QUARTO_TEST_KEEP_OUTPUTS** (or use `--keep-outputs`/`-k` flag)
- Keep test output artifacts instead of cleaning them up
- Useful for debugging test failures or inspecting generated files
- Can be set via environment variable or command-line flag

```bash
# Using flag
./run-tests.sh --keep-outputs
./run-tests.sh -k

# Using environment variable
QUARTO_TEST_KEEP_OUTPUTS="true" ./run-tests.sh
```

```powershell
# Using flag
./run-tests.ps1 --keep-outputs
./run-tests.ps1 -k

# Using environment variable
$env:QUARTO_TEST_KEEP_OUTPUTS="true"
./run-tests.ps1
```

**Other environment variables**
- `QUARTO_TEST_VERBOSE` - Enable verbose test output
- `QUARTO_TESTS_NO_CHECK` - Not currently used (legacy variable)

#### About smoke-all tests

`docs/smoke-all/` contains tests defined in `.qmd`, `.md`, or `.ipynb` files. Files whose names start with `_` are ignored.
The `smoke/smoke-all.test.ts` script runs these tests.
When `run-tests.sh` receives a supported document path, it invokes that script automatically.

```bash
# run tests for all documents in docs/smoke-all/
./run-tests.sh smoke/smoke-all.tests.ts

# run tests for some `.qmd` document in a specific place (using glob)
./run-tests.sh docs/smoke-all/2022/**/*.qmd
# or using longer version
./run-tests.sh smoke/smoke-all.test.ts -- docs/smoke-all/2022/**/*.qmd

# run test for a specific document
./run-tests.sh docs/smoke-all/2023/01/04/issue-3847.qmd
# or using using longer version
./run-tests.sh smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd
```

<details><summary> Examples of tests output after it ran </summary>

```bash
$ ./run-tests.sh smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd
> Checking and configuring environment for tests
>>>> Configuring R environment
* The library is already synchronized with the lockfile.
>>>> Configuring Python environment
Setting up python environnement with pipenv
Installing dependencies from Pipfile.lock (0ded54)...
To activate this project's virtualenv, run pipenv shell.
Alternatively, run a command inside the virtualenv with pipenv run.
>>>> Configuring Julia environment
Setting up Julia environment
    Building Conda ─→ `~/.julia/scratchspaces/44cfe95a-1eb2-52ea-b672-e2afdf69b78f/e32a90da027ca45d84678b826fffd3110bb3fc90/build.log`
    Building IJulia → `~/.julia/scratchspaces/44cfe95a-1eb2-52ea-b672-e2afdf69b78f/59e19713542dd9dd02f31d59edbada69530d6a14/build.log`
>>>> Configuring TinyTeX environment
Setting GH_TOKEN env var for Github Download.
tinytex is already installed and up to date.
> Activating virtualenv for Python tests
Check file:///home/cderv/project/quarto-cli/tests/smoke/smoke-all.test.ts
running 1 test from ./smoke/smoke-all.test.ts
[smoke] > quarto render docs/smoke-all/2023/01/04/issue-3847.qmd --to html ...
------- output -------
[verify] > No Errors or Warnings
----- output end -----
[smoke] > quarto render docs/smoke-all/2023/01/04/issue-3847.qmd --to html ... ok (320ms)

ok | 1 passed | 0 failed (1s)

> Exiting virtualenv activated for tests
```

</details>

```powershell
# run tests for all documents in docs/smoke-all/
./run-tests.ps1 smoke/smoke-all.tests.ts

# run tests for some `.qmd` document in a specific place (using glob)
./run-tests.ps1 docs/smoke-all/2022/**/*.qmd
# Or using longer version
./run-tests.ps1 smoke/smoke-all.test.ts -- docs/smoke-all/2022/**/*.qmd

# run test for a specific document
./run-tests.ps1 docs/smoke-all/2023/01/04/issue-3847.qmd
# Or using longer version
./run-tests.ps1 smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd
```

<details><summary> Examples of tests output after it ran </summary>

```powershell
 ./run-tests.ps1 smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd
> Setting all the paths required...
> Checking and configuring environment for tests
>>>> Configuring R environment
* The library is already synchronized with the lockfile.
>>>> Configuring python environment
Setting up python environnement with pipenv
Installing dependencies from Pipfile.lock (0ded54)...
To activate this project's virtualenv, run pipenv shell.
Alternatively, run a command inside the virtualenv with pipenv run.
>>>> Configuring Julia environment
Setting up Julia environment
    Building Conda ─→ `C:\Users\chris\.julia\scratchspaces\44cfe95a-1eb2-52ea-b672-e2afdf69b78f\e32a90da027ca45d84678b826fffd3110bb3fc90\build.log`
    Building IJulia → `C:\Users\chris\.julia\scratchspaces\44cfe95a-1eb2-52ea-b672-e2afdf69b78f\59e19713542dd9dd02f31d59edbada69530d6a14\build.log`
>>>> Configuring TinyTeX environment
tinytex is already installed and up to date.
> Preparing running tests...
> Activating virtualenv for Python tests
> Running tests with "C:\Users\chris\Documents\DEV_R\quarto-cli\package\dist\bin\tools\deno.exe test --config test-conf.json --unstable-ffi --allow-read --allow-write --allow-run --allow-env --allow-net --check --importmap=C:\Users\chris\Documents\DEV_R\quarto-cli\src\dev_import_map.json smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd"
running 1 test from ./smoke/smoke-all.test.ts
[smoke] > quarto render docs\smoke-all\2023\01\04\issue-3847.qmd --to html ...
------- output -------
[verify] > No Errors or Warnings
----- output end -----
[smoke] > quarto render docs\smoke-all\2023\01\04\issue-3847.qmd --to html ... ok (650ms)

ok | 1 passed | 0 failed (2s)
```

</details>

##### Controlling test execution with metadata

Smoke-all tests support metadata in the `_quarto.tests.run` key to control when tests are run:

- Skip test unconditionally:

  ```yaml
  _quarto:
    tests:
      run:
        skip: true                                    # Skip with default message
        skip: "Reason for skipping this test"         # Skip with custom message
  ```

  Use this when a test needs to be temporarily disabled while an issue is being investigated,
  or when a test is pending an upstream fix. Include a descriptive message explaining why.

- Skip tests on CI:

  ```yaml
  _quarto:
    tests:
      run:
        ci: false
  ```

- Skip tests on specific operating systems (blacklist):

  ```yaml
  _quarto:
    tests:
      run:
        not_os: linux                # Don't run on Linux
        not_os: [linux, darwin]      # Don't run on Linux or macOS
        not_os: windows              # Don't run on Windows
  ```

- Run tests only on specific operating systems (whitelist):

  ```yaml
  _quarto:
    tests:
      run:
        os: darwin                   # Run only on macOS
        os: [windows, darwin]        # Run only on Windows or macOS
  ```

Valid OS values are: `linux`, `darwin` (macOS), `windows`

This is useful when tests require platform-specific dependencies or have known platform-specific issues that need separate investigation.

##### Snapshot testing

Use `ensureSnapshotMatches` to compare rendered output against a saved snapshot file:

```yaml
_quarto:
  tests:
    html:
      ensureSnapshotMatches: []
```

The snapshot file should be saved alongside the output with a `.snapshot` extension (e.g., `output.html.snapshot`).

When a snapshot test fails:

- A **unified diff** is displayed with colored output (red for removed, green for added)
- A **word-level diff** shows changes with surrounding context
- For **whitespace-only changes**, special markers visualize invisible characters:
  - `⏎` for newlines, `→` for tabs, `·` for spaces
- A `.diff` file is saved next to the output for later inspection
- The `.diff` file is automatically cleaned up when the snapshot passes

### Limitations

- `smoke-all.test.ts` accepts only one argument. Use a glob to run several smoke-all documents.

- A `smoke-all` document and another test cannot run in the same `run-tests.[sh|ps1]` invocation.
  The smoke-all document takes precedence, and the script warns that it ignored the other test.

Example with Linux:

You can do

```bash
# run all smoke-all tests and another smoke test
./run-tests.sh smoke/extensions/extension-render-doc.test.ts smoke/smoke-all.test.ts
# run tests for some `.qmd` document in a specific place (using glob)
./run-tests.sh docs/smoke-all/2022/**/*.qmd
```

Don't do

```bash
# run .qmd smoke-all test and another smoke test - smoke-all test will have the priority and other will be ignored (with a warning)
./run-test.sh smoke/extensions/extension-render-doc.test.ts ./docs/smoke-all/2023/01/04/issue-3847.qmd
# run smoke-all.test.ts with argument and another smoke test
./run-tests.sh smoke/extensions/extension-render-doc.test.ts smoke/smoke-all.test.ts -- ./docs/smoke-all/2023/01/04/issue-3847.qmd
```

### Binary mode (`QUARTO_TEST_BIN`)

Tests normally run Quarto in-process from the dev sources.
Set `QUARTO_TEST_BIN` to an installed Quarto to run commands against that binary instead.
See [Built-Version Testing Architecture](../llm-docs/built-version-testing-architecture.md) for the harness and CI design.

To run in binary mode locally:

```bash
# 1. Build a distribution (after ./configure.sh)
cd package/src
./quarto-bld prepare-dist --set-version "$(cat ../../version.txt)"
cd ../..

# 2. Copy the distribution outside the checkout. An in-repo launcher uses
#    the dev sources when it finds a sibling src/quarto.ts. The test scripts
#    reject that launcher because it reports the 99.9.9 dev version.
cp -r package/pkg-working ~/quarto-under-test

# 3. Run the tests against it
cd tests
QUARTO_TEST_BIN=~/quarto-under-test/bin/quarto ./run-tests.sh
```

In binary mode:

- With no arguments, `run-tests.[sh|ps1]` runs `smoke/`.
  Unit tests remain dev-only.
  Playwright and feature-format tests support binary mode but must be passed explicitly:

  ```bash
  # playwright suite against a built quarto
  QUARTO_TEST_BIN=~/quarto-under-test/bin/quarto ./run-tests.sh integration/playwright-tests.test.ts
  # feature-format matrix against a built quarto
  QUARTO_TEST_BIN=~/quarto-under-test/bin/quarto ./run-tests.sh "../dev-docs/feature-format-matrix/qmd-files/**/*.qmd"
  ```

- The test environment is configured as usual; set `QUARTO_TESTS_NO_CONFIG` to skip that step as in dev mode.
- Tests with `requiresDevQuarto: true` in their `TestContext` are ignored.

Authoring rules that keep tests working in both modes:

- Invoke Quarto through `testQuartoCmd()` or `runQuarto()`; do not import `quarto` from `src/quarto.ts`.
- For direct subprocesses, resolve the executable with `quartoDevCmd()` or `quartoDevBinCmd()` and pass `quartoSpawnEnvOptions()`.

## Debugging within tests

`.vscode/launch.json` has a `Run Quarto test` configuration.
Set its `program` and `args` fields for the test you want to debug.

Example:

```json
"program": "smoke/smoke-all.test.ts", // test script here
"args": ["--", "tests/docs/smoke-all/2023/01/04/issue-3847.qmd"], // args to the script here, like in command line smoke/smoke-all.test.t -- .\docs\smoke-all\2023\01\19\2107.qmd
```

_Short version can't be use here as we are calling `deno test` directly and not `run-tests.sh` script._

## Parallel testing

**Linux only**

This lives in `run-parallel-tests.ts` and called through `run-parallel-tests.sh`.

### How it works

- It requires a timing file in the format shown in [`timing.txt`](./timing.txt).
- Based on this file, the tests will be split in buckets to minimize the tests time (buckets are filled by their minimum overall time).
- Then `./run-tests.sh` will be run for each bucket from deno using `Promise.all()` and `run-tests.sh` on the whole bucket's test files, so that the buckets are ran in parallel.

This is a simple way to run all the tests or a subset of tests in parallel locally.

### About timed tests

To create a timed test file like `timing.txt`, this command needs to be run.

```bash
QUARTO_TEST_TIMING='timing.txt' ./run-tests.sh
```

When this is done, any other argument will be ignored, and the following happens

- All the `*.test.ts` file are found and run individually using `/usr/bin/time` to store timing in the file
- When `smoke-all.test.ts` is found, all the `*.qmd`, `*.md` and `*.ipynb` in `docs/smoke-all/` not starting with `_` are found and run individually using same logic.
  This means each `smoke-all` test is timed.

The results are written to the `$QUARTO_TEST_TIMING` file.
Here is an example:

```
./smoke/directives/include-fixups.test.ts
        0.02 real 0.02 user 0.00 sys
./smoke/filters/filters.test.ts
        3.26 real 3.79 user 0.47 sys
./smoke/filters/editor-support.test.ts
        0.72 real 0.58 user 0.14 sys
./smoke/engine/include-engine-detection.test.ts
        3.61 real 3.11 user 0.24 sys
./smoke/smoke-all.test.ts -- docs/smoke-all/2022/12/12/code-annotation.qmd
        4.81 real 4.32 user 0.33 sys
./smoke/smoke-all.test.ts -- docs/smoke-all/2022/12/9/jats/computations.out.ipynb
        2.22 real 2.83 user 0.27 sys
```

This will be read by `run-parallel-tests.ts` to get the `real` value and fill the bucket based on it.

#### Specific behavior for `smoke-all.test.ts`

Each `smoke-all` test is a `.qmd` or `.ipynb` document passed as an argument to `smoke-all.test.ts`.
The local parallel runner cannot place these documents in the same buckets as standalone `.test.ts` files.

So, if the timed file contains some individual timing for `smoke-all` documents like this

```
./smoke/smoke-all.test.ts -- docs/smoke-all/2022/12/12/code-annotation.qmd
```

then they are ignored and `.smoke-all.test.ts` will be run in its own bucket.
It will usually be the longest test run.

CI uses individual `smoke-all` timings when assigning tests to runner buckets. A CI bucket can contain both `*.test.ts` files and test documents.
See `test-smokes.yml` and `test-smokes-parallel.yml`.

### Arguments that control behavior

- `-n=`: Number of buckets to create to run in parallel.
  `run-parallel-tests.sh -n=5` creates five concurrent buckets.
  For local runs, use the number of available cores. In CI, this is the number of runners per operating system.
- `--verbose`: Show detailed console output.
- `--dry-run`: Show the buckets without running them.
- `--timing-file=`: Select the timing file. The default is `timing.txt`.
- `--json-for-ci`: Special flag to trigger splitting tests in buckets for the parallel run on CI and that makes `run-parallel-tests.sh` outputs JSON string specifically formatted for GHA processing.

### About tests in CI with GHA

- `test-smokes-parallel.yml` will be triggered to load `timing-for-ci.txt` and split tests in buckets. It will create a matrix to trigger `test-smokes.yml` on `workflow_call` event for each bucket.
  - PR against main and commits to main will trigger this workflow, and tests will be ran in parallel jobs.
  - A `workflow_dispatch` event can be used to trigger it through API call, `gh` CLI tool or GHA GUI online.
- `test-smokes.yml` is the main CI workflow for configuring the environment and running tests on Ubuntu and Windows.
  - When called through `workflow_call`, it runs each bucket with `run-tests.[sh|ps1]`.
  - Scheduled tests are still run daily in their sequential version.
  - Callers can use its install, version, artifact, ref, and runner inputs to test a built Quarto.
- `test-smokes-built.yml` runs smoke, Playwright, and feature-format legs
  against a built Quarto. It runs after nightly builds and supports manual
  dispatches:

  | Mode | Trigger | Use it to answer |
  |---|---|---|
  | `nightly` | automatic after create-release; dispatch with `run-id` to retest an older run | Does the packaged nightly build pass on each available OS? |
  | `build` | dispatch (default) | Does this ref work when packaged as a Linux amd64 distribution? |
  | `release` | dispatch | Does the published release pass? |

  Full rationale and design decisions: `llm-docs/built-version-testing-architecture.md`.
