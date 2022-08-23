@ECHO OFF

SETLOCAL ENABLEDELAYEDEXPANSION

for /f "tokens=2 delims=[]" %%i in ('dir %~dp0quarto.cmd ^| FIND "<SYMLINK"') do SET RESOLVED_PATH=%%i
if "!RESOLVED_PATH!" == "" (
  SET "SCRIPT_PATH=%~dp0"
  SET DEV_PATH=..\..\..
) else (
  SET "SCRIPT_PATH=!RESOLVED_PATH!\.."
  :: Account for the filename on the end of the resolved path
  SET DEV_PATH=..\..\..
)


:: Set SRC_PATH in a way that normalizes the ../.. stuff away
for %%i in ("!SCRIPT_PATH!\!DEV_PATH!") do SET "QUARTO_ROOT=%%~fi"

IF EXIST "!QUARTO_ROOT!\src\quarto.ts" (

	IF "%1"=="--version" (
		ECHO 99.9.9
		GOTO end
	)

	IF "%1"=="-v" (
		ECHO 99.9.9
		GOTO end
	)

  REM overrride share path to point to our dev folder instead of dist
  set "QUARTO_SHARE_PATH=!QUARTO_ROOT!\src\resources"

	IF NOT DEFINED QUARTO_ACTION (
		SET QUARTO_ACTION=run
	)
	SET "QUARTO_IMPORT_ARGMAP=--importmap=""!QUARTO_ROOT!\src\dev_import_map.json"""

	IF NOT DEFINED QUARTO_TARGET (
		SET "QUARTO_TARGET=!QUARTO_ROOT!\src\quarto.ts"
	)

  REM Reads the configuration file line by line
  REM and convert any export statements into set statements
  REM (allows reuse of variables)

  FOR /F "tokens=*" %%A IN (!QUARTO_ROOT!\configuration) DO (
    SET LINE=%%A

    IF "!LINE:~0,7!"=="export " (
      SET "LINE=!LINE:export =!"
      SET "!LINE!"
    )
  )

	SET QUARTO_DEBUG=true
	:: Normalize path to remove ../.. stuff
	for %%i in ("!SCRIPT_PATH!\..\config\deno-version") do SET "DENO_VERSION_FILE=%%~fi"

  if exist "!DENO_VERSION_FILE!" (

		set /p DENO_INSTALLED_VERSION=<"!DENO_VERSION_FILE!"
	  if NOT "!DENO!"=="!DENO_INSTALLED_VERSION!" (
			echo !DENO!>"!DENO_VERSION_FILE!"
      echo "Quarto needs reconfiguration to install the correct Deno version (!DENO!)."
      echo "    (Found Deno version: !DENO_INSTALLED_VERSION!)"
      echo "Please run the configure.sh script in either git bash or MSYS2."
      GOTO end
		)
	) else (
		echo !DENO!>"!DENO_VERSION_FILE!"
	)

) ELSE (

	IF NOT DEFINED QUARTO_SHARE_PATH (
	  for %%i in ("!SCRIPT_PATH!\..\share") do SET "QUARTO_SHARE_PATH=%%~fi"
	)

	IF "%1"=="-v" (
		TYPE "!QUARTO_SHARE_PATH!\version"
		GOTO end
	)

	SET QUARTO_DENO_OPTIONS=--no-check
	SET QUARTO_ACTION=run
	SET "QUARTO_TARGET=!SCRIPT_PATH!\quarto.js"
	SET "QUARTO_IMPORT_ARGMAP=--importmap=""!SCRIPT_PATH!\vendor\import_map.json"""
)

IF "%1"=="--paths" (
	ECHO !QUARTO_BIN_PATH!
	ECHO !QUARTO_SHARE_PATH!
	GOTO end
)

echo %PSModulePath% | findstr %USERPROFILE% >NUL
IF %ERRORLEVEL% EQU 0 (
	SET NO_COLOR=TRUE
)

set "DENO_DOM_PLUGIN=!SCRIPT_PATH!\tools\deno_dom\plugin.dll"
IF DEFINED QUARTO_DENO_DOM (
    set "DENO_DOM_PLUGIN=!QUARTO_DENO_DOM!"
)

IF NOT DEFINED QUARTO_DENO (
    set "QUARTO_DENO=!SCRIPT_PATH!\tools\deno.exe"
)

SET "QUARTO_DENO_OPTIONS=--unstable --no-config --cached-only --allow-read --allow-write --allow-run --allow-env --allow-net --allow-ffi !QUARTO_DENO_OPTIONS!"
:: this one needs to be here or else bld.ts complains aobut it
SET "QUARTO_BIN_PATH=!SCRIPT_PATH!"

"!QUARTO_DENO!" !QUARTO_ACTION! !QUARTO_DENO_OPTIONS! !QUARTO_DENO_EXTRA_OPTIONS! !QUARTO_IMPORT_ARGMAP! !QUARTO_TARGET! %*

:end