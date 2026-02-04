@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM Batch script reminder: variables between % % are evaluated as parse time, not at runtime.
REM    Variables set dynamically (including being read from a file) should be evaluated
REM    using ! ! instead of % %. However, this only allows one level of expansion. Do not
REM    try to create a variable that derives from a derived variable. It will be empty.

call package\src\store_win_configuration.bat
call win_configuration.bat

if NOT DEFINED QUARTO_VENDOR_BINARIES (
  set "QUARTO_VENDOR_BINARIES=true"
)

if "%QUARTO_VENDOR_BINARIES%" == "true" (

  REM Windows-specific: Check if deno.exe is running before deleting package/dist
  REM Extracted to package/scripts/windows/check-deno-in-use.cmd for maintainability
  call package\scripts\windows\check-deno-in-use.cmd "!QUARTO_DIST_PATH!"
  if "!ERRORLEVEL!"=="1" exit /B 1

  echo Removing package/dist/ directory...
  RMDIR /S /Q "!QUARTO_DIST_PATH!" 2>NUL

  REM Fallback: Verify deletion succeeded (defense in depth)
  if exist "!QUARTO_DIST_PATH!" (
    echo.
    echo ============================================================
    echo Error: Could not delete package/dist/ directory
    echo A process may be holding files open
    echo ============================================================
    echo.
    echo Try closing applications and run configure.cmd again
    exit /B 1
  )

  MKDIR !QUARTO_BIN_PATH!\tools
  PUSHD !QUARTO_BIN_PATH!\tools

  ECHO Bootstrapping Deno...
  REM Download Deno
  SET DENO_ARCH_DIR=x86_64
  MKDIR !DENO_ARCH_DIR!
  PUSHD !DENO_ARCH_DIR!
  SET DENO_FILE=deno-!DENO_ARCH_DIR!-pc-windows-msvc.zip
  CURL --fail -L "https://github.com/denoland/deno/releases/download/!DENO!/!DENO_FILE!" -o "!DENO_FILE!"
  REM Windows doesn't have unzip installed by default, but starting in Windows 10 build 17063 they did 
  REM include a build in 'tar' command. Windows 10 build 17063 was released in 2017.
  REM We need to use absolute if another tar is in PATH, that would not support .zip extension
  %WINDIR%/System32/tar -xf !DENO_FILE!

  REM If tar failed, try unzipping it.
  IF ERRORLEVEL 1 ( 
    ECHO tar failed; trying to unzip...
    unzip -o !DENO_FILE!	
  )

  REM If both failed, exit with error.
  REM These blocks aren't nested because of the way Windows evaluates variables in control blocks;
  REM %ERRORLEVEL% won't update without jumping through more hoops in a nested if.
  IF ERRORLEVEL 1 (
    ECHO Unable to decompress !DENO_FILE!
    exit 1
  )

  DEL !DENO_FILE!

  ECHO .
  REM  Update to deno canary commit if it is set
  IF DEFINED DENO_CANARY_COMMIT  (
    deno upgrade --canary --version %DENO_CANARY_COMMIT%
  )

  SET QUARTO_DENO=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\deno.exe
  POPD
  POPD
)

IF NOT DEFINED QUARTO_DENO_DIR (
  SET "DENO_DIR=!QUARTO_BIN_PATH!\deno_cache"
) ELSE (
  SET "DENO_DIR=!QUARTO_DENO_DIR!"
)

PUSHD !QUARTO_PACKAGE_PATH!\src
ECHO Configuring Quarto from !cd!
CALL quarto-bld.cmd configure --log-level info
echo Configuration done

POPD

REM download typescript dependencies
CALL package\scripts\vendoring\vendor.cmd

ECHO Downloading Deno Stdlib
CALL !QUARTO_PACKAGE_PATH!\scripts\deno_std\download.bat

IF EXIST !QUARTO_BIN_PATH!\quarto.cmd (
  SET QUARTO_DENO_EXTRA_OPTIONS=--reload
  CALL "!QUARTO_BIN_PATH!\quarto" --version
)

ECHO NOTE: To use quarto please use quarto.cmd (located in this folder) or add the following path to your PATH
ECHO !QUARTO_BIN_PATH!

REM Build typst-gather and install to tools directory
ECHO Building typst-gather...
cargo build --release --manifest-path package\typst-gather\Cargo.toml
COPY package\typst-gather\target\release\typst-gather.exe "!QUARTO_BIN_PATH!\tools\x86_64\"

endlocal & set QUARTO_BIN_DEV=%QUARTO_BIN_PATH%

GOTO :eof
