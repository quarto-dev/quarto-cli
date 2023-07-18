# Running tests for Quarto

The `tests/` folder is the place for everything related to testing of `quarto-cli`.

We run several type of tests

- Unit tests, located in `unit/` folder
- Integration tests, located in `integration/` folder
- smoke tests localed in `smoke` folder

Tests are run in our CI workflow on GHA at each commit, and for each PR.

## How the tests are created and organized ?

Tests are running through `Deno.test()` framework, adapted for our Quarto project and all written in Typescript. Infrastructure are in `tests.ts`, `tests.deps.ts` `verify.ts` and `utils.ts` which contains the helper functions that can be used.

- `unit/` and `integration/`, `smoke/`contain some `.ts` script representing each tests.
- `docs/` is a special folder containing of the necessary files and projects used for the tests.

## Running the tests locally

### Dependencies requirements

Here are what is expected in the environment for the tests :

- R should be installed and in PATH
  - On Windows, Rtools should be to (for source package) e.g `winget install --id RProject.Rtools`
- Python should be installed and in PATH
  - On Windows, one can use [`pyenv-win`](https://pyenv-win.github.io/pyenv-win/) to manage version or install from https://www.python.org/ manually or using `winget`.
- Julia should be installed and in PATH
  - On Windows, one way is using `winget install --id Julialang.Julia` and then add `%LOCALAPPDATA%/Programs/Julia/bin` to PATH

Running tests require to have a local environment setup with Quarto development, TinyTeX, R, Python and Julia.

To help with this configuration, the `tests/` folder contains `configure-test-env.sh` and `configure-test-env.ps1`. It will check for the tools and update the dependencies to what is used by Quarto tests.
Running the script at least one will insure you are correctly setup. Then, it is run as part of running the tests so that dependencies are always updated. Set `QUARTO_TESTS_NO_CONFIG` to skip this step when running tests.

Dependencies are managed using the following tools:

#### R

We use [**renv**](https://rstudio.github.io/renv/). `renv.lock` and `renv/` folders are the files used to recreate the environment for R.

Updating `renv.lock` is done using `renv::snapshot()`. File shouldn't be modified manually.

See [documentation](https://rstudio.github.io/renv/) if you need to tweak the R environment.

#### Python

We use [**pipenv**](https://pipenv.pypa.io/en/latest/) to manage dependencies and recreate easily on all OS. `pipenv` will be installed as part of the configuration if not already.
A virtual environment will be created locally in `.venv` folder (ignored on git) and activated when running tests. `pipenv run` and `pipenv shell` can help activating the environment outside of running tests.

`Pipfile` contains our requirement for the tests project. It can be manually updated but it is best to just use `pipenv` commands. For instance, adding a new dependency can be done with `pipenv install plotly` and it will update the file.
It will also update the `Pipfile.lock` - this file should never be updated manually.

See other [`pipenv` command](https://pipenv.pypa.io/en/latest/#basic-commands-and-concepts) if you need to tweak the python environment.

#### Julia

Julia uses built-in package manager [**Pkg.jl**](https://pkgdocs.julialang.org/v1/)- we provide `Project.toml` and `Manifest.toml` to recreate the environment.

`Project.toml` contains our direct dependency and `Manifest.toml` is the lock file that will be created (`Pkg.resolve()`).

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

#### Prevent configuration for dependencies (R, Julia, Python, ...)

Those files will run `configure-test-env` scripts to check for requirements and set up dependencies (except on Github Action as this is done in the workflow file directly).
You can prevent test configuration locally by setting `QUARTO_TESTS_NO_CONFIG` environment variable to a non-empty value.

```bash
QUARTO_TESTS_NO_CONFIG="true" ./run-tests.sh
```

```powershell
$env:QUARTO_TESTS_NO_CONFIG=$true
./run-tests.ps1
```

#### About smoke-all tests

`docs/smoke-all/` is a specific folder to run some tests written directly within `.qmd` or `.ipynb` files. They are run through the `smoke/smoke-all.tests.ts` script. To ease running smoke-all tests, `run-tests.sh` has a special behavior where it will run `./smoke/smoke-all.tests.ts` when passed a `.qmd` or `.ipynb` file.

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
> Running tests with "C:\Users\chris\Documents\DEV_R\quarto-cli\package\dist\bin\tools\deno.exe test --config test-conf.json --unstable --allow-read --allow-write --allow-run --allow-env --allow-net --check --importmap=C:\Users\chris\Documents\DEV_R\quarto-cli\src\dev_import_map.json smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd"
running 1 test from ./smoke/smoke-all.test.ts
[smoke] > quarto render docs\smoke-all\2023\01\04\issue-3847.qmd --to html ...
------- output -------
[verify] > No Errors or Warnings
----- output end -----
[smoke] > quarto render docs\smoke-all\2023\01\04\issue-3847.qmd --to html ... ok (650ms)

ok | 1 passed | 0 failed (2s)
```

</details>

### Limitations

- `smoke-all.test.ts` accept only one argument. You need to use glob pattern to run several smoke-all test documents.

- Individual `smoke-all` tests and other test can't be run at the same time with `run-test.[sh|ps1]`. This is because `smoke-all.test.ts` requires arguments. If a smoke-all document and another smoke-test are passed as argument, the smoke-all test will be prioritize and other will be ignored (with a warning).

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

## Debugging within tests

`.vscode/launch.json` has a `Run Quarto test` configuration that can be used to debug when running tests. One need to modify the `program` and `args` fields to match the test to run.

Example:

```json
"program": "smoke/smoke-all.test.ts", // test script here
"args": ["--", "tests/docs/smoke-all/2023/01/04/issue-3847.qmd"], // args to the script here, like in command line smoke/smoke-all.test.t -- .\docs\smoke-all\2023\01\19\2107.qmd
```

_Short version can't be use here as we are calling `deno test` directly and not `run-tests.sh` script._

## Parallel testing

**Linux only**

This lives in `run-parallel-tests.ts` and called through `run-parallel-tests.sh`.

### How does is works ?

- It requires a text file with tested timed and following a specific format. (Default is `timing.txt` and here is an example [in our repo](./timing.txt))
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
- When `smoke-all.test.ts` is found, all the `*.qmd` and `*.ipynb` in `docs/smoke-all/` are found and run individually using same logic. This means each `smoke-all` test is timed.

The results is written in the `$QUARTO_TEST_TIMING` file. Here is an example:

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

`smoke-all` tests are special because they are in the form of individual `.qmd` or `.ipynb` document that needs to be run using `smoke-all.test.ts` script, with arguments. Unfortunately, this prevent running individual `smoke-all` documents in same buclets as other individual smoke test (which are their own `.test.ts` file).

So, if the timed file contains some individual timing for `smoke-all` documents like this

```
./smoke/smoke-all.test.ts -- docs/smoke-all/2022/12/12/code-annotation.qmd
```

then they are ignored and `.smoke-all.test.ts` will be run in its own bucket. It will usually be the longest test run.

Individual `smoke-all` tests timing are useful for Quarto parallelized smoke tests on GHA CI as the buckets are split into their own runners and each test in a bucket if run using `run-test.sh`. This allows a bucket to contains some `*.test.ts` but also some document `*.qmd` or `*.ipynb`. More details in [test-smoke.yml](.github/workflows/test-smokes.yml) and [test-smokes-parallel.yml](.github/workflows/test-smokes-parallel.yml)

### Arguments that control behavior

- `-n=`: Number of buckets to create to run in parallel. `run-parallel-tests.sh -n=5` split tests in 5 buckets and run them at the same time. For local run, `n` should be a number of core. For CI run, `n` will be the number of runners to use at the same time (mulplied by 2 because Linux and Windows are ran on CI).
- `--verbose`: show some verbosity. Otherwise, no specific logging in console in done.
- `--dry-run`: show the buckets of tests, but do not run. Otherwise, they are run.
- `--timing-file=`: Which file to use as timed tests information to creates the buckets. (default to `timing.txt` ). `run-parallel-tests.sh --timing-file='timing2.txt'` will use `timing2.txt` to run the file.
- `--json-for-ci`: Special flag to trigger splitting tests in buckets for the parallel run on CI and that makes `run-parallel-tests.sh` outputs JSON string specifically formatted for GHA processing.

### About tests in CI with GHA

- `test-smokes-parallel.yml` will be triggered to load `timing-for-ci.txt` and split tests in buckets. It will create a matrix to trigger `test-smokes.yml` on `workflow_call` event for each bucket.
  - PR against main and commits to main will trigger this workflow, and tests will be ran in parallel jobs.
  - A `workflow_dispatch` event can be used to trigger it through API call, `gh` CLI tool or GHA GUI online.
- `test-smokes.yml` is the main CI workflow which configure the environment, and run the tests on Ubuntu and Windows.
  - If it was triggerred by `workflow_call`, then it will run each test in using `run-tests.[sh|ps1]` in a for-loop.
  - Scheduled tests are still run daily in their sequential version.
