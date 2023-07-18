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

`docs/smoke-all/` is a specific folder to run some tests written directly within `.qmd` or `.ipynb` files. They are run through the `smoke/smoke-all.tests.ts` script. To ease running smoke-all tests, `run-tests.sh` has a special behavior where it will run `./smoke/smoke-all.tests.ts` when passed a `.qmd` or `.ipynb` file

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

## Debugging within tests

`.vscode/launch.json` has a `Run Quarto test` configuration that can be used to debug when running tests. One need to modify the `program` and `args` fields to match the test to run.

Example:

```json
"program": "smoke/smoke-all.test.ts", // test script here
"args": ["--", "tests/docs/smoke-all/2023/01/04/issue-3847.qmd"], // args to the script here, like in command line smoke/smoke-all.test.t -- .\docs\smoke-all\2023\01\19\2107.qmd
```

_Short version can't be use here as we are calling `deno test` directly and not `run-tests.sh` script._

## Parallel testing

**WIP**

This lives in `run-parallel-tests.ts` and called through `run-parallel-tests.sh`.

```

```
