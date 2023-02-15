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

### Requirement

Running tests require to have a local environment setup with Quarto development, TinyTeX, R, Python and Julia.

To help with this configuration, the `tests/` folder contains `configure-test-env.sh` and `configure-test-env.ps1`. It will check for the tools and update the dependencies to what is used by Quarto tests.

To manage dependencies:

- For R, we use **renv** - `renv.lock` and `renv/` folders are the files used to recreate the environment for R. The package will be installed if not already.
- For Python, we use `pipenv` to manage dependencies and recreate easily on all OS. `pipenv` will be installed if not already.
- Julia uses built-in package manager - we provide `Projec.toml` and `Manifest.toml` to recreate the environment.

### How-to

Tests are run using `run-tests.sh` on UNIX, and `run-tests.ps1` on Windows

**IMPORTANT: This command must be run in a shell where Python virtual environment is activated**.
To do that, run:

```
pipenv shell
```

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

- `docs/smoke-all/` is a specific folder to run some tests written directly within `.qmd` or `.ipynb` files. They are run through the `smoke/smoke-all.tests.ts`

```bash
# run tests for all documents in docs/smoke-all/
./run-tests.sh smoke/smoke-all.tests.ts

# run tests for some `.qmd` document in a specific place (using glob)
./run-tests.sh smoke/smoke-all.test.ts -- docs/smoke-all/2022/**/*.qmd

# run test for a specific document
./run-tests.sh smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd
```

```powershell
# run tests for all documents in docs/smoke-all/
./run-tests.ps1 smoke/smoke-all.tests.ts

# run tests for some `.qmd` document in a specific place (using glob)
./run-tests.ps1 smoke/smoke-all.test.ts -- docs/smoke-all/2022/**/*.qmd

# run test for a specific document
./run-tests.ps1 smoke/smoke-all.test.ts -- docs/smoke-all/2023/01/04/issue-3847.qmd
```

## Debugging within tests

`.vscode/launch.json` has a `Run Quarto test` configuration that can be used to debug when running tests. One need to modify the `program` and `args` fields to match the test to run.

Example:

```json
"program": "smoke/smoke-all.test.ts", // test script here
"args": ["--", "tests/docs/smoke-all/2023/01/04/issue-3847.qmd"], // args to the script here, like in command line smoke/smoke-all.test.t -- .\docs\smoke-all\2023\01\19\2107.qmd
```

## Parallel testing

**WIP**

This lives in `run-parallel-tests.ts` and called through `run-parallel-tests.sh`.
