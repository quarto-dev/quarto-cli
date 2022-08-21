SET QUARTO_VENDOR_BINARIES=false
SET QUARTO_NO_SYMLINK=1
SET QUARTO_DENO=%LIBRARY_BIN%\deno.exe
SET QUARTO_PANDOC=%LIBRARY_BIN%\pandoc.exe
SET QUARTO_ESBUILD=%LIBRARY_BIN%\esbuild.exe
SET QUARTO_DART_SASS=%LIBRARY_BIN%\sass.exe

SET QUARTO_PACKAGE_PATH=%SRC_DIR%\package
SET QUARTO_DIST_PATH=%LIBRARY_PREFIX%
SET QUARTO_SHARE_PATH=%LIBRARY_PREFIX%\share\quarto

call %SRC_DIR%\package\src\set_package_paths.bat

call configure.cmd
call package\src\quarto-bld.cmd update-html-dependencies
call package\src\quarto-bld.cmd prepare-dist

 MKDIR %PREFIX%\etc\conda\activate.d
(
  :: The slash manipulation is to make sure that we only record one style of slash
  ::    for conda's prefix replacement. It seemed like there was a bug where if you
  ::    had a mix of slashes in different files, then not all of them would be replaced
  ::    correctly.
  echo SET "QUARTO_DENO=%LIBRARY_BIN:\=/%\deno.exe"
  echo SET "QUARTO_DENO_DOM=%DENO_DOM_PLUGIN%"
  echo SET "QUARTO_PANDOC=%LIBRARY_BIN:\=/%\pandoc.exe"
  echo SET "QUARTO_ESBUILD=%LIBRARY_BIN:\=/%\esbuild.exe"
  echo SET "QUARTO_DART_SASS=%LIBRARY_BIN:\=/%\sass.bat"
  echo SET "QUARTO_SHARE_PATH=%LIBRARY_PREFIX:\=/%\share\quarto"
) > %PREFIX%\etc\conda\activate.d\quarto.bat

 MKDIR %PREFIX%\etc\conda\deactivate.d
(
  echo SET QUARTO_DENO=
  echo SET QUARTO_DENO_DOM=
  echo SET QUARTO_PANDOC=
  echo SET QUARTO_ESBUILD=
  echo SET QUARTO_DART_SASS=
  echo SET QUARTO_SHARE_DIR=
) > %PREFIX%\etc\conda\deactivate.d\quarto.bat
