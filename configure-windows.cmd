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
TAR -xvf %DENO_FILE%
DEL %DENO_FILE%
ECHO .

SET FINAL_BIN_PATH=%cd%

POPD
POPD
POPD

PUSHD %QUARTO_PACKAGE_DIR%\src
ECHO Configuring Quarto
quarto-bld configure --log-level info

POPD

SET QUARTO_DENO_EXTRA_OPTIONS="--reload"
%FINAL_BIN_PATH%\quarto --version

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