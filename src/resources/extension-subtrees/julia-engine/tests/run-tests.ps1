# Always use the deno bundled with quarto to avoid version mismatches.
# Accepts QUARTO env var or falls back to quarto on PATH.
$ErrorActionPreference = "Stop"

$quartoCmd = if ($env:QUARTO) { $env:QUARTO } else { "quarto" }

$quartoBin = & $quartoCmd --paths | Select-Object -First 1
$deno = Join-Path $quartoBin "tools" "x86_64" "deno.exe"

if (-not (Test-Path $deno)) {
    # Try aarch64 if x86_64 not found
    $deno = Join-Path $quartoBin "tools" "aarch64" "deno.exe"
}

if (-not (Test-Path $deno)) {
    Write-Error "deno not found in quarto tools directory"
    exit 1
}

Push-Location $PSScriptRoot
try {
    # Run explicit files if given, otherwise discover all .test.ts files
    if ($args.Count -gt 0) {
        & $deno test --allow-all --no-check @args
    } else {
        & $deno test --allow-all --no-check smoke/
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
