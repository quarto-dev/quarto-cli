@ECHO OFF

if NOT DEFINED WIN_CONFIG_TRANSLATED call %~dp0\store_win_configuration.bat
call %~dp0\..\..\win_configuration.bat

if NOT DEFINED QUARTO_DENO (
  SET QUARTO_DENO=%~dp0\..\dist\bin\tools\x86_64\deno.exe
)
SET "RUST_BACKTRACE=full"
SET "DENO_NO_UPDATE_CHECK=1"

REM deno.jsonc disables the lockfile, so pass it explicitly. It is frozen, so this fails if it is out of date.
REM QUARTO_UPDATE_DENO_LOCK=1 allows updating it (see dev-docs\add-typescript-dependency.md).
SET "LOCK_FLAGS=--frozen"
IF "%QUARTO_UPDATE_DENO_LOCK%"=="1" SET "LOCK_FLAGS=--frozen=false"

REM --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
"%QUARTO_DENO%" run --lock=%~dp0\..\..\deno.lock %LOCK_FLAGS% --no-check --unstable-kv --unstable-ffi --allow-all --v8-flags=--enable-experimental-regexp-engine,--stack-trace-limit=100 --importmap=%~dp0\..\..\src\import_map.json %~dp0\bld.ts %*
