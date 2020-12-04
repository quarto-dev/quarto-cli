@ECHO OFF
SETLOCAL

REM TODO: Remove dependency on these variables

SET DIST_DIR="dist"
SET PACKAGE_DIR="package"
SET BIN_DIR="bin"
SET VERSION="0.1"

SET DENO="v1.4.6"
SET PANDOC="2.11.2"

IF NOT EXIST %PACKAGE_DIR% (
	MKDIR %PACKAGE_DIR%
) 

PUSHD %PACKAGE_DIR%

IF NOT EXIST %DIST_DIR% (
	MKDIR %DIST_DIR%
)

PUSHD %DIST_DIR%

IF NOT EXIST %BIN_DIR% (
	MKDIR %BIN_DIR% 
)

PUSHD %BIN_DIR%

REM Create quarto cmd
COPY ..\..\scripts\windows\quarto.cmd quarto.cmd

REM Add Quarto Bin to Path
SET currentDir=%~dp0
SET "binPath=%currentDir%"  
IF "!path:%binPath%=!" EQU "%path%" (
	SETX PATH "%PATH%;%binPath%"
)

REM Download Deno
SET DENO_FILE="deno-x86_64-pc-windows-msvc.zip"
SET DENO_URL="https://github.com/denoland/deno/releases/download/%DENO%/%DENO_FILE%"
CURL --fail -L %DENO_URL% -o %DENO_FILE%
TAR -xvf %DENO_FILE%
DEL %DENO_FILE%

REM download Pandoc
SET PANDOC_FILE="pandoc-%PANDOC%-windows-x86_64.zip"
SET PANDOC_URL="https://github.com/jgm/pandoc/releases/download/%PANDOC%/%PANDOC_FILE%"
CURL --fail -L %PANDOC_URL% -o %PANDOC_FILE%
TAR -xvf %PANDOC_FILE%
MOVE /Y pandoc-%PANDOC%\pandoc.exe pandoc.exe
DEL %PANDOC_FILE%
RMDIR/S /Q pandoc-%PANDOC%

POPD
POPD
POPD

ECHO PLEASE ADD THE FOLLOWING TO YOUR SYSTEM PATH TO COMPLETE CONFIGURATION:
ECHO %binPath%
