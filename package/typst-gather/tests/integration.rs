//! Integration tests for typst-gather.
//!
//! These tests verify the full gathering workflow including:
//! - Local package copying
//! - Dependency scanning from .typ files
//! - Preview package caching (requires network)

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use tempfile::TempDir;
use typst_gather::{gather_packages, find_imports, Config, PackageEntry};

/// Helper to create a minimal local package with typst.toml
fn create_local_package(dir: &Path, name: &str, version: &str, typ_content: Option<&str>) {
    fs::create_dir_all(dir).unwrap();

    let manifest = format!(
        r#"[package]
name = "{name}"
version = "{version}"
entrypoint = "lib.typ"
"#
    );
    fs::write(dir.join("typst.toml"), manifest).unwrap();

    let content = typ_content.unwrap_or("// Empty package\n");
    fs::write(dir.join("lib.typ"), content).unwrap();
}

mod local_packages {
    use super::*;

    #[test]
    fn cache_single_local_package() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        create_local_package(src_dir.path(), "my-pkg", "1.0.0", None);

        let entries = vec![PackageEntry::Local {
            name: "my-pkg".to_string(),
            dir: src_dir.path().to_path_buf(),
        }];

        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 1);
        assert_eq!(result.stats.failed, 0);

        // Verify package was copied to correct location
        let cached = cache_dir.path().join("local/my-pkg/1.0.0");
        assert!(cached.exists());
        assert!(cached.join("typst.toml").exists());
        assert!(cached.join("lib.typ").exists());
    }

    #[test]
    fn cache_local_package_overwrites_existing() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        // Create initial version
        create_local_package(src_dir.path(), "my-pkg", "1.0.0", Some("// v1"));

        let entries = vec![PackageEntry::Local {
            name: "my-pkg".to_string(),
            dir: src_dir.path().to_path_buf(),
        }];

        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        gather_packages(cache_dir.path(), entries.clone(), &[], &configured_local);

        // Update source
        fs::write(src_dir.path().join("lib.typ"), "// v2").unwrap();

        // Cache again
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);
        assert_eq!(result.stats.copied, 1);

        // Verify new content
        let cached_lib = cache_dir.path().join("local/my-pkg/1.0.0/lib.typ");
        let content = fs::read_to_string(cached_lib).unwrap();
        assert_eq!(content, "// v2");
    }

    #[test]
    fn cache_multiple_local_packages() {
        let src1 = TempDir::new().unwrap();
        let src2 = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        create_local_package(src1.path(), "pkg-one", "1.0.0", None);
        create_local_package(src2.path(), "pkg-two", "2.0.0", None);

        let entries = vec![
            PackageEntry::Local {
                name: "pkg-one".to_string(),
                dir: src1.path().to_path_buf(),
            },
            PackageEntry::Local {
                name: "pkg-two".to_string(),
                dir: src2.path().to_path_buf(),
            },
        ];

        let configured_local: HashSet<String> = ["pkg-one".to_string(), "pkg-two".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 2);
        assert!(cache_dir.path().join("local/pkg-one/1.0.0").exists());
        assert!(cache_dir.path().join("local/pkg-two/2.0.0").exists());
    }

    #[test]
    fn fail_on_name_mismatch() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        // Create package with different name in manifest
        create_local_package(src_dir.path(), "actual-name", "1.0.0", None);

        let entries = vec![PackageEntry::Local {
            name: "wrong-name".to_string(),
            dir: src_dir.path().to_path_buf(),
        }];

        let configured_local: HashSet<String> = ["wrong-name".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 0);
        assert_eq!(result.stats.failed, 1);
    }

    #[test]
    fn fail_on_missing_manifest() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        // Create directory without typst.toml
        fs::create_dir_all(src_dir.path()).unwrap();
        fs::write(src_dir.path().join("lib.typ"), "// no manifest").unwrap();

        let entries = vec![PackageEntry::Local {
            name: "my-pkg".to_string(),
            dir: src_dir.path().to_path_buf(),
        }];

        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 0);
        assert_eq!(result.stats.failed, 1);
    }

    #[test]
    fn fail_on_nonexistent_directory() {
        let cache_dir = TempDir::new().unwrap();

        let entries = vec![PackageEntry::Local {
            name: "my-pkg".to_string(),
            dir: "/nonexistent/path/to/package".into(),
        }];

        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 0);
        assert_eq!(result.stats.failed, 1);
    }

    #[test]
    fn preserves_subdirectories() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        create_local_package(src_dir.path(), "my-pkg", "1.0.0", None);

        // Add subdirectory with files
        let sub = src_dir.path().join("src/utils");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("helper.typ"), "// helper").unwrap();

        let entries = vec![PackageEntry::Local {
            name: "my-pkg".to_string(),
            dir: src_dir.path().to_path_buf(),
        }];

        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 1);

        let cached_helper = cache_dir
            .path()
            .join("local/my-pkg/1.0.0/src/utils/helper.typ");
        assert!(cached_helper.exists());
    }
}

