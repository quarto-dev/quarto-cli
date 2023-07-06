# Check R environment ---
Write-Host -ForegroundColor green ">>>> Configuring R environment"
try { $null = gcm Rscript -ea stop; $r=$true} catch { 
  Write-Host -ForegroundColor red "No Rscript found in PATH - Check your PATH or install R and add to PATH"
}

If ($r) {
  Rscript -e "renv::restore()"
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
    Write-Host "Setting up python environnement with pipenv"
    try { $null = gcm pipenv -ea stop; $pipenv=$true } catch { 
      Write-Host -ForegroundColor red "No pipenv found in PATH - Installing pipenv running ``pip install pipenv``"
    }
    If ($null -eq $pipenv) {
      python -m pip install pipenv
      try { $null = gcm pyenv -ea stop; $pyenv=$true } catch { }
      If ($pyenv) {
        pyenv rehash
      }
    }
    # our default is pipenv to use its own virtualenv and be in project directory
    $Env:PIPENV_IGNORE_VIRTUALENVS=1
    $Env:PIPENV_VENV_IN_PROJECT=1
    pipenv install
    $pipenv=$true
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
try {$null = gcm npm -ea stop; $npm=$true } catch {
  Write-Host -ForegroundColor red "No npm found - will skip any tests that require npm (e.g. JATS / MECA validation)"
}
If ($npm_exists) {
  # TODO: Check to do equivalent of virtualenv
  Write-Host "Setting up npm testing environment"
  npm install -g meca
}