#Requires -Version 7.0

# Determine the path to this script (we'll use this to figure out relative positions of other files)
$SOURCE = $MyInvocation.MyCommand.Path

# ------ Setting all the paths required

Write-Host "> Setting all the paths required..."

# Tests folder 
# e.g quarto-cli/tests folder
$SCRIPT_PATH = Split-Path -Path $SOURCE

# Project folder
# e.g quarto-cli project folder 
$QUARTO_ROOT = Split-Path $SCRIPT_PATH

# Source folder
# e.g quarto-cli/src folder
$QUARTO_SRC_DIR= Join-Path $QUARTO_ROOT "src"

# .sh version has source $SCRIPT_PATH/../package/scripts/common/utils.sh for configure.sh requirements
# but configure.cmd does not need it

# Quarto binary folder
# e.g quarto-cli/package/dist/bin
$QUARTO_BIN_PATH = Join-Path $QUARTO_ROOT "package" "dist" "bin"
# Deno binary in tools/
$QUARTO_DENO = Join-Path $QUARTO_BIN_PATH "tools" "x86_64" "deno.exe"

# Shared resource folder
# e.g quarto-cli/src/resources
$QUARTO_SHARE_PATH = Join-Path $QUARTO_ROOT "src" "resources"


# ----- Restoring tests environnment ---------

If ( $null -eq $Env:GITHUB_ACTION -and $null -eq $Env:QUARTO_TESTS_NO_CONFIG ) {
  Write-Host "> Checking and configuring environment for tests"
  . ./configure-test-env.ps1
}

# ----- Preparing running tests ------------


Write-Host "> Preparing running tests..."

# Exporting some variables with paths as env var required for running quarto
$Env:QUARTO_ROOT = $QUARTO_ROOT
$Env:QUARTO_BIN_PATH = $QUARTO_BIN_PATH
$Env:QUARTO_SHARE_PATH = $QUARTO_SHARE_PATH

# Activated debug mode by default for stack trace
$Env:QUARTO_DEBUG = "true" 

# Preparing running Deno with default arguments

$QUARTO_IMPORT_MAP_ARG="--importmap=$(Join-Path $QUARTO_SRC_DIR "import_map.json")"
$QUARTO_DENO_OPTIONS="--config test-conf.json --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192,--max-heap-size=8192 --unstable-kv --unstable-ffi --no-lock --allow-all --check"

# Parsing argument passed to the script

# We Don't use `param()` or `$args` - instead, we do our own argument parsing because
# PowerShell quietly strips -- from the list of arguments and `--` is need for Deno to pass argument to the script
# Code adapted from: https://stackoverflow.com/questions/56750826/how-to-use-dash-argument-in-powershell
if ( $MyInvocation.Line -eq "" ) {
  # when script is ran from a child process using -F
  # e.g pwsh -F ./run-tests.ps1 smoke/smoke-all.test.ts -- docs\smoke-all\2023\02\08\4272.qmd
  $customArgs = $MyInvocation.UnboundArguments
} elseif ($MyInvocation.Line -match "^[.] '[^']*'") {
  # when script is ran from a child process using -command
  # e.g pwsh -command ". 'run-tests.ps1' smoke/smoke-all.test.ts -- docs\smoke-all\2023\02\08\4272.qmd"
  # This is what happens on GHA when using 'run: |' and 'shell: pwsh'
  $argList = ($MyInvocation.Line -replace "^[.] '[^']*'\s*" -split '[;|]')[0].Trim()
  # Extract the argument list from the invocation command line.
  
  # Use Invoke-Expression with a Write-Output call to parse the raw argument list,
  # performing evaluation and splitting it into an array:
  $customArgs = $argList ? @(Invoke-Expression "Write-Output -- $argList") : @()    
} else {
  # When script is called from main process
  # e.g ./run-tests.ps1 smoke/smoke-all.test.ts -- docs\smoke-all\2023\02\08\4272.qmd
  $argList = ($MyInvocation.Line -replace ('^.*' + [regex]::Escape($MyInvocation.InvocationName)) -split '[;|]')[0].Trim()
  # Extract the argument list from the invocation command line.
  
  # Use Invoke-Expression with a Write-Output call to parse the raw argument list,
  # performing evaluation and splitting it into an array:
  $customArgs = $argList ? @(Invoke-Expression "Write-Output -- $argList") : @()    
}

