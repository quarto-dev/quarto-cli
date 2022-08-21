@ECHO OFF
REM Add Quarto Bin to Path
SET TARGET_DIR=%~dp0\..\..\dist\bin
PUSHD %TARGET_DIR%
SET PATH=%PATH%;%cd%;
POPD
