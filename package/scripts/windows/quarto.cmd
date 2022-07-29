@ECHO OFF

SETLOCAL ENABLEDELAYEDEXPANSION

SET "SCRIPT_DIR=%~dp0"
SET DEV_PATH=..\..\..\src\

SET SRC_PATH=%SCRIPT_DIR%%DEV_PATH%
SET "QUARTO_TS_PATH=%SRC_PATH%quarto.ts"

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
	SET QUARTO_IMPORT_ARGMAP=--importmap="%SRC_PATH%dev_import_map.json"

	IF "%QUARTO_TARGET%"=="" (
		SET QUARTO_TARGET="%QUARTO_TS_PATH%"
	)

	SET "QUARTO_BIN_PATH=!SCRIPT_DIR!"
	SET "QUARTO_SHARE_PATH=!SRC_PATH!resources\"
	SET QUARTO_DEBUG=true
	SET QUARTO_DEV_DIR=!SCRIPT_DIR!..\..\..
	SET DENO_VERSION_FILE="!SCRIPT_DIR!..\config\deno-version"
	SET "QUARTO_CONFIG_FILE=!QUARTO_DEV_DIR!\configuration"
  FOR /F "usebackq tokens=*" %%A IN ("!QUARTO_CONFIG_FILE!") DO CALL :convertExportToSet %%A 

  if exist "!DENO_VERSION_FILE!" (

		set /p DENO_INSTALLED_VERSION=<"!DENO_VERSION_FILE!"
	  if NOT "!DENO!"=="!DENO_INSTALLED_VERSION!" (
			echo !DENO!>"!DENO_VERSION_FILE!"
		
			cd !QUARTO_DEV_DIR!
			call configure-windows.cmd
      echo 
			echo Quarto required reconfiguration to install Deno !DENO!. Please try command again.
			GOTO end
		)
	) else (
		echo !DENO!>"!DENO_VERSION_FILE!"
	)

) ELSE (

	IF "%1"=="--version" (
		TYPE "%SCRIPT_DIR%..\share\version"
		GOTO end
	)

		IF "%1"=="-v" (
		TYPE "%SCRIPT_DIR%..\share\version"
		GOTO end
	)
	
	SET QUARTO_DENO_OPTIONS=--no-check
	SET QUARTO_ACTION=run
	SET QUARTO_TARGET="%SCRIPT_DIR%quarto.js"
	SET "QUARTO_BIN_PATH=%SCRIPT_DIR%"
	SET "QUARTO_SHARE_PATH=%SCRIPT_DIR%..\share"
	SET QUARTO_IMPORT_ARGMAP=--importmap="%SCRIPT_DIR%\vendor\import_map.json"
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

%QUARTO_DENO%
IF "%QUARTO_DENO%"=="" (
    set QUARTO_DENO="%SCRIPT_DIR%\tools\deno"
)

SET QUARTO_DENO_OPTIONS=--unstable --no-config --cached-only --allow-read --allow-write --allow-run --allow-env --allow-net --allow-ffi %QUARTO_DENO_OPTIONS%

%QUARTO_DENO% %QUARTO_ACTION% %QUARTO_DENO_OPTIONS% %QUARTO_DENO_EXTRA_OPTIONS% %QUARTO_IMPORT_ARGMAP% %QUARTO_TARGET% %*


GOTO :end

REM Reads each line of a file and converts any exports into SETs
:convertExportToSet
SET LINE=%*
SET FIND=export 
SET REPLACE=

IF "%LINE:~0,7%"=="%FIND%" (
	CALL SET LINE=%%LINE:!FIND!=!REPLACE!%%
	CALL SET %%LINE%%
)

:end