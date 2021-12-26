@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM Reads the configuration file line by line
REM and convert any export statements into set statements
REM (allows reuse of variables)
FOR /F "tokens=*" %%A IN (..\..\configuration) DO CALL :convertExportToSet %%A 

..\%QUARTO_DIST_DIR%\%QUARTO_BIN_DIR%\deno run --unstable --allow-read --allow-write --allow-run --allow-env --allow-net --allow-ffi --importmap=import_map.json bld.ts %*

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