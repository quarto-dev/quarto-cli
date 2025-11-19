/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { error, info } from "../../../deno_ral/log.ts";
import {
  architectureToolsPath,
  resourcePath,
} from "../../../core/resources.ts";
import { execProcess } from "../../../core/process.ts";
import { basename, dirname, extname, join } from "../../../deno_ral/path.ts";
import { existsSync } from "../../../deno_ral/fs.ts";

interface DenoConfig {
  compilerOptions?: Record<string, unknown>;
  importMap?: string;
  imports?: Record<string, string>;
  quartoExtension?: {
    entryPoint?: string;
    outputFile?: string;
    minify?: boolean;
    sourcemap?: boolean;
    target?: string;
  };
}

interface BuildOptions {
  check?: boolean;
}

async function resolveConfig(): Promise<
  { config: DenoConfig; configPath: string }
> {
  // Look for deno.json in current directory
  const cwd = Deno.cwd();
  const userConfigPath = join(cwd, "deno.json");

  if (existsSync(userConfigPath)) {
    info(`Using config: ${userConfigPath}`);
    const content = Deno.readTextFileSync(userConfigPath);
    const config = JSON.parse(content) as DenoConfig;

    // Validate that both importMap and imports are not present
    if (config.importMap && config.imports) {
      error('Error: deno.json contains both "importMap" and "imports"');
      error("");
      error(
        'deno.json can use either "importMap" (path to file) OR "imports" (inline mappings), but not both.',
      );
      error("");
      error("Please remove one of these fields from your deno.json.");
      Deno.exit(1);
    }

    return { config, configPath: userConfigPath };
  }

  // Fall back to Quarto's default config
  const defaultConfigPath = resourcePath("extension-build/deno.json");

  if (!existsSync(defaultConfigPath)) {
    error("Error: Could not find default extension-build configuration.");
    error("");
    error("This may indicate that Quarto was not built correctly.");
    error("Expected config at: " + defaultConfigPath);
    Deno.exit(1);
  }

  info(`Using default config: ${defaultConfigPath}`);
  const content = Deno.readTextFileSync(defaultConfigPath);
  const config = JSON.parse(content) as DenoConfig;

  return { config, configPath: defaultConfigPath };
}

async function autoDetectEntryPoint(
  configEntryPoint?: string,
): Promise<string> {
  const srcDir = "src";

  // Check if src/ exists
  if (!existsSync(srcDir)) {
    error("Error: No src/ directory found.");
    error("");
    error("Create a TypeScript file in src/:");
    error("  mkdir -p src");
    error("  touch src/my-engine.ts");
    error("");
    error("Or specify entry point in deno.json:");
    error("  {");
    error('    "quartoExtension": {');
    error('      "entryPoint": "path/to/file.ts"');
    error("    }");
    error("  }");
    Deno.exit(1);
  }

  // If config specifies entry point, use it
  if (configEntryPoint) {
    if (!existsSync(configEntryPoint)) {
      error(
        `Error: Entry point specified in deno.json does not exist: ${configEntryPoint}`,
      );
      Deno.exit(1);
    }
    return configEntryPoint;
  }

  // Find .ts files in src/
  const tsFiles: string[] = [];
  for await (const entry of Deno.readDir(srcDir)) {
    if (entry.isFile && entry.name.endsWith(".ts")) {
      tsFiles.push(entry.name);
    }
  }

  // Resolution logic
  if (tsFiles.length === 0) {
    error("Error: No .ts files found in src/");
    error("");
    error("Create a TypeScript file:");
    error("  touch src/my-engine.ts");
    Deno.exit(1);
  }

  if (tsFiles.length === 1) {
    return join(srcDir, tsFiles[0]);
  }

  // Multiple files - require mod.ts
  if (tsFiles.includes("mod.ts")) {
    return join(srcDir, "mod.ts");
  }

  error(`Error: Multiple .ts files found in src/: ${tsFiles.join(", ")}`);
  error("");
  error("Specify entry point in deno.json:");
  error("  {");
  error('    "quartoExtension": {');
  error('      "entryPoint": "src/my-engine.ts"');
  error("    }");
  error("  }");
  error("");
  error("Or rename one file to mod.ts:");
  error(`  mv src/${tsFiles[0]} src/mod.ts`);
  Deno.exit(1);
}