## Short version syntax to run smoke-all.test.ts
## Only use if different than ./run-test.ps1 ./smoke/smoke-all.test.ts
If ($customArgs[0] -notlike "*smoke-all.test.ts") {
  
  $SMOKE_ALL_TEST_FILE="./smoke/smoke-all.test.ts"
  # Check file argument
  $SMOKE_ALL_FILES=@()
  $TESTS_TO_RUN=@()

  ForEach ($file in $customArgs) {
    $filename=$(Split-Path -Path $file -Leaf)
    If ($filename -match "^^[^_].*[.]qmd$" -Or $filename -match "^[^_].*[.]ipynb$" -Or $filename -match "^[^_].*[.]md$") {
      $SMOKE_ALL_FILES+=$file
    } elseif ($file -Like "*.ts") {
      $TESTS_TO_RUN+=$file
    } else {
      Write-Host -ForegroundColor red "#### ERROR"
      Write-Host -ForegroundColor red "Only .ts, or .qmd, .md and .ipynb passed to smoke-all.test.ts are accepted (file starting with _ are ignored)."
      Write-Host -ForegroundColor red "####"
      Exit 1
    }
  }

  If ($SMOKE_ALL_FILES.count -ne 0) {
    if ($TESTS_TO_RUN.count -ne 0) {
      Write-Host "#### WARNING"
      Write-Host "  When passing .qmd, .md and/or .ipynb, only ./smoke/smoke-all.test.ts will be run. Other tests files are ignored."
      Write-Host "  Ignoring $($TESTS_TO_RUN -join ' ')"
      Write-Host "####"
    }
    $TESTS_TO_RUN= @("${SMOKE_ALL_TEST_FILE}", "--") + $SMOKE_ALL_FILES
  }

} else {
  $TESTS_TO_RUN=$customArgs
}

# ---- Running tests with Deno -------

$DENO_ARGS = @()
$DENO_ARGS += "test"
$DENO_ARGS += -split $QUARTO_DENO_OPTIONS
# Allow to pass some more options - empty by default
If ($QUARTO_DENO_EXTRA_OPTIONS -ne $null) { 
  $DENO_ARGS += -split $QUARTO_DENO_EXTRA_OPTIONS
}
$DENO_ARGS += -split $QUARTO_IMPORT_MAP_ARG
$DENO_ARGS += $TESTS_TO_RUN

# Activate python virtualenv
# set QUARTO_TESTS_FORCE_NO_VENV env var to not activate the virtualenv located in the project
# QUARTO_TESTS_FORCE_NO_PIPENV is there for backward compatibility
If ($null -eq $Env:QUARTO_TESTS_FORCE_NO_VENV -and $null -ne $Env:QUARTO_TESTS_FORCE_NO_PIPENV) {
  $Env:QUARTO_TESTS_FORCE_NO_VENV = $Env:QUARTO_TESTS_FORCE_NO_PIPENV
}
If ($null -eq $Env:QUARTO_TESTS_FORCE_NO_VENV) {
  # Save possible activated virtualenv for later restauration
  $OLD_VIRTUAL_ENV=$VIRTUAL_ENV
  Write-Host "> Activating virtualenv from .venv for Python tests in Quarto"
  . $(Join-Path $QUARTO_ROOT "tests" ".venv/Scripts/activate.ps1")
  Write-Host "> Using Python from " -NoNewline; Write-Host "$((gcm python).Source)" -ForegroundColor Blue;
  Write-Host "> VIRTUAL_ENV: " -NoNewline; Write-Host "$($env:VIRTUAL_ENV)" -ForegroundColor Blue;
  $quarto_venv_activated = $true
}


Write-Host "> Running tests with `"$QUARTO_DENO $DENO_ARGS`" "

& $QUARTO_DENO $DENO_ARGS

$SUCCESS = $?
$DENO_EXIT_CODE = $LASTEXITCODE

# Add Coverage handling

If($quarto_venv_activated) {
  Write-Host "> Exiting virtualenv activated for tests"
  deactivate
  Write-Host "> Using Python from " -NoNewline; Write-Host "$((gcm python).Source)" -ForegroundColor Blue;
  Write-Host "> VIRTUAL_ENV: " -NoNewline; Write-Host "$($env:VIRTUAL_ENV)" -ForegroundColor Blue;
  Remove-Variable quarto_venv_activated
}
If($null -ne $OLD_VIRTUAL_ENV) {
  Write-Host "> Reactivating original virtualenv"
  . "$OLD_VIRTUAL_ENV/Scripts/activate.ps1"
  Write-Host "> New Python from " -NoNewline; Write-Host "$((gcm python).Source)" -ForegroundColor Blue;
  Write-Host "> VIRTUAL_ENV: " -NoNewline; Write-Host "$($env:VIRTUAL_ENV)" -ForegroundColor Blue;
  Remove-Variable OLD_VIRTUAL_ENV
}

Exit $DENO_EXIT_CODE
