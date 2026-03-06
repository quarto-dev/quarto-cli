/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { info } from "../../../deno_ral/log.ts";

import { architectureToolsPath } from "../../../core/resources.ts";
import { execProcess } from "../../../core/process.ts";
import { dirname, join, relative } from "../../../deno_ral/path.ts";
import { existsSync } from "../../../deno_ral/fs.ts";
import { isWindows } from "../../../deno_ral/platform.ts";
import { expandGlobSync } from "../../../core/deno/expand-glob.ts";
import { readYaml } from "../../../core/yaml.ts";

// Convert path to use forward slashes for TOML compatibility
// TOML treats backslash as escape character, so Windows paths must use forward slashes
function toTomlPath(p: string): string {
  return p.replace(/\\/g, "/");
}

interface ExtensionYml {
  contributes?: {
    formats?: {
      typst?: {
        template?: string;
        "template-partials"?: string[];
      };
    };
  };
}

interface TypstGatherConfig {
  configFile?: string; // Path to config file if one was found
  rootdir?: string;
  destination: string;
  discover: string[];
}

async function findExtensionDir(): Promise<string | null> {
  const cwd = Deno.cwd();

  // Check if we're in an extension directory (has _extension.yml)
  if (existsSync(join(cwd, "_extension.yml"))) {
    return cwd;
  }

  // Check if there's an _extensions directory with a single extension
  const extensionsDir = join(cwd, "_extensions");
  if (existsSync(extensionsDir)) {
    const extensionDirs: string[] = [];
    for (const entry of expandGlobSync("_extensions/**/_extension.yml")) {
      extensionDirs.push(dirname(entry.path));
    }

    if (extensionDirs.length === 1) {
      return extensionDirs[0];
    } else if (extensionDirs.length > 1) {
      console.error("Multiple extension directories found.\n");
      console.error(
        "Run this command from within a specific extension directory,",
      );
      console.error(
        "or create a typst-gather.toml to specify the configuration.",
      );
      return null;
    }
  }

  return null;
}

function extractTypstFiles(extensionDir: string): string[] {
  const extensionYmlPath = join(extensionDir, "_extension.yml");

  if (!existsSync(extensionYmlPath)) {
    return [];
  }

  try {
    const yml = readYaml(extensionYmlPath) as ExtensionYml;
    const typstConfig = yml?.contributes?.formats?.typst;

    if (!typstConfig) {
      return [];
    }

    const files: string[] = [];

    // Add template if specified
    if (typstConfig.template) {
      files.push(join(extensionDir, typstConfig.template));
    }

    // Add template-partials if specified
    if (typstConfig["template-partials"]) {
      for (const partial of typstConfig["template-partials"]) {
        files.push(join(extensionDir, partial));
      }
    }

    return files;
  } catch {
    return [];
  }
}

async function resolveConfig(
  extensionDir: string | null,
): Promise<TypstGatherConfig | null> {
  const cwd = Deno.cwd();

  // First, check for typst-gather.toml in current directory
  const configPath = join(cwd, "typst-gather.toml");
  if (existsSync(configPath)) {
    info(`Using config: ${configPath}`);
    return {
      configFile: configPath,
      destination: "",
      discover: [],
    };
  }

  // No config file - try to auto-detect from _extension.yml
  if (!extensionDir) {
    console.error(
      "No typst-gather.toml found and no extension directory detected.\n",
    );
    console.error("Either:");
    console.error("  1. Create a typst-gather.toml file, or");
    console.error(
      "  2. Run from within an extension directory with _extension.yml",
    );
    return null;
  }

  const typstFiles = extractTypstFiles(extensionDir);

  if (typstFiles.length === 0) {
    console.error("No Typst files found in _extension.yml.\n");
    console.error(
      "The extension must define 'template' or 'template-partials' under contributes.formats.typst",
    );
    return null;
  }

  // Default destination is 'typst/packages' directory in extension folder
  const destination = join(extensionDir, "typst/packages");

  // Show paths relative to cwd for cleaner output
  const relDest = relative(cwd, destination);
  const relFiles = typstFiles.map((f) => relative(cwd, f));

  info(`Auto-detected from _extension.yml:`);
  info(`  Destination: ${relDest}`);
  info(`  Files to scan: ${relFiles.join(", ")}`);

  return {
    destination,
    discover: typstFiles,
  };
}

