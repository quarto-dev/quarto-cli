@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM Batch script reminder: variables between % % are evaluated as parse time, not at runtime.
REM    Variables set dynamically (including being read from a file) should be evaluated
REM    using ! ! instead of % %. However, this only allows one level of expansion. Do not
REM    try to create a variable that derives from a derived variable. It will be empty.

REM First Check that Deno isn't running since this causes weird and confusing errors
REM find can conflict with one provided in bash with other args so use absolute path
tasklist /fi "ImageName eq deno.exe" /fo csv 2>NUL | "%WINDIR%/system32/find" /I "deno.exe">NUL
if "%ERRORLEVEL%"=="0" goto :denoRunning

call package\src\store_win_configuration.bat
call win_configuration.bat

if NOT DEFINED QUARTO_VENDOR_BINARIES (
  set "QUARTO_VENDOR_BINARIES=true"
)

if "%QUARTO_VENDOR_BINARIES%" == "true" (
  RMDIR /S /Q "!QUARTO_DIST_PATH!"
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

PUSHD !QUARTO_PACKAGE_PATH!\src
ECHO Configuring Quarto from !cd!
CALL quarto-bld.cmd configure --log-level info
echo Configuration done

POPD

if "%CI%" NEQ "true" (
	echo Revendoring quarto dependencies

  @REM for /F "tokens=2" %%i in ('date /t') do set today=%%i
	@REM RENAME src\vendor src\vendor-%today%
	@REM pushd src
  @REM echo Vendor phase 1
	@REM %QUARTO_DENO% vendor quarto.ts %QUARTO_ROOT%\tests\test-deps.ts --importmap=import_map.json
	@REM if ERRORLEVEL NEQ 0 (
	@REM   popd
	@REM   echo deno vendor failed (likely because of a download error). Please run the configure script again.
	@REM 	RMDIR vendor
	@REM 	RENAME vendor-${today} vendor
	@REM 	exit 1
  @REM )
	@REM popd
	@REM %QUARTO_DENO% run --unstable --allow-all --importmap=src\import_map.json package\src\common\create-dev-import-map.ts
)

ECHO Downloading Deno Stdlib
CALL !QUARTO_PACKAGE_PATH!\scripts\deno_std\download.bat

SET QUARTO_DENO_EXTRA_OPTIONS="--reload"
IF EXIST !QUARTO_BIN_PATH!\quarto.cmd (
  CALL "!QUARTO_BIN_PATH!\quarto" --version
)

ECHO NOTE: To use quarto please use quarto.cmd (located in this folder) or add the following path to your PATH
ECHO !QUARTO_BIN_PATH!

endlocal & set QUARTO_BIN_DEV=%QUARTO_BIN_PATH%

GOTO :eof

:denoRunning

echo Please ensure no instances of `deno.exe` are running before configuring.
echo (Deno might be running as an LSP if you have Visual Studio Code open.)
GOTO :eof
