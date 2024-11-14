@ECHO OFF

SETLOCAL ENABLEDELAYEDEXPANSION

SET "SCRIPT_PATH=%~dp0"
SET DEV_PATH=..\..\..

:: Set SRC_PATH in a way that normalizes the ../.. stuff away
for %%i in ("%~dp0\%DEV_PATH%") do SET "QUARTO_ROOT=%%~fi"
SET "QUARTO_TS_PATH=!QUARTO_ROOT!\src\quarto.ts"

IF EXIST "!QUARTO_TS_PATH!" (

	IF "%1"=="--version" (
		ECHO 99.9.9
		GOTO end
	)

	IF "%1"=="-v" (
		ECHO 99.9.9
		GOTO end
	)

  call !QUARTO_ROOT!\win_configuration.bat
  REM overrride share path to point to our dev folder instead of dist
  set QUARTO_SHARE_PATH=!QUARTO_ROOT!\src\resources

	IF NOT DEFINED QUARTO_ACTION (
		SET QUARTO_ACTION=run
	)
	SET "QUARTO_IMPORT_MAP_ARG=--importmap=""!QUARTO_SRC_PATH!\import_map.json"""

	IF NOT DEFINED QUARTO_TARGET (
		SET "QUARTO_TARGET=!QUARTO_TS_PATH!"
	)

	IF NOT DEFINED QUARTO_DEBUG (
		SET QUARTO_DEBUG=true
	)

	:: Normalize path to remove ../.. stuff
	for %%i in ("!SCRIPT_PATH!..\config\deno-version") do SET "DENO_VERSION_FILE=%%~fi"

  if exist "!DENO_VERSION_FILE!" (

		set /p DENO_INSTALLED_VERSION=<"!DENO_VERSION_FILE!"
	  if NOT "!DENO!"=="!DENO_INSTALLED_VERSION!" (
			echo !DENO!>"!DENO_VERSION_FILE!"

			cd !QUARTO_ROOT!
			call configure.cmd
      echo
			echo Quarto required reconfiguration to install Deno !DENO!. Please try command again.
			GOTO end
		)
	) else (
		echo !DENO!>"!DENO_VERSION_FILE!"
	)

	SET QUARTO_CACHE_OPTIONS=

	REM Turn on type checking for dev version
  SET QUARTO_DENO_OPTIONS=--check

) ELSE (

	IF NOT DEFINED QUARTO_SHARE_PATH (
	  for %%i in ("!SCRIPT_PATH!\..\share") do SET "QUARTO_SHARE_PATH=%%~fi"
	)

	IF "%1"=="-v" (
		TYPE "!QUARTO_SHARE_PATH!\version"
		GOTO end
	)

	IF "%1"=="--version" (
		TYPE "!QUARTO_SHARE_PATH!\version"
		GOTO end
	)

	SET QUARTO_DENO_OPTIONS=--no-check
	SET QUARTO_ACTION=run
	SET "QUARTO_TARGET=%SCRIPT_PATH%\quarto.js"
	SET "QUARTO_BIN_PATH=%SCRIPT_PATH%"
	SET "QUARTO_IMPORT_MAP_ARG=--importmap=""%SCRIPT_PATH%\vendor\import_map.json"""
	SET QUARTO_CACHE_OPTIONS="--cached-only"
)

IF "%1"=="--paths" (
	ECHO !QUARTO_BIN_PATH!
	ECHO !QUARTO_SHARE_PATH!
	GOTO end
)

SET NO_COLOR=TRUE

set "DENO_DOM_PLUGIN=!QUARTO_BIN_PATH!\tools\deno_dom\plugin.dll"
IF DEFINED QUARTO_DENO_DOM (
    set "DENO_DOM_PLUGIN=!QUARTO_DENO_DOM!"
)

IF NOT DEFINED QUARTO_DENO (
    set "QUARTO_DENO=!SCRIPT_PATH!\tools\x86_64\deno.exe"
)

SET "DENO_TLS_CA_STORE=system,mozilla"
SET "DENO_NO_UPDATE_CHECK=1"
REM Using --allow-all as there is otherwise an issue in Deno 1.46.3 with --allow-read and --allow-write with network drives
REM https://github.com/quarto-dev/quarto-cli/issues/11332
SET "QUARTO_DENO_OPTIONS=--unstable-kv --unstable-ffi --no-config --no-lock --allow-all !QUARTO_DENO_OPTIONS!"

REM Add expected V8 options to QUARTO_DENO_V8_OPTIONS
IF DEFINED QUARTO_DENO_V8_OPTIONS (
	REM --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
	IF "!QUARTO_DENO_V8_OPTIONS!"=="!QUARTO_DENO_V8_OPTIONS:--enable-experimental-regexp-engine=!" (
		SET "QUARTO_DENO_V8_OPTIONS=--enable-experimental-regexp-engine,!QUARTO_DENO_V8_OPTIONS!"
	)
	IF "!QUARTO_DENO_V8_OPTIONS!"=="!QUARTO_DENO_V8_OPTIONS:--max-old-space-size=!" (
		SET "QUARTO_DENO_V8_OPTIONS=--max-old-space-size=8192,!QUARTO_DENO_V8_OPTIONS!"
	)
	IF "!QUARTO_DENO_V8_OPTIONS!"=="!QUARTO_DENO_V8_OPTIONS:--max-heap-size=!" (
		SET "QUARTO_DENO_V8_OPTIONS=--max-heap-size=8192,!QUARTO_DENO_V8_OPTIONS!"
	)
) ELSE (
  SET "QUARTO_DENO_V8_OPTIONS=--enable-experimental-regexp-engine,--max-old-space-size=8192,--max-heap-size=8192"
)

REM Prepend v8-flags for deno run if necessary
IF NOT DEFINED QUARTO_DENO_EXTRA_OPTIONS (
  SET "QUARTO_DENO_EXTRA_OPTIONS=--v8-flags=!QUARTO_DENO_V8_OPTIONS!"
) ELSE (
	IF "!QUARTO_DENO_EXTRA_OPTIONS!"=="!QUARTO_DENO_EXTRA_OPTIONS:--v8-flags=!" (
  	SET "QUARTO_DENO_EXTRA_OPTIONS=--v8-flags=!QUARTO_DENO_V8_OPTIONS! !QUARTO_DENO_EXTRA_OPTIONS!"
	)	ELSE (
		ECHO WARN: QUARTO_DENO_EXTRA_OPTIONS already contains --v8-flags, skipping addition of QUARTO_DENO_V8_OPTIONS by quarto itself. This is unexpected and you should check your configuration.
	)
)

!QUARTO_DENO! !QUARTO_ACTION! !QUARTO_CACHE_OPTIONS! !QUARTO_DENO_OPTIONS! !QUARTO_DENO_EXTRA_OPTIONS! !QUARTO_IMPORT_MAP_ARG! !QUARTO_TARGET! %*


:end