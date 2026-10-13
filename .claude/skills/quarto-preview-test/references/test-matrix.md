# Preview Test Matrix

The full test matrix lives in `tests/docs/manual/preview/README.md`. Test fixtures live
alongside it in `tests/docs/manual/preview/`.

## Running specific tests by ID

When invoked with test IDs (e.g., `/quarto-preview-test T17 T18`):

1. Read `tests/docs/manual/preview/README.md`
2. Find each requested test by its ID (e.g., `#### T17:`)
3. Parse the **Setup**, **Steps**, and **Expected** fields
4. Execute each test following the steps, using the fixtures in `tests/docs/manual/preview/`
5. Report PASS/FAIL for each test with the actual vs expected result

## Running tests by topic

When invoked with a topic description instead of IDs (e.g., `/quarto-preview-test root URL` or
"run preview tests for single-file"):

1. Read `tests/docs/manual/preview/README.md`
2. Search test titles and descriptions for matches (keywords, issue numbers, feature area)
3. Present the matched tests to the user for confirmation before running:
   ```
   Found these matching tests:
   - T17: Single-file preview — root URL accessible (#14298)
   - T18: Single-file preview — named output URL also accessible
   Run these? [Y/n]
   ```
4. Only execute after user confirms

## Running without arguments

When invoked without test IDs or topic (e.g., `/quarto-preview-test`), use the general
Edit-Verify Cycle workflow from `SKILL.md` for ad-hoc preview testing. The test matrix is for
targeted regression testing.
