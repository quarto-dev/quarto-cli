# This package is loaded from a project's .Renviron, via
#
#     R_DEFAULT_PACKAGES=rvenv,datasets,utils,grDevices,graphics,stats,methods
#
# It is the "in-session activation" leg of a rig project: it makes the
# project's `.rvenv/lib` library work in R sessions that rig did not start,
# e.g. in RStudio, Positron or VS Code. We deliberately do not use a project
# `.Rprofile` for this, because that would shadow the user's own
# `~/.Rprofile` entirely.
#
# `.Renviron` sets `R_LIBS_USER` to `.rvenvlib`, this package's own library,
# which is the one R has to be able to load a package from at startup.
# Switching it to the project library is this file's job. The path in
# `.Renviron` is *relative*, because the file is committed to version control
# and has to work from any clone location, while `.onLoad()` receives an
# already-resolved absolute `libname` -- so this is also where the relative
# path becomes an absolute one. That matters for child processes (callr,
# parallel, `R CMD`, `Rscript` from a subdirectory): they inherit the
# environment variable, not our `.libPaths()` call, so a child started in a
# subdirectory would otherwise look for `<subdir>/.rvenvlib`.
#
# This file is committed (`rig proj init` writes it once, into
# `.rvenvlib/rvenv/R/rvenv`) and so is not re-written by `rig proj sync` on an
# already-init'ed project. It is therefore kept to the one thing that has to
# work even before a project has ever been synced: if there is no project
# library yet, put the session back the way it would have been outside the
# project. Everything else -- the R-version check, setting up the active
# environment, the "not synced" warning -- lives in `.rvenv/onload.R`
# instead, which `rig proj sync` rewrites every time, so fixes there reach
# already-init'ed projects on their next sync, with no `rig proj init` (or
# `rig` upgrade) required.

.onLoad <- function(libname, pkgname) {
  # libname is `<root>/.rvenvlib`, this package's own library. `venv`, used
  # throughout this file, is `<root>/.rvenv`, the machine-specific
  # environment `rig proj sync` builds -- the same path the RVENV
  # environment variable holds when a wrapper script started R.
  root <- normalizePath(dirname(libname), mustWork = FALSE)
  venv <- file.path(root, ".rvenv")
  lib <- file.path(venv, "lib")

  # Whether a parent process activated this project already. Note that this
  # does *not* mean there is nothing to do: a child process started in the
  # project root reads the project .Renviron itself, which sets R_LIBS_USER
  # back to the relative `.rvenv/lib`, and a grandchild started from a
  # subdirectory would then look for the wrong directory. So the variables
  # below are re-asserted unconditionally, and only the parts that are not
  # idempotent -- re-reading the user's .Renviron and warning about an
  # unsynced project -- are skipped.
  activated <- identical(
    normalizePath(Sys.getenv("RVENV"), mustWork = FALSE),
    venv
  )

  # Re-read the user's own .Renviron first: the project .Renviron shadows it
  # rather than merging with it, so without this the user's variables are
  # empty in this session. Our own variables are set after it, so they win.
  # Not in a child process: there the parent's environment, including
  # whatever it deliberately changed, is what should survive.
  home_renv <- path.expand("~/.Renviron")
  if (!activated && file.exists(home_renv)) readRenviron(home_renv)

  # `lib` may not exist: `rig proj sync` creates it, and this package does
  # not, because it must not write to the project. There is nothing to
  # activate then, and leaving R_LIBS_USER pointing at `<root>/.rvenvlib` would
  # leave the session with no user library at all: `install.packages()` would
  # want to write into rig's own directory. So put the library path back to
  # what a session outside the project would have had, and only warn.
  # `file.exists()` rather than `dir.exists()`, which is R >= 3.2.0.
  if (!file.exists(lib)) {
    restore_r_libs_user(libname, lib)
    Sys.unsetenv("R_DEFAULT_PACKAGES")
    # One warning per project is enough; child processes are quiet. RVENV is
    # not set in this code path -- nothing was activated -- so the "did a
    # parent already do this?" flag is a separate variable here.
    warned <- identical(
      normalizePath(Sys.getenv("RVENV_UNSYNCED"), mustWork = FALSE),
      venv
    )
    Sys.setenv(RVENV_UNSYNCED = venv)
    if (!activated && !warned) warn_unsynced(venv, lib)
    return(invisible())
  }

  # The rest of activation is machine-specific and rewritten by every
  # `rig proj sync`, so it lives outside this committed file. Sourced with
  # `local = TRUE`: it runs in this call's own frame, so it reuses
  # `root`/`venv`/`lib`/`libname`/`activated` above directly, and any
  # functions it defines still resolve `restore_r_libs_user()` /
  # `warn_unsynced()` below by lexical scoping.
  onload <- file.path(venv, "onload.R")
  if (file.exists(onload)) {
    source(onload, local = TRUE)
  }

  invisible()
}

