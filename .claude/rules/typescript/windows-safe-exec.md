---
paths:
  - "src/**/*.ts"
---

# Windows: `safeWindowsExec` quoting

`safeWindowsExec` (defined at `src/core/windows.ts`) is the right tool whenever a Windows process needs to be spawned through `cmd /c` instead of being launched directly by Deno. Examples include `.bat` wrappers (`tlmgr.bat`), TeX Live binaries that use `runscript.tlu` for path resolution (`fmtutil-sys.exe`, see `rstudio/tinytex#427`), registry queries via `reg.exe`, and other shell-sensitive callouts elsewhere under `src/core/` (`zip.ts`, `shell.ts`). Grep `safeWindowsExec` for the current set of call sites.

## Quote both program and args before calling

`safeWindowsExec` writes a temp `.bat` whose contents are `[program, ...args].join(" ")`. Any space in the program path or any arg tokenizes the line incorrectly, and the spawn either fails or runs the wrong binary. Pass the program path and the args through `requireQuoting` together, then split the returned array — the unit test `safeWindowsExec - handles program path with spaces (issue #13997)` in `tests/unit/windows-exec.test.ts` is the authoritative usage example, and `fmtutilCommand` in `src/command/render/latexmk/texlive.ts` is the in-tree consumer.

`tlmgrCommand` quotes only the user-supplied subcommand args, not the program path, because `tlmgr.bat` historically lives at a stable TinyTeX path. New call sites should default to quoting both — paths under `C:\Users\<name with spaces>\…` are common enough that this isn't theoretical.