export interface AnalyzeImport {
  namespace: string;
  name: string;
  version: string;
  source: string;
  direct: boolean;
}

export interface AnalyzeResult {
  imports: AnalyzeImport[];
  files: string[];
}

function typstGatherBinaryPath(): string {
  const binaryName = isWindows ? "typst-gather.exe" : "typst-gather";
  const binary = Deno.env.get("QUARTO_TYPST_GATHER") ||
    architectureToolsPath(binaryName);

  if (!existsSync(binary)) {
    throw new Error(
      `typst-gather binary not found.\n` +
        `Run ./configure.sh to build and install it.`,
    );
  }

  return binary;
}

async function runAnalyze(tomlConfig: string): Promise<AnalyzeResult> {
  const binary = typstGatherBinaryPath();

  const result = await execProcess(
    {
      cmd: binary,
      args: ["analyze", "-"],
      stdout: "piped",
      stderr: "piped",
    },
    tomlConfig,
  );

  if (!result.success) {
    throw new Error(
      result.stderr || "typst-gather analyze failed",
    );
  }

  return JSON.parse(result.stdout!) as AnalyzeResult;
}

export function generateConfigFromAnalysis(
  result: AnalyzeResult,
  rootdir?: string,
): string {
  const lines: string[] = [];

  lines.push("# typst-gather configuration");
  lines.push("# Run: quarto call typst-gather");
  lines.push("");

  if (rootdir) {
    lines.push(`rootdir = "${toTomlPath(rootdir)}"`);
  }
  lines.push('destination = "typst/packages"');
  lines.push("");

  // Discover section
  if (result.files.length === 1) {
    lines.push(`discover = "${toTomlPath(result.files[0])}"`);
  } else if (result.files.length > 1) {
    const files = result.files.map((f) => `"${toTomlPath(f)}"`).join(", ");
    lines.push(`discover = [${files}]`);
  } else {
    lines.push('# discover = "template.typ"  # Add your .typ files here');
  }

  lines.push("");

  // Preview section (commented out - packages will be auto-discovered)
  const previewImports = result.imports.filter((i) =>
    i.namespace === "preview"
  );
  lines.push("# Preview packages are auto-discovered from imports.");
  lines.push("# Uncomment to pin specific versions:");
  lines.push("# [preview]");
  if (previewImports.length > 0) {
    const seen = new Set<string>();
    for (const { name, version, direct, source } of previewImports) {
      if (!seen.has(name)) {
        seen.add(name);
        const suffix = direct ? "" : `  # via ${source}`;
        lines.push(`# ${name} = "${version}"${suffix}`);
      }
    }
  } else {
    lines.push('# cetz = "0.4.1"');
  }

  lines.push("");

  // Local section
  const localImports = result.imports.filter(
    (i) => i.namespace === "local" && i.direct,
  );
  lines.push(
    "# Local packages (@local namespace) must be configured manually.",
  );
  if (localImports.length > 0) {
    lines.push("# Found @local imports:");
    const seen = new Set<string>();
    for (const { name, version, source } of localImports) {
      if (!seen.has(name)) {
        seen.add(name);
        lines.push(`#   @local/${name}:${version} (in ${source})`);
      }
    }
    lines.push("[local]");
    seen.clear();
    for (const { name } of localImports) {
      if (!seen.has(name)) {
        seen.add(name);
        lines.push(`${name} = "/path/to/${name}"  # TODO: set correct path`);
      }
    }
  } else {
    lines.push("# [local]");
    lines.push('# my-pkg = "/path/to/my-pkg"');
  }

  lines.push("");
  return lines.join("\n");
}

