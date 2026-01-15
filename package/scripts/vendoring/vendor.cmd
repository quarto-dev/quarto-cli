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

REM remove deno_cache directory first
IF EXIST "!DENO_DIR!" (
  RMDIR /S /Q "!DENO_DIR!"
)

PUSHD "!QUARTO_SRC_PATH!"

FOR %%E IN (quarto.ts vendor_deps.ts ..\tests\test-deps.ts ..\package\scripts\deno_std\deno_std.ts) DO (
  CALL !DENO_BIN_PATH! install --allow-all --no-config --entrypoint %%E --importmap="!QUARTO_SRC_PATH!\import_map.json" || (
    ECHO Warning: Failed to vendor %%E, continuing...
  )
)

REM Return to the original directory
POPD


EXIT /B 0