# Check R environment ---
Write-Host -ForegroundColor green ">>>> Configuring R environment"
try { $null = gcm Rscript -ea stop; $r=$true} catch { 
  Write-Host -ForegroundColor red "No Rscript found in PATH - Check your PATH or install R and add to PATH"
}

If ($r) {
  Write-Host -ForegroundColor green "   > Restoring renv project"
  Rscript -e 'renv::restore()'
  Write-Host -ForegroundColor green "   > Installing dev knitr and rmarkdown"
  Rscript -e "install.packages('rmarkdown', repos = c('https://rstudio.r-universe.dev'))"
  Rscript -e "install.packages('knitr', repos = c('https://yihui.r-universe.dev'))"
}

# Check python test environment ---
Write-Host -ForegroundColor green ">>>> Configuring python environment"
try { $null = gcm py -ea stop; $py=$true} catch { 
  Write-Host -ForegroundColor red "Missing Python launcher - py.exe is required on Windows - it should be installed with Python for Windows."
}

try { $null = gcm python -ea stop; $python=$true } catch { 
  Write-Host -ForegroundColor red "No python found in PATH - Check your PATH or install python add to PATH."
}

If ( $py -and $python) {
    Write-Host "Setting up python environnement with uv"
    try { $null = gcm uv -ea stop; $uv=$true } catch { 
      Write-Host -ForegroundColor red "No uv found in PATH - Install uv please: https://docs.astral.sh/uv/getting-started/installation/"
    }
    # install from lockfile
    uv sync --frozen
    $uv=$true
}

# Check Julia environment --- 
Write-Host -ForegroundColor green ">>>> Configuring Julia environment"
try {$null = gcm julia -ea stop; $julia=$true } catch {
  Write-Host -ForegroundColor red "No julia found in PATH - Check your PATH or install Julia and add to PATH."
}

If ($julia) {
  # TODO: Check to do equivalent of virtualenv
  Write-Host "Setting up Julia environment"
  julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("IJulia"); Pkg.precompile()'
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

# Get npm in place
Write-Host -ForegroundColor green ">>>> Configuring npm for MECA testing environment"
try {$null = gcm npm -ea stop; $npm_exists=$true } catch {
  Write-Host -ForegroundColor red "No npm found - will skip any tests that require npm (e.g. JATS / MECA validation)"
}
If ($npm_exists) {
  # TODO: Check to do equivalent of virtualenv
  Write-Host "Setting up npm testing environment"
  npm install -g meca
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