@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM First Check that Deno isn't running since this causes weird and confusing errors
tasklist /fi "ImageName eq deno.exe" /fo csv 2>NUL | find /I "deno.exe">NUL
if "%ERRORLEVEL%"=="0" goto :denoRunning


REM Reads the configuration file line by line
REM and convert any export statements into set statements
REM (allows reuse of variables)
FOR /F "tokens=*" %%A IN (configuration) DO CALL :convertExportToSet %%A 

IF NOT EXIST %QUARTO_PACKAGE_DIR% (
	MKDIR %QUARTO_PACKAGE_DIR%
) 
PUSHD %QUARTO_PACKAGE_DIR%

RMDIR /S /Q %QUARTO_DIST_DIR%
IF NOT EXIST %QUARTO_DIST_DIR% (
	MKDIR %QUARTO_DIST_DIR%
)
PUSHD %QUARTO_DIST_DIR%

IF NOT EXIST %QUARTO_BIN_DIR% (
	MKDIR %QUARTO_BIN_DIR% 
)
PUSHD %QUARTO_BIN_DIR%
MKDIR tools
PUSHD tools

ECHO Bootstrapping Deno...
ECHO Deno
REM Download Deno
SET DENO_FILE="deno-x86_64-pc-windows-msvc.zip"
SET DENO_URL="https://github.com/denoland/deno/releases/download/%DENO%/%DENO_FILE%"
CURL --fail -L %DENO_URL% -o %DENO_FILE%
REM Windows doesn't have unzip installed by default, but starting in Windows 10 build 17063 they did 
REM include a build in 'tar' command. Windows 10 build 17063 was released in 2017.
tar -xf %DENO_FILE%

REM If tar failed, try unzipping it.
IF %ERRORLEVEL% NEQ 0 ( 
	ECHO tar failed; trying to unzip...
	unzip %DENO_FILE%	
)

REM If both failed, exit with error.
REM These blocks aren't nested because of the way Windows evaluates variables in control blocks;
REM %ERRORLEVEL% won't update without jumping through more hoops in a nested if.
IF %ERRORLEVEL% NEQ 0 (
	ECHO Unable to decompress %DENO_FILE%
	exit 1
)

DEL %DENO_FILE%


ECHO .
REM  Update to deno canary commit if it is set
IF NOT "%DENO_CANARY_COMMIT%"=="" (
	deno upgrade --canary --version %DENO_CANARY_COMMIT%
)

POPD

SET FINAL_BIN_PATH=%cd%

POPD
POPD
POPD

PUSHD %QUARTO_PACKAGE_DIR%\src
ECHO Configuring Quarto
CALL quarto-bld configure --log-level info

POPD

REM TODO: Convert this to .cmd
REM if [[ "$CI" != "true" && ( ( "./src/import_map.json" -nt "./src/dev_import_map.json" ) || ( "./src/vendor/import_map.json" -nt "./src/dev_import_map.json" ) ) ]]; then
REM 	echo [Revendoring quarto dependencies]
REM 
REM   today=`date +%Y-%m-%d`
REM 	mv ./src/vendor ./src/vendor-${today}
REM 	pushd src
REM 	set +e
REM 	../package/dist/bin/tools/deno vendor quarto.ts ../tests/test-deps.ts --importmap=./import_map.json
REM 	return_code="$?"
REM 	set -e
REM 	if [[ ${return_code} -ne 0 ]]; then
REM 	  echo deno vendor failed (likely because of a download error). Please run the configure script again.
REM 		rm -rf vendor
REM 		mv vendor-${today} vendor
REM 		exit 1
REM 	fi
REM 	popd
REM 	./package/dist/bin/tools/deno run --unstable --allow-all --importmap=./src/import_map.json package/src/common/create-dev-import-map.ts
REM fi



ECHO Downloading Deno Stdlib
CALL package\scripts\deno_std\download.bat

SET QUARTO_DENO_EXTRA_OPTIONS="--reload"
CALL "%FINAL_BIN_PATH%\quarto" --version

ECHO NOTE: To use quarto please use quarto-cmd (located in this folder) or add the following path to your PATH
ECHO %FINAL_BIN_PATH%


GOTO :eof

:denoRunning

echo Please ensure no instances of `deno.exe` are running before configuring.
echo (Deno might be running as an LSP if you have Visual Studio Code open.)
GOTO :eof

REM Reads each line of a file and converts any exports into SETs
:convertExportToSet
SET LINE=%*
SET FIND=export 
SET REPLACE=

IF "%LINE:~0,7%"=="%FIND%" (
	CALL SET LINE=%%LINE:!FIND!=!REPLACE!%%
	CALL SET %%LINE%%
)



:eof