async function typeCheck(
  entryPoint: string,
  configPath: string,
): Promise<void> {
  info("Type-checking...");

  const denoBinary = Deno.env.get("QUARTO_DENO") ||
    architectureToolsPath("deno");

  const result = await execProcess({
    cmd: denoBinary,
    args: ["check", `--config=${configPath}`, entryPoint],
    cwd: Deno.cwd(),
  });

  if (!result.success) {
    error("Error: Type check failed");
    error("");
    error(
      "See errors above. Fix type errors in your code or adjust compilerOptions in deno.json.",
    );
    error("");
    error("To see just type errors without building:");
    error("  quarto dev-call build-ts-extension --check");
    Deno.exit(1);
  }

  info("✓ Type check passed");
}

function inferOutputPath(entryPoint: string): string {
  // Get the base name without extension
  const fileName = basename(entryPoint, extname(entryPoint));

  // Try to determine extension name from directory structure or use filename
  let extensionName = fileName;

  // Check if _extension.yml exists to get extension name
  const extensionYml = "_extension.yml";
  if (existsSync(extensionYml)) {
    try {
      // Simple extraction - look for extension name in path or use filename
      // For MVP, we'll just use the filename
    } catch {
      // Ignore errors, use filename
    }
  }

  // Output to _extensions/<name>/<name>.js
  const outputDir = join("_extensions", extensionName);
  return join(outputDir, `${fileName}.js`);
}

async function bundle(
  entryPoint: string,
  config: DenoConfig,
): Promise<void> {
  info("Bundling...");

  const esbuildBinary = Deno.env.get("QUARTO_ESBUILD") ||
    architectureToolsPath("esbuild");

  // Determine output path
  const outputPath = config.quartoExtension?.outputFile ||
    inferOutputPath(entryPoint);

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    Deno.mkdirSync(outputDir, { recursive: true });
  }

  // Build esbuild arguments
  const args = [
    entryPoint,
    "--bundle",
    "--format=esm",
    `--outfile=${outputPath}`,
  ];

  // Add target
  const target = config.quartoExtension?.target || "es2022";
  args.push(`--target=${target}`);

  // Add optional flags
  if (config.quartoExtension?.minify) {
    args.push("--minify");
  }

  if (config.quartoExtension?.sourcemap) {
    args.push("--sourcemap");
  }

  const result = await execProcess({
    cmd: esbuildBinary,
    args,
    cwd: Deno.cwd(),
  });

  if (!result.success) {
    error("Error: esbuild bundling failed");
    if (result.stderr) {
      error(result.stderr);
    }
    Deno.exit(1);
  }

  info(`✓ Built ${entryPoint} → ${outputPath}`);
}

export const buildTsExtensionCommand = new Command()
  .name("build-ts-extension")
  .hidden()
  .description(
    "Build TypeScript execution engine extensions.\n\n" +
      "This command type-checks and bundles TypeScript extensions " +
      "into single JavaScript files using Quarto's bundled esbuild.\n\n" +
      "The entry point is determined by:\n" +
      "  1. quartoExtension.entryPoint in deno.json (if specified)\n" +
      "  2. Single .ts file in src/ directory\n" +
      "  3. src/mod.ts (if multiple .ts files exist)",
  )
  .option("--check", "Type-check only (skip bundling)")
  .action(async (options: BuildOptions) => {
    try {
      // 1. Resolve configuration
      const { config, configPath } = await resolveConfig();

      // 2. Resolve entry point
      const entryPoint = await autoDetectEntryPoint(
        config.quartoExtension?.entryPoint,
      );
      info(`Entry point: ${entryPoint}`);

      // 3. Type-check with Deno
      await typeCheck(entryPoint, configPath);

      // 4. Bundle with esbuild (unless --check)
      if (!options.check) {
        await bundle(entryPoint, config);
      } else {
        info("Skipping bundle (--check flag specified)");
      }
    } catch (e) {
      if (e instanceof Error) {
        error(`Error: ${e.message}`);
      } else {
        error(`Error: ${String(e)}`);
      }
      Deno.exit(1);
    }
  });