async function initConfig(): Promise<void> {
  const configFile = join(Deno.cwd(), "typst-gather.toml");

  // Check if config already exists
  if (existsSync(configFile)) {
    console.error("typst-gather.toml already exists");
    console.error("Remove it first or edit it manually.");
    Deno.exit(1);
  }

  // Find typst files via extension directory structure
  const extensionDir = await findExtensionDir();

  if (!extensionDir) {
    console.error("No extension directory found.");
    console.error(
      "Run this command from a directory containing _extension.yml or _extensions/",
    );
    Deno.exit(1);
  }

  const typFiles = extractTypstFiles(extensionDir);

  if (typFiles.length === 0) {
    info("Warning: No .typ files found in _extension.yml.");
    info(
      "Edit the generated typst-gather.toml to configure local or pinned dependencies.",
    );
  } else {
    info(`Found extension: ${extensionDir}`);
  }

  // Build analyze config with discover paths
  const discoverArray = typFiles.map((f) => `"${toTomlPath(f)}"`).join(", ");
  const analyzeConfig = `discover = [${discoverArray}]\n`;

  // Run typst-gather analyze to discover imports
  const analysis = await runAnalyze(analyzeConfig);

  // Calculate relative path from cwd to extension dir for rootdir
  const rootdir = relative(Deno.cwd(), extensionDir);

  // Generate config content from analysis
  const configContent = generateConfigFromAnalysis(analysis, rootdir);

  // Write config file
  try {
    Deno.writeTextFileSync(configFile, configContent);
  } catch (e) {
    console.error(`Error writing typst-gather.toml: ${e}`);
    Deno.exit(1);
  }

  const previewImports = analysis.imports.filter(
    (i) => i.namespace === "preview",
  );
  const localImports = analysis.imports.filter(
    (i) => i.namespace === "local" && i.direct,
  );

  info("Created typst-gather.toml");
  if (analysis.files.length > 0) {
    info(`  Scanned: ${analysis.files.join(", ")}`);
  }
  if (previewImports.length > 0) {
    info(`  Found ${previewImports.length} @preview import(s)`);
  }
  if (localImports.length > 0) {
    info(
      `  Found ${localImports.length} @local import(s) - configure paths in [local] section`,
    );
  }

  info("");
  info("Next steps:");
  info("  1. Review and edit typst-gather.toml");
  if (localImports.length > 0) {
    info("  2. Add paths for @local packages in [local] section");
  }
  info("  3. Run: quarto call typst-gather");
}

export const typstGatherCommand = new Command()
  .name("typst-gather")
  .description(
    "Gather Typst packages for a format extension.\n\n" +
      "This command scans Typst files for @preview imports and downloads " +
      "the packages to a local directory for offline use.\n\n" +
      "Configuration is determined by:\n" +
      "  1. typst-gather.toml in current directory (if present)\n" +
      "  2. Auto-detection from _extension.yml (template and template-partials)",
  )
  .option(
    "--init-config",
    "Generate a starter typst-gather.toml in current directory",
  )
  .action(async (options: { initConfig?: boolean }) => {
    // Handle --init-config
    if (options.initConfig) {
      await initConfig();
      return;
    }
    try {
      // Find extension directory
      const extensionDir = await findExtensionDir();

      // Resolve configuration
      const config = await resolveConfig(extensionDir);
      if (!config) {
        Deno.exit(1);
      }

      const typstGatherBinary = typstGatherBinaryPath();

      info(`Running typst-gather...`);

      // Run typst-gather gather
      let result;
      if (config.configFile) {
        // Existing config file — pass directly
        result = await execProcess({
          cmd: typstGatherBinary,
          args: ["gather", config.configFile],
          cwd: Deno.cwd(),
        });
      } else {
        // Auto-detected — pipe config on stdin
        const discoverArray = config.discover.map((p) => `"${toTomlPath(p)}"`)
          .join(", ");
        let tomlContent = "";
        if (config.rootdir) {
          tomlContent += `rootdir = "${toTomlPath(config.rootdir)}"\n`;
        }
        tomlContent += `destination = "${toTomlPath(config.destination)}"\n`;
        tomlContent += `discover = [${discoverArray}]\n`;

        result = await execProcess(
          {
            cmd: typstGatherBinary,
            args: ["gather", "-"],
            cwd: Deno.cwd(),
          },
          tomlContent,
        );
      }

      if (!result.success) {
        // Print any output from the tool
        if (result.stdout) {
          console.log(result.stdout);
        }
        if (result.stderr) {
          console.error(result.stderr);
        }

        // Check for @local imports not configured error and suggest --init-config
        // Only suggest if no config file was found
        const output = (result.stdout || "") + (result.stderr || "");
        if (
          output.includes("@local imports not configured") && !config.configFile
        ) {
          console.error("");
          console.error(
            "Tip: Run 'quarto call typst-gather --init-config' to generate a config file",
          );
          console.error(
            "     with placeholders for your @local package paths.",
          );
        }

        Deno.exit(1);
      }

      info("Done!");
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
      } else {
        console.error(String(e));
      }
      Deno.exit(1);
    }
  });
