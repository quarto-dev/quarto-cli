# Check python test environment ---

try { $null = gcm py -ea stop; $py=$true} catch { 
  Write-Host -ForegroundColor red "Missing Python launcher - py.exe is required on Windows"
}

try { $null = gcm python3 -ea stop; $python=$true } catch { 
  Write-Host -ForegroundColor red "No python found in PATH - Install python3"
}

If ( $py -and $python -and $env:VIRTUAL_ENV -eq $null) {
    Write-Host "Setting up virtual environment in .venv"
    python3 -m venv .venv
}

try {$null = gcm julia -ea stop; julia=$true } catch {
  Write-Host -ForegroundColor red "Missing Julia - An installation is required"
}

If ($julia) {
  # TODO: Check to do equivalent of virtualenv
  Write-Host "Setting up Julia global environment"
  julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("IJulia"); Pkg.precompile()'
}

