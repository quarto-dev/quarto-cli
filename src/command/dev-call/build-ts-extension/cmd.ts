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
import { expandGlobSync } from "../../../core/deno/expand-glob.ts";
import { readYaml } from "../../../core/yaml.ts";
import { warning } from "../../../deno_ral/log.ts";

interface DenoConfig {
  compilerOptions?: Record<string, unknown>;
  importMap?: string;
  imports?: Record<string, string>;
  quartoExtension?: {
    entryPoint?: string;
    outputFile?: string;
    minify?: boolean;
    sourcemap?: boolean | string;
  };
}

interface BuildOptions {
  check?: boolean;
  initConfig?: boolean;
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
    error("Or specify entry point as argument or in deno.json:");
    error("  quarto dev-call build-ts-extension src/my-engine.ts");
    error("  OR in deno.json:");
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
  error("Specify entry point as argument or in deno.json:");
  error("  quarto dev-call build-ts-extension src/my-engine.ts");
  error("  OR in deno.json:");
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

function inferOutputPath(entryPoint: string): string {
  // Get the base name without extension
  const fileName = basename(entryPoint, extname(entryPoint));

  // Find the extension directory by looking for _extension.yml
  const extensionsDir = "_extensions";
  if (!existsSync(extensionsDir)) {
    error("Error: No _extensions/ directory found.");
    error("");
    error(
      "Extension projects must have an _extensions/ directory with _extension.yml.",
    );
    error("Create the extension structure:");
    error(`  mkdir -p _extensions/${fileName}`);
    error(`  touch _extensions/${fileName}/_extension.yml`);
    Deno.exit(1);
  }

  // Find all _extension.yml files using glob pattern
  const extensionYmlFiles: string[] = [];
  for (const entry of expandGlobSync("_extensions/**/_extension.yml")) {
    extensionYmlFiles.push(dirname(entry.path));
  }

  if (extensionYmlFiles.length === 0) {
    error("Error: No _extension.yml found in _extensions/ subdirectories.");
    error("");
    error(
      "Extension projects must have _extension.yml in a subdirectory of _extensions/.",
    );
    error("Create the extension metadata:");
    error(`  touch _extensions/${fileName}/_extension.yml`);
    Deno.exit(1);
  }

  if (extensionYmlFiles.length > 1) {
    const extensionNames = extensionYmlFiles.map((path) =>
      path.replace("_extensions/", "")
    );
    error(
      `Error: Multiple extension directories found: ${
        extensionNames.join(", ")
      }`,
    );
    error("");
    error("Specify the output path in deno.json:");
    error("  {");
    error('    "quartoExtension": {');
    error(
      `      "outputFile": "${extensionYmlFiles[0]}/${fileName}.js"`,
    );
    error("    }");
    error("  }");
    Deno.exit(1);
  }

  // Use the single extension directory found
  return join(extensionYmlFiles[0], `${fileName}.js`);
}

async function bundle(
  entryPoint: string,
  config: DenoConfig,
  configPath: string,
): Promise<void> {
  info("Bundling...");

  const denoBinary = Deno.env.get("QUARTO_DENO") ||
    architectureToolsPath("deno");

  // Determine output path
  const outputPath = config.quartoExtension?.outputFile ||
    inferOutputPath(entryPoint);

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    Deno.mkdirSync(outputDir, { recursive: true });
  }

  // Build deno bundle arguments
  const args = [
    "bundle",
    `--config=${configPath}`,
    `--output=${outputPath}`,
    entryPoint,
  ];

  // Add optional flags
  if (config.quartoExtension?.minify) {
    args.push("--minify");
  }

  if (config.quartoExtension?.sourcemap) {
    const sourcemapValue = config.quartoExtension.sourcemap;
    if (typeof sourcemapValue === "string") {
      args.push(`--sourcemap=${sourcemapValue}`);
    } else {
      args.push("--sourcemap");
    }
  }

  const result = await execProcess({
    cmd: denoBinary,
    args,
    cwd: Deno.cwd(),
  });

  if (!result.success) {
    error("Error: deno bundle failed");
    if (result.stderr) {
      error(result.stderr);
    }
    Deno.exit(1);
  }