mod dependency_scanning {
    use super::*;

    #[test]
    fn find_imports_in_single_file() {
        let dir = TempDir::new().unwrap();

        let content = r#"
#import "@preview/cetz:0.4.1": canvas
#import "@preview/fletcher:0.5.3"

= Document
"#;
        fs::write(dir.path().join("main.typ"), content).unwrap();

        let imports = find_imports(dir.path());

        assert_eq!(imports.len(), 2);
        let names: Vec<_> = imports.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"cetz"));
        assert!(names.contains(&"fletcher"));
    }

    #[test]
    fn find_imports_in_nested_files() {
        let dir = TempDir::new().unwrap();

        fs::write(
            dir.path().join("main.typ"),
            r#"#import "@preview/cetz:0.4.1""#,
        )
        .unwrap();

        let sub = dir.path().join("chapters");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("intro.typ"), r#"#import "@preview/fletcher:0.5.3""#).unwrap();

        let imports = find_imports(dir.path());

        assert_eq!(imports.len(), 2);
    }

    #[test]
    fn ignore_non_typ_files() {
        let dir = TempDir::new().unwrap();

        fs::write(
            dir.path().join("main.typ"),
            r#"#import "@preview/cetz:0.4.1""#,
        )
        .unwrap();
        fs::write(
            dir.path().join("notes.txt"),
            r#"#import "@preview/ignored:1.0.0""#,
        )
        .unwrap();

        let imports = find_imports(dir.path());

        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].name, "cetz");
    }

    #[test]
    fn find_includes() {
        let dir = TempDir::new().unwrap();

        let content = r#"#include "@preview/template:1.0.0""#;
        fs::write(dir.path().join("main.typ"), content).unwrap();

        let imports = find_imports(dir.path());

        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].name, "template");
    }

    #[test]
    fn ignore_relative_imports() {
        let dir = TempDir::new().unwrap();

        let content = r#"
#import "@preview/cetz:0.4.1"
#import "utils.typ"
#import "../shared/common.typ"
"#;
        fs::write(dir.path().join("main.typ"), content).unwrap();

        let imports = find_imports(dir.path());

        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].name, "cetz");
    }

    #[test]
    fn empty_directory() {
        let dir = TempDir::new().unwrap();
        let imports = find_imports(dir.path());
        assert!(imports.is_empty());
    }
}

mod config_integration {
    use super::*;

    #[test]
    fn parse_and_cache_local_from_toml() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        create_local_package(src_dir.path(), "my-pkg", "1.0.0", None);

        let toml = format!(
            r#"
destination = "{}"

[local]
my-pkg = "{}"
"#,
            cache_dir.path().display(),
            src_dir.path().display()
        );

        let config = Config::parse(&toml).unwrap();
        let dest = config.destination.clone().unwrap();
        let configured_local: HashSet<String> = config.local.keys().cloned().collect();
        let entries = config.into_entries();
        let result = gather_packages(&dest, entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 1);
        assert!(cache_dir.path().join("local/my-pkg/1.0.0").exists());
    }

    #[test]
    fn empty_config_does_nothing() {
        let cache_dir = TempDir::new().unwrap();

        let toml = format!(r#"destination = "{}""#, cache_dir.path().display());
        let config = Config::parse(&toml).unwrap();
        let dest = config.destination.clone().unwrap();
        let configured_local: HashSet<String> = config.local.keys().cloned().collect();
        let entries = config.into_entries();
        let result = gather_packages(&dest, entries, &[], &configured_local);

        assert_eq!(result.stats.downloaded, 0);
        assert_eq!(result.stats.copied, 0);
        assert_eq!(result.stats.skipped, 0);
        assert_eq!(result.stats.failed, 0);
    }

    #[test]
    fn missing_destination_returns_none() {
        let config = Config::parse("").unwrap();
        assert!(config.destination.is_none());
    }

    #[test]
    fn parse_discover_field() {
        let toml = r#"
destination = "/cache"
discover = "/path/to/templates"
"#;
        let config = Config::parse(toml).unwrap();
        assert_eq!(
            config.discover,
            vec![std::path::PathBuf::from("/path/to/templates")]
        );
    }

    #[test]
    fn parse_discover_array() {
        let toml = r#"
destination = "/cache"
discover = ["template.typ", "typst-show.typ"]
"#;
        let config = Config::parse(toml).unwrap();
        assert_eq!(
            config.discover,
            vec![
                std::path::PathBuf::from("template.typ"),
                std::path::PathBuf::from("typst-show.typ"),
            ]
        );
    }
}

mod unconfigured_local {
    use super::*;

