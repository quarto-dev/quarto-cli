@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM check-deno-in-use.cmd - Check if deno.exe is running from specified directory
REM
REM This script checks if any deno.exe processes are running from the specified
REM directory path. It is used by configure.cmd to prevent errors when trying to
REM delete the package/dist directory while deno is still running from it.
REM
REM Usage: check-deno-in-use.cmd <directory-path>
REM
REM Exit codes:
REM   0 - No deno process found at path (safe to proceed)
REM   1 - Deno process found at path (blocking condition)
REM
REM This check is directory-specific to support multiple worktrees - it only
REM blocks if deno.exe is running from the specified directory, not from other
REM locations (e.g., system deno in PATH or deno from another worktree).

SET "TARGET_PATH=%~1"

REM Validate that a path was provided
IF "%TARGET_PATH%"=="" (
  echo Error: No directory path provided
  echo Usage: check-deno-in-use.cmd ^<directory-path^>
  EXIT /B 1
)

REM Remove trailing backslash if present (for consistent path matching)
IF "!TARGET_PATH:~-1!"=="\" SET "TARGET_PATH=!TARGET_PATH:~0,-1!"

REM Check if deno.exe is running from target path using PowerShell
REM Uses .StartsWith() for exact prefix matching (not wildcard matching)
REM Case-insensitive comparison appropriate for Windows file paths
powershell -NoProfile -Command "if (Get-Process -Name deno -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith('!TARGET_PATH!', [System.StringComparison]::CurrentCultureIgnoreCase) }) { exit 1 } else { exit 0 }" >NUL 2>&1

IF "!ERRORLEVEL!"=="1" (
  REM Deno process found - show error message and process list
  echo.
  echo ============================================================
  echo Deno is running from this directory
  echo Please close Deno processes before running configure.cmd
  echo ============================================================
  echo.
  echo Directory: !TARGET_PATH!
  echo.
  echo Deno processes from this directory:
  powershell -NoProfile -Command "Get-Process -Name deno -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith('!TARGET_PATH!', [System.StringComparison]::CurrentCultureIgnoreCase) } | Format-Table Id, Path -AutoSize"
  EXIT /B 1
)

REM No blocking deno process found
EXIT /B 0