  // Validate that _extension.yml path matches output filename
  validateExtensionYml(outputPath);

  info(`✓ Built ${entryPoint} → ${outputPath}`);
}

function validateExtensionYml(outputPath: string): void {
  // Find _extension.yml in the same directory as output
  const extensionDir = dirname(outputPath);
  const extensionYmlPath = join(extensionDir, "_extension.yml");

  if (!existsSync(extensionYmlPath)) {
    return; // No _extension.yml, can't validate
  }

  try {
    const yml = readYaml(extensionYmlPath);
    const engines = yml?.contributes?.engines;

    if (Array.isArray(engines)) {
      const outputFilename = basename(outputPath);

      for (const engine of engines) {
        const enginePath = typeof engine === "string" ? engine : engine?.path;
        if (enginePath && enginePath !== outputFilename) {
          warning("");
          warning(
            `Warning: _extension.yml specifies engine path "${enginePath}" but built file is "${outputFilename}"`,
          );
          warning(
            `  Update _extension.yml to: path: ${outputFilename}`,
          );
          warning("");
        }
      }
    }
  } catch {
    // Ignore YAML parsing errors
  }
}

async function initializeConfig(): Promise<void> {
  const configPath = "deno.json";

  // Check if deno.json already exists
  if (existsSync(configPath)) {
    error("Error: deno.json already exists");
    error("");
    error("To use Quarto's default config, remove the existing deno.json.");
    error("Or manually add the importMap to your existing config:");
    const importMapPath = resourcePath("extension-build/import-map.json");
    info(`  "importMap": "${importMapPath}"`);
    Deno.exit(1);
  }

  // Get absolute path to Quarto's import map
  const importMapPath = resourcePath("extension-build/import-map.json");

  // Create minimal config
  const config = {
    compilerOptions: {
      strict: true,
      lib: ["deno.ns", "DOM", "ES2021"],
    },
    importMap: importMapPath,
  };

  // Write deno.json
  Deno.writeTextFileSync(
    configPath,
    JSON.stringify(config, null, 2) + "\n",
  );

  // Inform user
  info("✓ Created deno.json");
  info(`  Import map: ${importMapPath}`);
  info("");
  info("Customize as needed:");
  info('  - Add "quartoExtension" section for build options:');
  info('      "entryPoint": "src/my-engine.ts"');
  info('      "outputFile": "_extensions/my-engine/my-engine.js"');
  info('      "minify": true');
  info('      "sourcemap": true');
  info('  - Modify "compilerOptions" for type-checking behavior');
}

export const buildTsExtensionCommand = new Command()
  .name("build-ts-extension")
  .hidden()
  .arguments("[entry-point:string]")
  .description(
    "Build TypeScript execution engine extensions.\n\n" +
      "This command type-checks and bundles TypeScript extensions " +
      "into single JavaScript files using Quarto's bundled deno bundle.\n\n" +
      "The entry point is determined by:\n" +
      "  1. [entry-point] command-line argument (if specified)\n" +
      "  2. quartoExtension.entryPoint in deno.json (if specified)\n" +
      "  3. Single .ts file in src/ directory\n" +
      "  4. src/mod.ts (if multiple .ts files exist)",
  )
  .option("--check", "Type-check only (skip bundling)")
  .option(
    "--init-config",
    "Generate deno.json with absolute importMap path",
  )
  .action(async (options: BuildOptions, entryPointArg?: string) => {
    try {
      // Handle --init-config flag first (don't build)
      if (options.initConfig) {
        await initializeConfig();
        return;
      }

      // 1. Resolve configuration
      const { config, configPath } = await resolveConfig();

      // 2. Resolve entry point (CLI arg takes precedence)
      const entryPoint = entryPointArg ||
        await autoDetectEntryPoint(
          config.quartoExtension?.entryPoint,
        );
      info(`Entry point: ${entryPoint}`);

      // 3. Type-check or bundle
      if (options.check) {
        // Just type-check
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
          Deno.exit(1);
        }
        info("✓ Type check passed");
      } else {
        // Type-check and bundle (deno bundle does both)
        await bundle(entryPoint, config, configPath);
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
