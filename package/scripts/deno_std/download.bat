if NOT DEFINED WIN_CONFIG_TRANSLATED call %~dp0\..\store_win_configuration.bat
call %~dp0\..\..\..\win_configuration.bat

if NOT DEFINED QUARTO_DENO (
  SET QUARTO_DENO=%~dp0\..\..\dist\bin\tools\deno
)

set DENO_DIR=%~dp0\..\..\..\src\resources\deno_std\cache
%QUARTO_DENO% cache --unstable-ffi --lock %~dp0\..\..\..\src\resources\deno_std\deno_std.lock %~dp0\deno_std.ts
