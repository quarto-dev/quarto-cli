//! typst-gather: Gather Typst packages locally for offline/hermetic builds.

use std::collections::HashMap;
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};

use ecow::EcoString;
use globset::{Glob, GlobSetBuilder};
use serde::Deserialize;
use typst_kit::download::{Downloader, ProgressSink};
use typst_kit::package::PackageStorage;
use typst_syntax::ast;
use typst_syntax::package::{PackageManifest, PackageSpec, PackageVersion};
use typst_syntax::SyntaxNode;
use walkdir::WalkDir;

/// Statistics about gathering operations.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Stats {
    pub downloaded: usize,
    pub copied: usize,
    pub skipped: usize,
    pub failed: usize,
}

/// Result of a gather operation.
#[derive(Debug, Default)]
pub struct GatherResult {
    pub stats: Stats,
    /// @local imports discovered during scanning that are not configured in [local] section.
    /// Each entry is (package_name, source_file_path).
    pub unconfigured_local: Vec<(String, String)>,
}

/// TOML configuration format.
///
/// ```toml
/// destination = "/path/to/packages"
/// discover = ["/path/to/templates", "/path/to/other.typ"]
///
/// [preview]
/// cetz = "0.4.1"
/// fletcher = "0.5.3"
///
/// [local]
/// my-pkg = "/path/to/pkg"
/// ```
/// Helper enum for deserializing string or array of strings
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum StringOrVec {
    Single(String),
    Multiple(Vec<String>),
}

impl Default for StringOrVec {
    fn default() -> Self {
        StringOrVec::Multiple(Vec::new())
    }
}

impl From<StringOrVec> for Vec<PathBuf> {
    fn from(value: StringOrVec) -> Self {
        match value {
            StringOrVec::Single(s) => vec![PathBuf::from(s)],
            StringOrVec::Multiple(v) => v.into_iter().map(PathBuf::from).collect(),
        }
    }
}

/// Raw config for deserialization
#[derive(Debug, Deserialize, Default)]
struct RawConfig {
    /// Root directory for resolving relative paths (discover, destination)
    rootdir: Option<PathBuf>,
    destination: Option<PathBuf>,
    #[serde(default)]
    discover: Option<StringOrVec>,
    #[serde(default)]
    preview: HashMap<String, String>,
    #[serde(default)]
    local: HashMap<String, String>,
}

#[derive(Debug, Default)]
pub struct Config {
    /// Root directory for resolving relative paths (discover, destination).
    /// If set, discover and destination paths are resolved relative to this.
    pub rootdir: Option<PathBuf>,
    /// Destination directory for gathered packages
    pub destination: Option<PathBuf>,
    /// Paths to scan for imports. Can be directories (scans .typ files) or individual .typ files.
    /// Accepts either a single path or an array of paths.
    pub discover: Vec<PathBuf>,
    pub preview: HashMap<String, String>,
    pub local: HashMap<String, String>,
}

impl From<RawConfig> for Config {
    fn from(raw: RawConfig) -> Self {
        Config {
            rootdir: raw.rootdir,
            destination: raw.destination,
            discover: raw.discover.map(Into::into).unwrap_or_default(),
            preview: raw.preview,
            local: raw.local,
        }
    }
}

/// A resolved package entry ready for gathering.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PackageEntry {
    Preview { name: String, version: String },
    Local { name: String, dir: PathBuf },
}

impl Config {
    /// Parse a TOML configuration string.
    pub fn parse(content: &str) -> Result<Self, toml::de::Error> {
        let raw: RawConfig = toml::from_str(content)?;
        Ok(raw.into())
    }

    /// Convert config into a list of package entries.
    pub fn into_entries(self) -> Vec<PackageEntry> {
        let mut entries = Vec::new();

        for (name, version) in self.preview {
            entries.push(PackageEntry::Preview { name, version });
        }

        for (name, dir) in self.local {
            entries.push(PackageEntry::Local {
                name,
                dir: PathBuf::from(dir),
            });
        }

        entries
    }
}