# Warns unless the project library was installed from the current lock file.
# `rig proj sync` copies the lock file it installed from to
# `.rvenv/lib/.synced`. A copy rather than a hash, so that both sides only
# need to read files: base R has no sha256, and md5 would mean one more
# dependency on the rig side.
warn_unsynced <- function(venv, lib) {
  stamp <- file.path(lib, ".synced")
  lock <- file.path(dirname(venv), "rproj.lock")
  synced <- FALSE
  if (file.exists(stamp) && file.exists(lock)) {
    synced <- identical(
      readLines(stamp, warn = FALSE),
      readLines(lock, warn = FALSE)
    )
  }
  if (!synced) {
    packageStartupMessage("! Project is not synced. Run: rig proj sync")
  }
  invisible()
}

# Undoes what the project `.Renviron` did to `R_LIBS_USER`, for a project
# that has no library yet. `.Renviron` pointed it at `<root>/.rvenvlib`, this
# package's own library, only to get R far enough to load this package, and
# `libname` is that directory. If the user's own `~/.Renviron` (re-read
# above) set `R_LIBS_USER`, that value is now in place and is what we keep;
# otherwise the value R had before `.Renviron` is restored. `R_LIBS`,
# `R_LIBS_SITE` and `RVENV` are untouched in this code path, so there is
# nothing to undo there.
restore_r_libs_user <- function(libname, lib) {
  sep <- .Platform$path.sep
  # The shim's own library, and the project library that is not there. Either
  # one can be what R_LIBS_USER points at now (`.Renviron`, or a `rig proj`
  # wrapper), and `RVENV_R_LIBS_USER` can hold the latter too, recorded by
  # `.Renviron` in a child of a session that was activated by a wrapper.
  reject <- normalizePath(c(libname, lib), mustWork = FALSE)
  keep <- function(x) {
    x <- unlist(strsplit(x, sep, fixed = TRUE))
    x <- x[nzchar(x) & x != "NULL"]
    x[!normalizePath(x, mustWork = FALSE) %in% reject]
  }

  user <- paste(keep(Sys.getenv("R_LIBS_USER")), collapse = sep)
  if (!nzchar(user)) user <- paste(keep(default_r_libs_user()), collapse = sep)
  if (nzchar(user)) {
    Sys.setenv(R_LIBS_USER = user)
  } else {
    Sys.unsetenv("R_LIBS_USER")
  }

  # Same as R's own startup code, in `<R_HOME>/library/base/R/Rprofile`:
  # R_LIBS first, then R_LIBS_USER, with the site and system libraries added
  # by `.libPaths()` itself. This also drops `<root>/.rvenvlib`, which
  # `.Renviron` put on the path at startup.
  .libPaths(c(keep(Sys.getenv("R_LIBS")), keep(user)))

  invisible()
}

# The `R_LIBS_USER` the session would have had without the project, i.e.
# what R itself had set by the time the project `.Renviron` was read, which
# that file recorded in `RVENV_R_LIBS_USER` before overwriting the real
# variable. It is still the *unexpanded* value from the R installation's
# `etc/Renviron`, e.g. `%U` or `~/R/%p-library/%v`: R only expands the
# `%`-specs later, in its own profile, after `.Renviron` files are read. So
# expand it with the running R's own expander, which knows exactly the specs
# that R's own `etc/Renviron` uses -- `%U` for instance is only understood
# from R 4.2.0 on, but older installations do not use it either. Should that
# function ever go away, an unexpanded path is still better than pointing the
# user at rig's directory.
#
# Empty when the project was set up by a rig older than this shim, or if the
# R installation does not set `R_LIBS_USER` at all; the caller then only
# drops the shim's own library from the path.
#
# On a rig-managed R installation the user library may hold several named
# libraries (`rig library`), in `__<name>` subdirectories, with the active one
# named in a `___default` file. rig's `Rprofile` hook resolves that before the
# default packages are loaded, but it did so for `<root>/.rvenvlib` in this
# session, so we resolve it here too. Unlike that hook, we never create a
# directory.
default_r_libs_user <- function() {
  spec <- Sys.getenv("RVENV_R_LIBS_USER")
  if (!nzchar(spec) || spec == "NULL") return("")

  expander <- ".expand_R_libs_env_var"
  if (exists(expander, envir = asNamespace("base"), inherits = FALSE)) {
    spec <- get(expander, envir = asNamespace("base"))(spec)
  }

  sep <- .Platform$path.sep
  libs <- unlist(strsplit(spec, sep, fixed = TRUE))
  libs[1L] <- resolve_named_library(libs[1L])
  paste(libs, collapse = sep)
}

# `<lib>/__<name>` if `<lib>` is a rig user library with a named library
# other than `main` selected, `<lib>` otherwise. See `default_r_libs_user()`.
resolve_named_library <- function(lib) {
  deffile <- file.path(lib, "___default")
  if (!file.exists(deffile)) return(lib)
  def <- readLines(deffile, warn = FALSE)[1L]
  if (is.na(def) || !nzchar(def) || def == "main") return(lib)
  named <- file.path(lib, paste0("__", def))
  if (file.exists(named)) named else lib
}
