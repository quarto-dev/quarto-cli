# Composite Actions

Reusable steps shared across workflows in this repo. See also `.github/actions/` for another set of composite actions (historical split, no functional difference).

| Action | Purpose |
|--------|---------|
| [`amplitude`](amplitude/action.yml) | Sends an event to Amplitude. |
| [`archive`](archive/action.yml) | Archives a dependency binary to S3. |
| [`keychain`](keychain/action.yml) | Configures a P12 certificate into the keychain for signing. |
| [`pandoc-override`](pandoc-override/action.yml) | Installs a Pandoc release for smoke tests before S3 archival and selects it through `QUARTO_PANDOC`. |
| [`prevent-rerun`](prevent-rerun/action.yml) | Fails if the workflow is re-run (`github.run_attempt > 1`). |
| [`quarto-dev`](quarto-dev/action.yml) | Configures the image for Quarto development (runs `configure.sh`/`.cmd`). |
| [`sign-files`](sign-files/action.yml) | Installs and configures the environment to sign files. |