/// Context for gathering operations, holding shared state.
struct GatherContext<'a> {
    storage: PackageStorage,
    dest: &'a Path,
    configured_local: &'a HashSet<String>,
    processed: HashSet<String>,
    stats: Stats,
    /// @local imports discovered during scanning (name -> source_file)
    discovered_local: HashMap<String, String>,
}

impl<'a> GatherContext<'a> {
    fn new(dest: &'a Path, configured_local: &'a HashSet<String>) -> Self {
        Self {
            storage: PackageStorage::new(
                Some(dest.to_path_buf()),
                None,
                Downloader::new("typst-gather/0.1.0"),
            ),
            dest,
            configured_local,
            processed: HashSet::new(),
            stats: Stats::default(),
            discovered_local: HashMap::new(),
        }
    }
}

/// Gather packages to the destination directory.
pub fn gather_packages(
    dest: &Path,
    entries: Vec<PackageEntry>,
    discover_paths: &[PathBuf],
    configured_local: &HashSet<String>,
) -> GatherResult {
    let mut ctx = GatherContext::new(dest, configured_local);

    // First, process discover paths
    for path in discover_paths {
        discover_imports(&mut ctx, path);
    }

    // Then process explicit entries
    for entry in entries {
        match entry {
            PackageEntry::Preview { name, version } => {
                cache_preview(&mut ctx, &name, &version);
            }
            PackageEntry::Local { name, dir } => {
                gather_local(&mut ctx, &name, &dir);
            }
        }
    }

    // Find @local imports that aren't configured
    let unconfigured_local: Vec<(String, String)> = ctx.discovered_local
        .into_iter()
        .filter(|(name, _)| !ctx.configured_local.contains(name))
        .collect();

    GatherResult {
        stats: ctx.stats,
        unconfigured_local,
    }
}

/// Scan a path for imports. If it's a directory, scans .typ files in it (non-recursive).
/// If it's a file, scans that file directly.
fn discover_imports(ctx: &mut GatherContext, path: &Path) {
    if path.is_file() {
        // Single file
        if path.extension().is_some_and(|e| e == "typ") {
            println!("Discovering imports in {}...", display_path(path));
            scan_file_for_imports(ctx, path);
        }
    } else if path.is_dir() {
        // Directory - scan .typ files (non-recursive)
        println!("Discovering imports in {}...", display_path(path));

        let entries = match std::fs::read_dir(path) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("  Failed to read directory: {e}");
                ctx.stats.failed += 1;
                return;
            }
        };

        for entry in entries.flatten() {
            let file_path = entry.path();
            if file_path.is_file() && file_path.extension().is_some_and(|e| e == "typ") {
                scan_file_for_imports(ctx, &file_path);
            }
        }
    } else {
        eprintln!("Warning: discover path does not exist: {}", display_path(path));
    }
}

/// Scan a single .typ file for @preview and @local imports.
/// @preview imports are cached, @local imports are tracked for later warning.
fn scan_file_for_imports(ctx: &mut GatherContext, path: &Path) {
    if let Ok(content) = std::fs::read_to_string(path) {
        let mut imports = Vec::new();
        collect_imports(&typst_syntax::parse(&content), &mut imports);

        let source_file = path.file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.display().to_string());

        for spec in imports {
            if spec.namespace == "preview" {
                cache_preview_with_deps(ctx, &spec);
            } else if spec.namespace == "local" {
                // Track @local imports (only first occurrence per package name)
                ctx.discovered_local.entry(spec.name.to_string())
                    .or_insert(source_file.clone());
            }
        }
    }
}

fn cache_preview(ctx: &mut GatherContext, name: &str, version_str: &str) {
    let Ok(version): Result<PackageVersion, _> = version_str.parse() else {
        eprintln!("Invalid version '{version_str}' for @preview/{name}");
        ctx.stats.failed += 1;
        return;
    };

    let spec = PackageSpec {
        namespace: EcoString::from("preview"),
        name: EcoString::from(name),
        version,
    };

    cache_preview_with_deps(ctx, &spec);
}

