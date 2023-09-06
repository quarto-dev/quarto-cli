use std::process::Command;
use std::str::FromStr;
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
        println!("{}", version);
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
        if env::consts::OS == "windows" {
            deno_file = bin_dir
                .join("tools")
                .join("x86_64")
                .join("deno");
        } else {
            deno_file = bin_dir
                .join("tools")
                .join(deno_dir())
                .join("deno");
        }
    }
    let mut deno_dom_file: PathBuf = path_from_env("QUARTO_DENO_DOM");
    if deno_dom_file.as_os_str().is_empty() {
        deno_dom_file = bin_dir.join("tools").join("x86_64").join("deno_dom").join(DENO_DOM_LIB);
    }

    // set environment variables requried by quarto.js
    std::env::set_var("QUARTO_DENO", &deno_file);
    std::env::set_var("QUARTO_BIN_PATH", &bin_dir);
    std::env::set_var("QUARTO_SHARE_PATH", &share_dir);
    std::env::set_var("DENO_DOM_PLUGIN", &deno_dom_file);
    std::env::set_var("DENO_NO_UPDATE_CHECK", "1");
    std::env::set_var("DENO_TLS_CA_STORE","system,mozilla");

    // windows-specific env vars
    #[cfg(target_os = "windows")]
    std::env::set_var("NO_COLOR", std::ffi::OsStr::new("TRUE"));

    // Define the base deno options
    let mut deno_options: Vec<String> = vec![
        String::from("--unstable"),
        String::from("--no-config"),
        String::from("--cached-only"),
        String::from("--allow-read"),
        String::from("--allow-write"),
        String::from("--allow-run"),
        String::from("--allow-env"),
        String::from("--allow-net"),
        String::from("--allow-ffi"),      
    ];

    // If there are extra args, include those
    if let Ok(extra_options) = env::var("QUARTO_DENO_EXTRA_OPTIONS") {
        deno_options.push(extra_options);
    };

    // run deno
    let mut child = Command::new(&deno_file)
        .arg("run")
        .args(deno_options)
        .arg("--importmap")
        .arg(importmap_file)
        .arg(js_file)
        .args(args)
        .spawn()
        .expect("failed to run deno");

    // forward exit status
    let status = child.wait().expect("failed to wait on deno");
    if status.success() {
        std::process::exit(0)
    } else {
        match status.code() {
            Some(code) => std::process::exit(code),
            // errors reaping the status code have been observed 
            // (see https://github.com/quarto-dev/quarto-cli/issues/2296) 
            // so in that return a normal exit status -- need further 
            // investigation to figure out if there is more to do here
            None       => std::process::exit(0)
        }
    }
}

// return a PathBuf for an environment variable using os encoding
// (return empty string if the variable is not found)
fn path_from_env(key: &str) -> PathBuf {
    PathBuf::from(env::var_os(key).unwrap_or(OsString::new()))
}

fn share_dir_from_bin_dir(bin_dir: &PathBuf) -> PathBuf {
    // if quarto is bundled into an `.app` file (e.g. RStudio) it will be
    // looking for the share directory over in the resources folder.
    if bin_dir.ends_with("Contents/MacOS/quarto/bin") {
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
    } else if bin_dir.ends_with("usr/local/bin/quarto") {
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

fn deno_dir() -> String {
    let arch = arch_string();
    if arch.starts_with("Darwin arm64") {
        return String::from_str("aarch64").unwrap();
    } else if arch.starts_with("Darwin x86_64") {
        return String::from_str("x86_64").unwrap();
    } else {
        // TODO: Properly deal with multi-architecture on linux
        return String::from_str("x86_64").unwrap();
    }
}

// returns a string describing the architecture. only works on Unix
fn arch_string() -> String {
    let out = Command::new("uname")
        .args(["-sm"])
        .output().expect("Failed to run uname").stdout;
    String::from_utf8(out).expect("Couldn't convert to string")
}

// platform-specific deno dom lib file

#[cfg(target_os = "windows")]
const DENO_DOM_LIB: &str = "plugin.dll";

#[cfg(target_os = "macos")]
const DENO_DOM_LIB: &str = "libplugin.dylib";

#[cfg(target_os = "linux")]
const DENO_DOM_LIB: &str = "libplugin.so";
