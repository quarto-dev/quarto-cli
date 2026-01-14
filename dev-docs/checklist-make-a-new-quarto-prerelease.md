- [ ] ensure main is up to date and tests are passing on latest commit.
- [ ] create new prerelease installers
  - Click Actions -> Build Installers -> "Run Workflow" Dropdown Menu
    - Select the main branch in the "Use workflow from..." dropdown
    - Check "Pre-release" (or ensure it's checked)
    - Check "Publish release" (or ensure it's checked)
    - [ ] Click "Run Workflow"
      - If workflow fails for some reason, re-run all jobs and not only failed jobs or trigger a new clean build from Actions -> Build Installers -> "Run Workflow" Dropdown Menu.
        This is important because workflow commit an update to version.txt to main, and revert if cancelled or failure. A triggering a new workflow needs to re-run the configure step.
- If everything went well:
  - New release prerelease should be on Github at <https://github.com/quarto-dev/quarto-cli/releases>
  - A new tag should be on main for the new prerelease version
  - `version.txt` on main should have been updated by the workflow to the pre-release version just released: https://github.com/quarto-dev/quarto-cli/blob/main/version.txt

Note: Cloudsmith publishing is skipped for prereleases (only runs for stable releases).