/// Default exclude patterns for local packages (common non-package files).
const DEFAULT_EXCLUDES: &[&str] = &[
    ".git",
    ".git/**",
    ".github",
    ".github/**",
    ".gitignore",
    ".gitattributes",
    ".vscode",
    ".vscode/**",
    ".idea",
    ".idea/**",
    "*.bak",
    "*.swp",
    "*~",
];

fn gather_local(ctx: &mut GatherContext, name: &str, src_dir: &Path) {
    // Read typst.toml to get version (and validate name)
    let manifest_path = src_dir.join("typst.toml");
    let manifest: PackageManifest = match std::fs::read_to_string(&manifest_path)
        .map_err(|e| e.to_string())
        .and_then(|s| toml::from_str(&s).map_err(|e| e.to_string()))
    {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Error reading typst.toml for @local/{name}: {e}");
            ctx.stats.failed += 1;
            return;
        }
    };

    // Validate name matches
    if manifest.package.name.as_str() != name {
        eprintln!(
            "Name mismatch for @local/{name}: typst.toml has '{}'",
            manifest.package.name
        );
        ctx.stats.failed += 1;
        return;
    }

    let version = manifest.package.version;
    let dest_dir = ctx.dest.join(format!("local/{name}/{version}"));

    println!("Copying @local/{name}:{version}...");

    // Clean slate: remove destination if exists
    if dest_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&dest_dir) {
            eprintln!("  Failed to remove existing dir: {e}");
            ctx.stats.failed += 1;
            return;
        }
    }

    // Build exclude pattern matcher from defaults + manifest excludes
    let mut builder = GlobSetBuilder::new();
    for pattern in DEFAULT_EXCLUDES {
        if let Ok(glob) = Glob::new(pattern) {
            builder.add(glob);
        }
    }
    // Add manifest excludes if present
    for pattern in &manifest.package.exclude {
        if let Ok(glob) = Glob::new(pattern.as_str()) {
            builder.add(glob);
        }
    }
    let excludes = builder.build().unwrap_or_else(|_| GlobSetBuilder::new().build().unwrap());

    // Copy files, respecting exclude patterns
    if let Err(e) = copy_filtered(src_dir, &dest_dir, &excludes) {
        eprintln!("  Failed to copy: {e}");
        ctx.stats.failed += 1;
        return;
    }

    println!("  -> {}", display_path(&dest_dir));
    ctx.stats.copied += 1;

    // Mark as processed
    let spec = PackageSpec {
        namespace: EcoString::from("local"),
        name: EcoString::from(name),
        version,
    };
    ctx.processed.insert(spec.to_string());

    // Scan for @preview dependencies
    scan_deps(ctx, &dest_dir);
}

/// Copy directory contents, excluding files that match the exclude patterns.
fn copy_filtered(
    src: &Path,
    dest: &Path,
    excludes: &globset::GlobSet,
) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;

    for entry in WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative = path.strip_prefix(src).unwrap_or(path);

        // Check if this path matches any exclude pattern
        if excludes.is_match(relative) {
            continue;
        }

        let dest_path = dest.join(relative);

        if path.is_dir() {
            std::fs::create_dir_all(&dest_path)?;
        } else if path.is_file() {
            if let Some(parent) = dest_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(path, &dest_path)?;
        }
    }

    Ok(())
}

