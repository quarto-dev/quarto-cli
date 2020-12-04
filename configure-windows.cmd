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

ECHO Copying Quarto command...
REM Create quarto cmd
COPY ..\..\scripts\windows\quarto.cmd quarto.cmd
ECHO.

ECHO Downloading Dependencies...
ECHO Deno
REM Download Deno
SET DENO_FILE="deno-x86_64-pc-windows-msvc.zip"
SET DENO_URL="https://github.com/denoland/deno/releases/download/%DENO%/%DENO_FILE%"
CURL --fail -L %DENO_URL% -o %DENO_FILE%
TAR -xvf %DENO_FILE%
DEL %DENO_FILE%
ECHO .

ECHO Pandoc
REM download Pandoc
SET PANDOC_FILE="pandoc-%PANDOC%-windows-x86_64.zip"
SET PANDOC_URL="https://github.com/jgm/pandoc/releases/download/%PANDOC%/%PANDOC_FILE%"
CURL --fail -L %PANDOC_URL% -o %PANDOC_FILE%
TAR -xvf %PANDOC_FILE%
MOVE /Y pandoc-%PANDOC%\pandoc.exe pandoc.exe
DEL %PANDOC_FILE%
RMDIR/S /Q pandoc-%PANDOC%
ECHO.
ECHO.

POPD
POPD
POPD

ECHO NOTE: To use quarto please use quarto-cmd (located in this folder) or add the following path to your PATH
ECHO %binPath%