    #[test]
    fn detects_unconfigured_local_imports() {
        let cache_dir = TempDir::new().unwrap();
        let discover_dir = TempDir::new().unwrap();

        // Create a .typ file that imports @local/my-pkg
        let content = r#"#import "@local/my-pkg:1.0.0""#;
        fs::write(discover_dir.path().join("template.typ"), content).unwrap();

        // Don't configure my-pkg in the local section
        let configured_local: HashSet<String> = HashSet::new();
        let discover = vec![discover_dir.path().to_path_buf()];

        let result = gather_packages(cache_dir.path(), vec![], &discover, &configured_local);

        // Should have one unconfigured local
        assert_eq!(result.unconfigured_local.len(), 1);
        assert_eq!(result.unconfigured_local[0].0, "my-pkg");
    }

    #[test]
    fn configured_local_not_reported() {
        let cache_dir = TempDir::new().unwrap();
        let discover_dir = TempDir::new().unwrap();

        // Create a .typ file that imports @local/my-pkg
        let content = r#"#import "@local/my-pkg:1.0.0""#;
        fs::write(discover_dir.path().join("template.typ"), content).unwrap();

        // Configure my-pkg (even though we don't actually copy it)
        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        let discover = vec![discover_dir.path().to_path_buf()];

        let result = gather_packages(cache_dir.path(), vec![], &discover, &configured_local);

        // Should have no unconfigured local
        assert!(result.unconfigured_local.is_empty());
    }
}

/// Tests that require network access.
/// Run with: cargo test -- --ignored
mod network {
    use super::*;

    #[test]
    #[ignore = "requires network access"]
    fn download_preview_package() {
        let cache_dir = TempDir::new().unwrap();

        let entries = vec![PackageEntry::Preview {
            name: "example".to_string(),
            version: "0.1.0".to_string(),
        }];

        let configured_local = HashSet::new();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.downloaded, 1);
        assert_eq!(result.stats.failed, 0);

        let cached = cache_dir.path().join("preview/example/0.1.0");
        assert!(cached.exists());
        assert!(cached.join("typst.toml").exists());
    }

    #[test]
    #[ignore = "requires network access"]
    fn download_package_with_dependencies() {
        let cache_dir = TempDir::new().unwrap();

        // cetz has dependencies that should be auto-downloaded
        let entries = vec![PackageEntry::Preview {
            name: "cetz".to_string(),
            version: "0.3.4".to_string(),
        }];

        let configured_local = HashSet::new();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        // Should download cetz plus its dependencies
        assert!(result.stats.downloaded >= 1);
        assert_eq!(result.stats.failed, 0);
    }

    #[test]
    #[ignore = "requires network access"]
    fn skip_already_cached() {
        let cache_dir = TempDir::new().unwrap();

        let entries = vec![PackageEntry::Preview {
            name: "example".to_string(),
            version: "0.1.0".to_string(),
        }];

        let configured_local = HashSet::new();

        // First download
        let result1 = gather_packages(cache_dir.path(), entries.clone(), &[], &configured_local);
        assert_eq!(result1.stats.downloaded, 1);

        // Second run should skip
        let result2 = gather_packages(cache_dir.path(), entries, &[], &configured_local);
        assert_eq!(result2.stats.downloaded, 0);
        assert_eq!(result2.stats.skipped, 1);
    }

    #[test]
    #[ignore = "requires network access"]
    fn fail_on_nonexistent_package() {
        let cache_dir = TempDir::new().unwrap();

        let entries = vec![PackageEntry::Preview {
            name: "this-package-does-not-exist-12345".to_string(),
            version: "0.0.0".to_string(),
        }];

        let configured_local = HashSet::new();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.downloaded, 0);
        assert_eq!(result.stats.failed, 1);
    }

    #[test]
    #[ignore = "requires network access"]
    fn local_package_triggers_preview_deps() {
        let src_dir = TempDir::new().unwrap();
        let cache_dir = TempDir::new().unwrap();

        // Create local package that imports a preview package
        let content = r#"
#import "@preview/example:0.1.0"

#let my-func() = []
"#;
        create_local_package(src_dir.path(), "my-pkg", "1.0.0", Some(content));

        let entries = vec![PackageEntry::Local {
            name: "my-pkg".to_string(),
            dir: src_dir.path().to_path_buf(),
        }];

        let configured_local: HashSet<String> = ["my-pkg".to_string()].into_iter().collect();
        let result = gather_packages(cache_dir.path(), entries, &[], &configured_local);

        assert_eq!(result.stats.copied, 1);
        assert!(result.stats.downloaded >= 1); // Should have downloaded example

        assert!(cache_dir.path().join("local/my-pkg/1.0.0").exists());
        assert!(cache_dir.path().join("preview/example/0.1.0").exists());
    }
}
