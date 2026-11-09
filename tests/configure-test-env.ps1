# Check R environment ---
Write-Host -ForegroundColor green ">>>> Configuring R environment"
try { $null = gcm rig -ea stop; $rig=$true } catch {
  Write-Host -ForegroundColor red "No rig found in PATH - the R test environment is a rig project (rproj.toml). Install rig 0.11.1 or later: https://github.com/r-lib/rig"
}

If ($rig) {
  # In admin mode rig proj sync installs a missing R by re-running itself
  # elevated, which leaves the project library owned by the admin account.
  # Install R separately (rig add does nothing when it is already installed),
  # then sync as this user.
  $rLockVersion = (Select-String -Path rproj.lock -Pattern '^r_version = "(.+)"' | Select-Object -First 1).Matches[0].Groups[1].Value
  Write-Host -ForegroundColor green "   > Installing R $rLockVersion if missing"
  rig add $rLockVersion
  If ($LASTEXITCODE -eq 0) {
    Write-Host -ForegroundColor green "   > Syncing R packages from rproj.lock"
    rig proj sync --no-install-r
  }
  If ($LASTEXITCODE -ne 0) {
    Write-Host -ForegroundColor red "Installing R or rig proj sync failed - R tests will run without the locked packages"
  } Else {
    # Installs on top of the lock must target the project library and the
    # exact R the sync used; rig's default is the default R's user library.
    $rVersion = (Select-String -Path .rvenv/rvenv.cfg -Pattern '^r-version = (.+)$').Matches[0].Groups[1].Value.Trim()
    $rLib = (Resolve-Path .rvenv/lib).Path
    Write-Host -ForegroundColor green "   > Installing dev knitr and rmarkdown"
    foreach ($dev in @(@('rmarkdown', 'https://rstudio.r-universe.dev'), @('knitr', 'https://yihui.r-universe.dev'))) {
      rig pkg install --r-version $rVersion --library $rLib --with-repos $dev[1] $dev[0]
      If ($LASTEXITCODE -ne 0) {
        Write-Host -ForegroundColor yellow "Dev $($dev[0]) not installed - tests use the locked version"
      }
    }
  }
}

# Check python test environment ---
Write-Host -ForegroundColor green ">>>> Configuring python environment"
try { $null = gcm uv -ea stop; $uv=$true } catch { 
  Write-Host -ForegroundColor red "No uv found in PATH - Install uv please: https://docs.astral.sh/uv/getting-started/installation/"
}

If ($uv) {
    Write-Host "Setting up python environnement with uv"
    # install from lockfile
    uv sync --frozen
}

# Check Julia environment --- 
Write-Host -ForegroundColor green ">>>> Configuring Julia environment"
try {$null = gcm julia -ea stop; $julia=$true } catch {
  Write-Host -ForegroundColor red "No julia found in PATH - Check your PATH or install Julia and add to PATH."
}

If ($julia) {
  # TODO: Check to do equivalent of virtualenv
  Write-Host "Setting up Julia environment"
  uv run --frozen julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("""IJulia"""); Pkg.precompile()'
}

# Check TinyTeX
Write-Host -ForegroundColor green ">>>> Configuring TinyTeX environment"
If ([string]::IsNullOrEmpty($env:GH_TOKEN)) {
  try { $null = gcm gh -ea stop ; $ghtoken=$(gh auth token) } catch {}
  If (-not ([string]::IsNullOrEmpty($ghtoken))) {
    $env:GH_TOKEN=$ghtoken
    Write-Host "Setting GH_TOKEN env var for Github Download."
  }
}
quarto install tinytex

# Check for veraPDF (and Java) as the tool is required for PDF standard validation tests
Write-Host -ForegroundColor green ">>>> Checking Java for veraPDF"
try { $null = gcm java -ea stop; $java=$true } catch {
  Write-Host -ForegroundColor red "No java found in PATH - veraPDF requires Java to be installed."
  Write-Host -ForegroundColor red "Install Java and add to PATH if you need PDF standard validation tests."
  Write-Host -ForegroundColor red "See: https://www.java.com/en/download/"
}

