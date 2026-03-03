use std::collections::HashSet;
use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;
use typst_gather::{gather_packages, Config};

#[derive(Parser)]
#[command(version, about = "Gather Typst packages to a local directory")]
struct Args {
    /// TOML file specifying packages to gather
    spec_file: PathBuf,
}

fn main() -> ExitCode {
    let args = Args::parse();

    let content = match std::fs::read_to_string(&args.spec_file) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error reading spec file: {e}");
            return ExitCode::FAILURE;
        }
    };

    let config = match Config::parse(&content) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error parsing spec file: {e}");
            return ExitCode::FAILURE;
        }
    };

    let dest = match &config.destination {
        Some(d) => d.clone(),
        None => {
            eprintln!("Error: 'destination' field is required in spec file");
            return ExitCode::FAILURE;
        }
    };

    // Resolve paths relative to rootdir if specified
    let rootdir = config.rootdir.clone();
    let dest = match &rootdir {
        Some(root) => root.join(&dest),
        None => dest,
    };
    let discover: Vec<PathBuf> = config
        .discover
        .iter()
        .map(|p| match &rootdir {
            Some(root) => root.join(p),
            None => p.clone(),
        })
        .collect();

    // Build set of configured local packages
    let configured_local: HashSet<String> = config.local.keys().cloned().collect();

    let entries = config.into_entries();
    let result = gather_packages(&dest, entries, &discover, &configured_local);

    // Check for unconfigured @local imports FIRST (this is an error)
    if !result.unconfigured_local.is_empty() {
        eprintln!("\nError: Found @local imports not configured in [local] section:");
        for (name, source_file) in &result.unconfigured_local {
            eprintln!("  - {name} (in {source_file})");
        }
        eprintln!("\nAdd them to your config file:");
        eprintln!("  [local]");
        for (name, _) in &result.unconfigured_local {
            eprintln!("  {name} = \"/path/to/{name}\"");
        }
        return ExitCode::FAILURE;
    }

    println!(
        "\nDone: {} downloaded, {} copied, {} skipped, {} failed",
        result.stats.downloaded, result.stats.copied, result.stats.skipped, result.stats.failed
    );

    if result.stats.failed > 0 {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}
