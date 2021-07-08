@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM Reads the configuration file line by line
REM and convert any export statements into set statements
REM (allows reuse of variables)
FOR /F "tokens=*" %%A IN (configuration) DO CALL :convertExportToSet %%A 

IF NOT EXIST %QUARTO_PACKAGE_DIR% (
	MKDIR %QUARTO_PACKAGE_DIR%
) 
PUSHD %QUARTO_PACKAGE_DIR%

IF NOT EXIST %QUARTO_DIST_DIR% (
	MKDIR %QUARTO_DIST_DIR%
)
PUSHD %QUARTO_DIST_DIR%

IF NOT EXIST %QUARTO_BIN_DIR% (
	MKDIR %QUARTO_BIN_DIR% 
)
PUSHD %QUARTO_BIN_DIR%

ECHO Bootstrapping Deno...
ECHO Deno
REM Download Deno
SET DENO_FILE="deno-x86_64-pc-windows-msvc.zip"
SET DENO_URL="https://github.com/denoland/deno/releases/download/%DENO%/%DENO_FILE%"
CURL --fail -L %DENO_URL% -o %DENO_FILE%
REM Windows doesn't have unzip installed by default, but starting in Windows 10 build 17063 they did 
REM includ a build in 'tar' command. Windows 10 build 17063 was released in 2017.
tar -xf %DENO_FILE%
IF %ERRORLEVEL% NEQ 0 ( 
	exit 1
)

DEL %DENO_FILE%


ECHO .
REM  Update to deno canary commit if it is set
if NOT %DENO_CANARY_COMMIT%=="" (
	deno upgrade --canary --version %DENO_CANARY_COMMIT%
)
deno cache --reload ..\..\..\src\quarto.ts --unstable --importmap=..\..\..\src\import_map.json

SET FINAL_BIN_PATH=%cd%

POPD
POPD
POPD

PUSHD %QUARTO_PACKAGE_DIR%\src
ECHO Configuring Quarto
CALL quarto-bld configure --log-level info

POPD

SET QUARTO_DENO_EXTRA_OPTIONS="--reload"
CALL %FINAL_BIN_PATH%\quarto --version

ECHO NOTE: To use quarto please use quarto-cmd (located in this folder) or add the following path to your PATH
ECHO %FINAL_BIN_PATH%


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