## Lua code coverage

To generate a code coverage report for the Lua codebase under the test suite,
run the following commands:

```bash
cd quarto-cli/tests
./run-tests-with-luacov.sh
```

The report is an HTML file, and will be under `docs/luacov/luacov.report.html`.
Open that with a web browser to see the report.

The report.qmd file itself is useless; but we need the code coverage report to
run under the same Lua environment as the tests, so we need to run it through
Quarto.

If you want to check that a particular test case adds coverage, simply
don't delete the `luacov.stats.out` file, and run the test case with
`./run-tests.sh <testcase>`. This will append the coverage for that test.
Then run the `quarto render` command above to generate the report.
