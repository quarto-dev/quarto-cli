ECHO OFF
SETLOCAL

rem TODO: Remove dependency on these variables

set DIST_DIR="dist"
set PACKAGE_DIR="package"
set BIN_DIR="bin"
set VERSION="0.1"

set DENO="v1.4.6"
set PANDOC="2.11.2"

if not exist %PACKAGE_DIR% (
	mkdir %PACKAGE_DIR%
) 

pushd %PACKAGE_DIR%

if not exist %DIST_DIR% (
	mkdir %DIST_DIR%
)

pushd %DIST_DIR%

if not exist %BIN_DIR% (
	mkdir %BIN_DIR% 
)

pushd %BIN_DIR%

rem Create quarto cmd
copy ..\..\scripts\windows\quarto.cmd quarto.cmd

rem Add Quarto Bin to Path
set currentDir=%cd%
set "binPath=%currentDir%"  
if "!path:%binPath%=!" equ "%path%" (
	setx path "%PATH%;%binPath%"
)

rem Download Deno
set DENO_FILE="deno-x86_64-pc-windows-msvc.zip"
set DENO_URL="https://github.com/denoland/deno/releases/download/%DENO%/%DENO_FILE%"
curl --fail -L %DENO_URL% -o %DENO_FILE%
tar -xvf %DENO_FILE%
del %DENO_FILE%

rem download Pandoc
set PANDOC_FILE="pandoc-%PANDOC%-windows-x86_64.zip"
set PANDOC_URL="https://github.com/jgm/pandoc/releases/download/%PANDOC%/%PANDOC_FILE%"
curl --fail -L %PANDOC_URL% -o %PANDOC_FILE%
target -xvf %PANDOC_FILE%
del %PANDOC_FILE%



popd
popd
popd

ECHO PLEASE ADD THE FOLLOWING TO YOUR SYSTEM PATH TO COMPLETE CONFIGURATION:
ECHO %binPath%


