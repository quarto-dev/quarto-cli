- [ ] ensure tests pass on stable branch
  - Actions -> Parallel Smokes Tests -> Run Workflow ->
    - Select the current stable branch in the "Use workflow from... v1.x" dropdown
    - [ ] Click "Run Workflow"
- [ ] create new stable installers
  - Click Actions -> Build Installers -> "Run Workflow" Dropdown Menu
    - Select the current stable branch in the "Use workflow from..." dropdown
    - Uncheck "Pre-release" (or ensure it's unchecked)
    - Check "Publish release" (or ensure it's checked)
    - [ ] Click "Run Workflow"
    - Take a sip of tea ☕, bask in the glory of automation.
- [ ] Trigger update for quarto.org website once new stable release is available
  - Go to quarto-dev/quarto-web repo in [Update Downloads](https://github.com/quarto-dev/quarto-web/actions/workflows/update-downloads.yml) workflow
  - Run the workflow with 'Run Workflow' button on `main` branch.
    This will check the new release, and update the files in quarto-web to update the Download page.
  - While this automation is running, update the release on pypi below.
- [ ] update release on pypi repo
  - Goto the [quarto-cli-pypi repo](https://github.com/quarto-dev/quarto-cli-pypi)
  - Update `version.txt` to be the version you'd like to publish and commit
  - Go to actions
    - Select 'Publish Quarto PyPi'
    - [ ] Click "Run Workflow"
      - **Publishing Test**: You may elect to publish to test.pypi first by _unchecking_ the `Production Release` option
        - Once complete, test using
          ```bash
          python3 -m pip install --index-url https://test.pypi.org/ --extra-index-url https://pypi.org/ quarto-cli
          ```
        - You may have to run this command twice as the first time may report the package not found and cause cache invalidation. The next try should succeed.
        - Published to: <https://test.pypi.org/project/quarto-cli/>
      - **Publishing Production**: You may elect to publish to production pypyi by checking the `Production Release` option
        - Published to: <https://pypi.org/project/quarto-cli/>
    - Take a sip of tea ☕, bask in the glory of automation.
- [ ] If quarto.org download page is updated with the new stable release, trigger a stable release deploy to Chocolatey.
  - Got to <https://github.com/quarto-dev/quarto-release-bundles/actions/workflows/build-and-publish-choco.yaml>
  - In the "Build Choco package & Publish" workflow, click "Run Workflow" and be sure to check the "Whether to publish or not the package on chocolatey" checkbox
  - Wait for @cderv to receive email confirmation, no action needed.
- [ ] Update the stable changelog by moving entries to the "in previous release". Use "[release checklist]" in the commit message to make it easier to spot if a new release is needed next month.
