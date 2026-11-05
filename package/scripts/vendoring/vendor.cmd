@ECHO OFF
REM You should not need to run this script directly. 
REM It is sourced by the configure.cmd script.
SETLOCAL ENABLEDELAYEDEXPANSION

IF "%QUARTO_VENDOR_BINARIES%"=="true" (
  SET DENO_BIN_PATH=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\deno.exe
) ELSE (
  IF NOT DEFINED DENO_BIN_PATH (
    ECHO DENO_BIN_PATH is not set. You either need to allow QUARTO_VENDOR_BINARIES or set DENO_BIN_PATH to the path of a deno binary.
    EXIT /B 1
  )
)

IF NOT DEFINED DENO_DIR (
  SET DENO_DIR=!QUARTO_BIN_PATH!\deno_cache
)

ECHO Revendoring quarto dependencies

REM remove deno_cache directory first, unless explicitly told to preserve
REM (CI sets QUARTO_SKIP_DENO_CACHE_WIPE=1 so a restored cache survives vendor.cmd)
IF EXIST "!DENO_DIR!" (
  IF NOT "!QUARTO_SKIP_DENO_CACHE_WIPE!"=="1" (
    RMDIR /S /Q "!DENO_DIR!"
  )
)

PUSHD "!QUARTO_SRC_PATH!"

REM All entrypoints are vendored in a single call so that they share one lockfile
REM (deno.lock at the repository root). The lockfile is checked in and the install
REM is --frozen: it fails if the lockfile is out of date instead of silently
REM re-resolving dependencies. Set QUARTO_UPDATE_DENO_LOCK=1 to update deno.lock
REM (see dev-docs/add-typescript-dependency.md).
SET "LOCK_FLAGS=--frozen"
IF "%QUARTO_UPDATE_DENO_LOCK%"=="1" SET "LOCK_FLAGS=--frozen=false"

CALL !DENO_BIN_PATH! install --allow-import --no-config !LOCK_FLAGS! --lock="!QUARTO_SRC_PATH!\..\deno.lock" --entrypoint quarto.ts vendor_deps.ts ..\tests\test-deps.ts ..\package\scripts\deno_std\deno_std.ts ..\package\src\bld.ts ..\tools\deno-esbuild-bundle.ts --importmap="!QUARTO_SRC_PATH!\import_map.json"
IF ERRORLEVEL 1 (
  ECHO Failed to vendor quarto dependencies
  EXIT /B 1
)

REM Return to the original directory
POPD


EXIT /B 0