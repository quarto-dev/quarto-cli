@ECHO OFF

SETLOCAL ENABLEDELAYEDEXPANSION

SET "SCRIPT_PATH=%~dp0"
SET DEV_PATH=..\..\..\src

:: Set SRC_PATH in a way that normalizes the ../.. stuff away
for %%i in ("%SCRIPT_PATH%\%DEV_PATH%") do SET "SRC_PATH=%%~fi"
SET "QUARTO_TS_PATH=%SRC_PATH%\quarto.ts"

IF EXIST "%QUARTO_TS_PATH%" (

	IF "%1"=="--version" (
		ECHO 99.9.9
		GOTO end
	)

	IF "%1"=="-v" (
		ECHO 99.9.9
		GOTO end
	)

	IF "%QUARTO_ACTION%"=="" (
		SET QUARTO_ACTION=run
	)
	SET QUARTO_IMPORT_ARGMAP=--importmap="%SRC_PATH%\dev_import_map.json"

	IF "%QUARTO_TARGET%"=="" (
		SET QUARTO_TARGET="%QUARTO_TS_PATH%"
	)

	SET "QUARTO_BIN_PATH=!SCRIPT_PATH!"
	SET "QUARTO_SHARE_PATH=!SRC_PATH!resources\"
	SET QUARTO_DEBUG=true
	:: Normalize path to remove ../.. stuff
	for %%i in ("!SCRIPT_PATH!\..\..\..") do SET "QUARTO_DEV_PATH=%%~fi"
	for %%i in ("!SCRIPT_PATH!..\config\deno-version") do SET "DENO_VERSION_FILE=%%~fi"
	SET "QUARTO_CONFIG_FILE=!QUARTO_DEV_PATH!\configuration"
  FOR /F "usebackq tokens=*" %%A IN ("!QUARTO_CONFIG_FILE!") DO CALL :convertExportToSet %%A

  if exist "!DENO_VERSION_FILE!" (

		set /p DENO_INSTALLED_VERSION=<"!DENO_VERSION_FILE!"
	  if NOT "!DENO!"=="!DENO_INSTALLED_VERSION!" (
			echo !DENO!>"!DENO_VERSION_FILE!"

			cd !QUARTO_DEV_PATH!
			call configure.cmd
      echo
			echo Quarto required reconfiguration to install Deno !DENO!. Please try command again.
			GOTO end
		)
	) else (
		echo !DENO!>"!DENO_VERSION_FILE!"
	)

) ELSE (

	IF NOT DEFINED QUARTO_SHARE_PATH (
		SET "QUARTO_SHARE_PATH=%SCRIPT_PATH%\..\share"
	)

	IF "%1"=="-v" (
		TYPE "%QUARTO_SHARE_PATH%\version"
		GOTO end
	)

	SET QUARTO_DENO_OPTIONS=--no-check
	SET QUARTO_ACTION=run
	SET "QUARTO_TARGET=%SCRIPT_PATH%\quarto.js"
	SET "QUARTO_BIN_PATH=%SCRIPT_PATH%"
	SET "QUARTO_IMPORT_ARGMAP=--importmap=""%SCRIPT_PATH%""\vendor\import_map.json"
)

IF "%1"=="--paths" (
	ECHO %QUARTO_BIN_PATH%
	ECHO %QUARTO_SHARE_PATH%
	GOTO end
)

echo %PSModulePath% | findstr %USERPROFILE% >NUL
IF %ERRORLEVEL% EQU 0 (
	SET NO_COLOR=TRUE
)

set "DENO_DOM_PLUGIN=%QUARTO_BIN_PATH%\tools\deno_dom\plugin.dll"
IF NOT "%QUARTO_DENO_DOM%"=="" (
    set "DENO_DOM_PLUGIN=%QUARTO_DENO_DOM%"
)

IF "%QUARTO_DENO%"=="" (
    set QUARTO_DENO="%SCRIPT_PATH%\tools\deno"
)

SET QUARTO_DENO_OPTIONS=--unstable --no-config --cached-only --allow-read --allow-write --allow-run --allow-env --allow-net --allow-ffi %QUARTO_DENO_OPTIONS%

%QUARTO_DENO% %QUARTO_ACTION% %QUARTO_DENO_OPTIONS% %QUARTO_DENO_EXTRA_OPTIONS% %QUARTO_IMPORT_ARGMAP% %QUARTO_TARGET% %*

:end