If ($java) {
  $javaVersion = java -version 2>&1 | Select-Object -First 1
  Write-Host "Java found: $javaVersion"
}

Write-Host -ForegroundColor green ">>>> Installing veraPDF for PDF standard validation"
If ($java) {
  quarto install verapdf
} Else {
  Write-Host -ForegroundColor yellow "Skipping veraPDF installation (Java not found)"
}

# Check Node.js and npm ---
Write-Host -ForegroundColor green ">>>> Configuring npm for MECA testing environment"
try {$null = gcm node -ea stop; $node_exists=$true } catch {
  Write-Host -ForegroundColor red "No node found - will skip any tests that require npm (e.g. JATS / MECA validation)"
}
try {$null = gcm npm -ea stop; $npm_exists=$true } catch {
  Write-Host -ForegroundColor red "No npm found - npm is required but node is present"
}

If ($node_exists) {
  If ($npm_exists) {
    # Check Node.js version
    $nodeVersionFull = node -v
    $nodeVersion = [int]($nodeVersionFull -replace 'v(\d+)\..*','$1')
    Write-Host "Node.js version: $nodeVersionFull"
    If ($nodeVersion -lt 18) {
      Write-Host -ForegroundColor yellow "Warning: Node.js version $nodeVersion is older than recommended (18+)"
      Write-Host -ForegroundColor yellow "Some tests may fail. Consider upgrading Node.js."
    }
    Write-Host "Setting up npm testing environment"
    npm install -g meca --loglevel=error --no-audit
  }
}

# Setup Playwright for browser testing ---
Write-Host -ForegroundColor green ">>>> Configuring Playwright for integration tests"
If ($npm_exists) {
  Write-Host "Installing Playwright dependencies..."
  Push-Location integration/playwright
  npm install --loglevel=error --no-audit
  # Install multiplex server dependencies
  Write-Host "Installing multiplex server dependencies..."
  Push-Location multiplex-server
  npm install --loglevel=error --no-audit
  Pop-Location
  # On Windows, npx playwright install --with-deps works without admin rights
  Write-Host "Installing Playwright browsers..."
  npx playwright install --with-deps
  Pop-Location
  Write-Host "Playwright browsers installed."
} Else {
  Write-Host -ForegroundColor yellow "Skipping Playwright setup (npm not found)"
}

# Other tests dependencies
Write-Host -ForegroundColor green ">>>> Checking pdftotext from poppler"
try {$null = gcm pdftotext -ea stop; $pdftotext=$true } catch {
  Write-Host -ForegroundColor red "No pdftotext found - Some tests requires `pdftotext` from poppler to be on PATH"
  try {$null = gcm scoop -ea stop; $scoop=$true } catch {
    Write-Host -ForegroundColor red "No scoop found - Scoop is a package manager for Windows - see https://scoop.sh/ and it can install poppler"
  }
  If($scoop) {
    Write-Host -ForegroundColor green "Scoop is found so trying to install poppler for pdftotext"
    scoop install poppler
  }
}

# Check rsvg-convert for SVG conversion ---
Write-Host -ForegroundColor green ">>>> Checking rsvg-convert from librsvg"
try {$null = gcm rsvg-convert -ea stop; $rsvg=$true } catch {
  Write-Host -ForegroundColor red "No rsvg-convert found - Some PDF tests with SVG images will be skipped."
  Write-Host -ForegroundColor yellow "Install librsvg to enable SVG to PDF conversion tests:"
  try {$null = gcm scoop -ea stop; $scoop=$true } catch {}
  If($scoop) {
    Write-Host -ForegroundColor green "Scoop is found, trying to install librsvg"
    scoop install librsvg
  } Else {
    Write-Host -ForegroundColor red "Consider installing scoop (https://scoop.sh/) to easily install librsvg"
  }
}