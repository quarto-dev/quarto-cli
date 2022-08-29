use std::process::Command;
use std::{env, ffi::OsString, fs, path::Path, path::PathBuf};

fn main() {
    // compute executable path (resolving symlinks)
    let mut exe_file: PathBuf = env::current_exe().expect("failed to get exe path");
    let exe_metadata = fs::symlink_metadata(exe_file.as_path())
        .expect("failed to get symlink metadata for exe path");
    if exe_metadata.is_symlink() {
        exe_file =
            fs::read_link(exe_file.as_path()).expect("failed to cananoicalize executable path");
    }

    // compute bin_dir and share_dir (share_dir may be provided externally)
    let bin_dir = exe_file
        .parent()
        .expect("failed to get executable parent")
        .to_path_buf();
    let mut share_dir = path_from_env("QUARTO_SHARE_PATH");
    if share_dir.as_os_str().is_empty() {
        share_dir = share_dir_from_bin_dir(&bin_dir);
    }

    // some other file paths
    let js_file = bin_dir.join(Path::new("quarto.js"));
    let importmap_file = bin_dir.join("vendor").join("import_map.json");

    // get command line args (skip first which is the program)
    let args: Vec<OsString> = env::args_os().skip(1).collect();

    // handle no args at all
    if args.is_empty() {
        std::process::exit(0);
    }

    // handle --version
    if &args[0] == "--version" || &args[0] == "-v" {
        let version_path = share_dir.join("version");
        let version = fs::read_to_string(version_path).expect("failed to read version");
        print!("{}", version);
        std::process::exit(0);
    }

    // handle --paths
    if &args[0] == "--paths" {
        println!("{}\n{}", bin_dir.display(), share_dir.display());
        std::process::exit(0);
    }

    // compute deno and deno dom locations (allow them to be defined externally)
    let mut deno_file = path_from_env("QUARTO_DENO");
    if deno_file.as_os_str().is_empty() {
        deno_file = bin_dir.join("tools").join("deno");
    }
    let mut deno_dom_file: PathBuf = path_from_env("QUARTO_DENO_DOM");
    if deno_dom_file.as_os_str().is_empty() {
        deno_dom_file = bin_dir.join("tools").join("deno_dom").join(DENO_DOM_LIB);
    }

    // set environment variables requried by quarto.js
    std::env::set_var("QUARTO_BIN_PATH", bin_dir);
    std::env::set_var("QUARTO_SHARE_PATH", share_dir.as_path());
    std::env::set_var("DENO_DOM_PLUGIN", deno_dom_file.as_os_str());

    // windows-specific env vars
    #[cfg(target_os = "windows")]
    std::env::set_var("NO_COLOR", std::ffi::OsStr::new("TRUE"));

    // run deno
    let mut child = Command::new(deno_file)
        .arg("run")
        .arg("--unstable")
        .arg("--no-config")
        .arg("--cached-only")
        .arg("--allow-read")
        .arg("--allow-write")
        .arg("--allow-run")
        .arg("--allow-env")
        .arg("--allow-net")
        .arg("--allow-ffi")
        .arg("--importmap")
        .arg(importmap_file)
        .arg(js_file)
        .args(args)
        .spawn()
        .expect("failed to run deno");

    // forward exit status
    let ecode = child.wait().expect("failed to wait on deno");
    std::process::exit(ecode.code().expect("failed to get deno exit code"));
}

// return a PathBuf for an environment variable using os encoding
// (return empty string if the variable is not found)
fn path_from_env(key: &str) -> PathBuf {
    PathBuf::from(env::var_os(key).unwrap_or(OsString::new()))
}

fn share_dir_from_bin_dir(bin_dir: &PathBuf) -> PathBuf {
    // if quarto is bundled into an `.app` file (e.g. RStudio) it will be
    // looking for the share directory over in the resources folder.
    if bin_dir.ends_with("/Contents/MacOS/quarto/bin") {
        bin_dir
            .parent()
            .expect("failed to get bin_dir parent")
            .parent()
            .expect("failed to get bin_dir parent")
            .parent()
            .expect("failed to get bin_dir parent")
            .join("Resources")
            .join("quarto")
            .join("share")
    // if using standard linux filesystem local bin folder then
    // look for 'share' in the right place
    } else if bin_dir.ends_with("/usr/local/bin/quarto") {
        bin_dir
            .parent()
            .expect("failed to get bin_dir parent")
            .parent()
            .expect("failed to get bin_dir parent")
            .join("share")
            .join("quarto")
    } else {
        bin_dir
            .parent()
            .expect("failed to get bin path parent")
            .join("share")
    }
}

// platform-specific deno dom lib file

#[cfg(target_os = "windows")]
const DENO_DOM_LIB: &str = "plugin.dll";

#[cfg(target_os = "macos")]
const DENO_DOM_LIB: &str = "libplugin.dylib";

#[cfg(target_os = "linux")]
const DENO_DOM_LIB: &str = "libplugin.so";