fn cache_preview_with_deps(ctx: &mut GatherContext, spec: &PackageSpec) {
    // Skip @preview packages that are configured as @local (use local version instead)
    if ctx.configured_local.contains(spec.name.as_str()) {
        return;
    }

    let key = spec.to_string();
    if !ctx.processed.insert(key) {
        return;
    }

    let subdir = format!("{}/{}/{}", spec.namespace, spec.name, spec.version);
    let cached_path = ctx.storage.package_cache_path().map(|p| p.join(&subdir));

    if cached_path.as_ref().is_some_and(|p| p.exists()) {
        println!("Skipping {spec} (cached)");
        ctx.stats.skipped += 1;
        scan_deps(ctx, cached_path.as_ref().unwrap());
        return;
    }

    println!("Downloading {spec}...");
    match ctx.storage.prepare_package(spec, &mut ProgressSink) {
        Ok(path) => {
            println!("  -> {}", display_path(&path));
            ctx.stats.downloaded += 1;
            scan_deps(ctx, &path);
        }
        Err(e) => {
            eprintln!("  Failed: {e:?}");
            ctx.stats.failed += 1;
        }
    }
}

fn scan_deps(ctx: &mut GatherContext, dir: &Path) {
    for spec in find_imports(dir) {
        if spec.namespace == "preview" {
            cache_preview_with_deps(ctx, &spec);
        }
    }
}

/// Display a path relative to the current working directory.
fn display_path(path: &Path) -> String {
    if let Ok(cwd) = env::current_dir() {
        if let Ok(relative) = path.strip_prefix(&cwd) {
            return relative.display().to_string();
        }
    }
    path.display().to_string()
}

/// Find all package imports in `.typ` files under a directory.
pub fn find_imports(dir: &Path) -> Vec<PackageSpec> {
    let mut imports = Vec::new();
    for entry in WalkDir::new(dir).into_iter().flatten() {
        if entry.path().extension().is_some_and(|e| e == "typ") {
            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                collect_imports(&typst_syntax::parse(&content), &mut imports);
            }
        }
    }
    imports
}

/// Extract package imports from a Typst syntax tree.
pub fn collect_imports(node: &SyntaxNode, imports: &mut Vec<PackageSpec>) {
    if let Some(import) = node.cast::<ast::ModuleImport>() {
        if let Some(spec) = try_extract_spec(import.source()) {
            imports.push(spec);
        }
    }
    if let Some(include) = node.cast::<ast::ModuleInclude>() {
        if let Some(spec) = try_extract_spec(include.source()) {
            imports.push(spec);
        }
    }
    for child in node.children() {
        collect_imports(child, imports);
    }
}

/// Try to extract a PackageSpec from an expression (if it's an `@namespace/name:version` string).
pub fn try_extract_spec(expr: ast::Expr) -> Option<PackageSpec> {
    if let ast::Expr::Str(s) = expr {
        let val = s.get();
        if val.starts_with('@') {
            return val.parse().ok();
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    mod config_parsing {
        use super::*;

        #[test]
        fn empty_config() {
            let config = Config::parse("").unwrap();
            assert!(config.destination.is_none());
            assert!(config.discover.is_empty());
            assert!(config.preview.is_empty());
            assert!(config.local.is_empty());
        }

        #[test]
        fn destination_only() {
            let toml = r#"destination = "/path/to/cache""#;
            let config = Config::parse(toml).unwrap();
            assert_eq!(config.destination, Some(PathBuf::from("/path/to/cache")));
            assert!(config.discover.is_empty());
            assert!(config.preview.is_empty());
            assert!(config.local.is_empty());
        }

        #[test]
        fn with_discover_string() {
            let toml = r#"
destination = "/cache"
discover = "/path/to/templates"
"#;
            let config = Config::parse(toml).unwrap();
            assert_eq!(config.destination, Some(PathBuf::from("/cache")));
            assert_eq!(config.discover, vec![PathBuf::from("/path/to/templates")]);
        }

        #[test]
        fn with_discover_array() {
            let toml = r#"
destination = "/cache"
discover = ["/path/to/templates", "template.typ", "other.typ"]
"#;
            let config = Config::parse(toml).unwrap();
            assert_eq!(config.destination, Some(PathBuf::from("/cache")));
            assert_eq!(
                config.discover,
                vec![
                    PathBuf::from("/path/to/templates"),
                    PathBuf::from("template.typ"),
                    PathBuf::from("other.typ"),
                ]
            );
        }

        #[test]
        fn preview_only() {
            let toml = r#"
destination = "/cache"

[preview]
cetz = "0.4.1"
fletcher = "0.5.3"
"#;
            let config = Config::parse(toml).unwrap();
            assert_eq!(config.destination, Some(PathBuf::from("/cache")));
            assert_eq!(config.preview.len(), 2);
            assert_eq!(config.preview.get("cetz"), Some(&"0.4.1".to_string()));
            assert_eq!(config.preview.get("fletcher"), Some(&"0.5.3".to_string()));
            assert!(config.local.is_empty());
        }

        #[test]
        fn local_only() {
            let toml = r#"
destination = "/cache"

[local]
my-pkg = "/path/to/pkg"
other = "../relative/path"
"#;
            let config = Config::parse(toml).unwrap();
            assert!(config.preview.is_empty());
            assert_eq!(config.local.len(), 2);
            assert_eq!(config.local.get("my-pkg"), Some(&"/path/to/pkg".to_string()));
            assert_eq!(config.local.get("other"), Some(&"../relative/path".to_string()));
        }

        #[test]
        fn mixed_config() {
            let toml = r#"
destination = "/cache"

[preview]
cetz = "0.4.1"

[local]
my-pkg = "/path/to/pkg"
"#;
            let config = Config::parse(toml).unwrap();
            assert_eq!(config.destination, Some(PathBuf::from("/cache")));
            assert_eq!(config.preview.len(), 1);
            assert_eq!(config.local.len(), 1);
        }

        #[test]
        fn into_entries() {
            let toml = r#"
destination = "/cache"

[preview]
cetz = "0.4.1"

[local]
my-pkg = "/path/to/pkg"
"#;
            let config = Config::parse(toml).unwrap();
            let entries = config.into_entries();
            assert_eq!(entries.len(), 2);

            let has_preview = entries.iter().any(|e| {
                matches!(e, PackageEntry::Preview { name, version }
                    if name == "cetz" && version == "0.4.1")
            });
            let has_local = entries.iter().any(|e| {
                matches!(e, PackageEntry::Local { name, dir }
                    if name == "my-pkg" && dir == Path::new("/path/to/pkg"))
            });
            assert!(has_preview);
            assert!(has_local);
        }

        #[test]
        fn invalid_toml() {
            let result = Config::parse("not valid toml [[[");
            assert!(result.is_err());
        }

        #[test]
        fn extra_fields_ignored() {
            let toml = r#"
destination = "/cache"

[preview]
cetz = "0.4.1"

[unknown_section]
foo = "bar"
"#;
            // Should not error on unknown sections
            let config = Config::parse(toml).unwrap();
            assert_eq!(config.preview.len(), 1);
        }
    }

    mod import_parsing {
        use super::*;

        fn parse_imports(code: &str) -> Vec<PackageSpec> {
            let mut imports = Vec::new();
            collect_imports(&typst_syntax::parse(code), &mut imports);
            imports
        }

        #[test]
        fn simple_import() {
            let imports = parse_imports(r#"#import "@preview/cetz:0.4.1""#);
            assert_eq!(imports.len(), 1);
            assert_eq!(imports[0].namespace, "preview");
            assert_eq!(imports[0].name, "cetz");
            assert_eq!(imports[0].version.to_string(), "0.4.1");
        }

        #[test]
        fn import_with_items() {
            let imports = parse_imports(r#"#import "@preview/cetz:0.4.1": canvas, draw"#);
            assert_eq!(imports.len(), 1);
            assert_eq!(imports[0].name, "cetz");
        }

        #[test]
        fn multiple_imports() {
            let code = r#"
#import "@preview/cetz:0.4.1"
#import "@preview/fletcher:0.5.3"
"#;
            let imports = parse_imports(code);
            assert_eq!(imports.len(), 2);
        }

        #[test]
        fn include_statement() {
            let imports = parse_imports(r#"#include "@preview/template:1.0.0""#);
            assert_eq!(imports.len(), 1);
            assert_eq!(imports[0].name, "template");
        }

        #[test]
        fn local_import_ignored_in_extract() {
            // Local imports are valid but won't be recursively fetched
            let imports = parse_imports(r#"#import "@local/my-pkg:1.0.0""#);
            assert_eq!(imports.len(), 1);
            assert_eq!(imports[0].namespace, "local");
        }

        #[test]
        fn relative_import_ignored() {
            let imports = parse_imports(r#"#import "utils.typ""#);
            assert_eq!(imports.len(), 0);
        }

        #[test]
        fn no_imports() {
            let imports = parse_imports(r#"= Hello World"#);
            assert_eq!(imports.len(), 0);
        }

        #[test]
        fn nested_in_function() {
            let code = r#"
#let setup() = {
  import "@preview/cetz:0.4.1"
}
"#;
            let imports = parse_imports(code);
            assert_eq!(imports.len(), 1);
        }

        #[test]
        fn invalid_package_spec_ignored() {
            // Missing version
            let imports = parse_imports(r#"#import "@preview/cetz""#);
            assert_eq!(imports.len(), 0);
        }

        #[test]
        fn complex_document() {
            let code = r#"
#import "@preview/cetz:0.4.1": canvas
#import "@preview/fletcher:0.5.3": diagram, node, edge
#import "local-file.typ": helper

= My Document

#include "@preview/template:1.0.0"

Some content here.

#let f() = {
  import "@preview/codly:1.2.0"
}
"#;
            let imports = parse_imports(code);
            assert_eq!(imports.len(), 4);

            let names: Vec<_> = imports.iter().map(|s| s.name.as_str()).collect();
            assert!(names.contains(&"cetz"));
            assert!(names.contains(&"fletcher"));
            assert!(names.contains(&"template"));
            assert!(names.contains(&"codly"));
        }
    }

    mod stats {
        use super::*;

        #[test]
        fn default_stats() {
            let stats = Stats::default();
            assert_eq!(stats.downloaded, 0);
            assert_eq!(stats.copied, 0);
            assert_eq!(stats.skipped, 0);
            assert_eq!(stats.failed, 0);
        }
    }

    mod local_override {
        use super::*;

        /// When a package is configured in [local], @preview imports of the same
        /// package name should be skipped. This handles the case where a local
        /// package contains template examples that import from @preview.
        #[test]
        fn configured_local_contains_check() {
            let mut configured_local = HashSet::new();
            configured_local.insert("my-pkg".to_string());
            configured_local.insert("other-pkg".to_string());

            // These should be skipped (configured as local)
            assert!(configured_local.contains("my-pkg"));
            assert!(configured_local.contains("other-pkg"));

            // These should NOT be skipped (not configured)
            assert!(!configured_local.contains("cetz"));
            assert!(!configured_local.contains("fletcher"));
        }
    }

    mod copy_filtering {
        use super::*;

        #[test]
        fn default_excludes_match_git() {
            let mut builder = GlobSetBuilder::new();
            for pattern in DEFAULT_EXCLUDES {
                builder.add(Glob::new(pattern).unwrap());
            }
            let excludes = builder.build().unwrap();

            // Should match .git and contents
            assert!(excludes.is_match(".git"));
            assert!(excludes.is_match(".git/config"));
            assert!(excludes.is_match(".git/objects/pack/foo"));

            // Should match .github
            assert!(excludes.is_match(".github"));
            assert!(excludes.is_match(".github/workflows/ci.yml"));

            // Should match editor files
            assert!(excludes.is_match(".gitignore"));
            assert!(excludes.is_match("foo.bak"));
            assert!(excludes.is_match("foo.swp"));
            assert!(excludes.is_match("foo~"));

            // Should NOT match normal files
            assert!(!excludes.is_match("lib.typ"));
            assert!(!excludes.is_match("typst.toml"));
            assert!(!excludes.is_match("src/main.typ"));
            assert!(!excludes.is_match("template/main.typ"));
        }
    }
}
