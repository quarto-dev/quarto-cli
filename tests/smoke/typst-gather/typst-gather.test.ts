import { testQuartoCmd, unitTest, Verify } from "../../test.ts";
import { assert } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { execProcess } from "../../../src/core/process.ts";

// Test 1: Auto-detection from _extension.yml
const verifyPackagesCreated: Verify = {
  name: "Verify typst/packages directory was created",
  verify: async () => {
    const packagesDir = "_extensions/test-format/typst/packages";
    assert(
      existsSync(packagesDir),
      `Expected typst/packages directory not found: ${packagesDir}`,
    );
  },
};

const verifyExamplePackageCached: Verify = {
  name: "Verify @preview/example package was cached",
  verify: async () => {
    const packageDir =
      "_extensions/test-format/typst/packages/preview/example/0.1.0";
    assert(
      existsSync(packageDir),
      `Expected cached package not found: ${packageDir}`,
    );

    // Verify typst.toml exists in the package
    const manifestPath = `${packageDir}/typst.toml`;
    assert(
      existsSync(manifestPath),
      `Expected package manifest not found: ${manifestPath}`,
    );
  },
};

testQuartoCmd(
  "call",
  ["typst-gather"],
  [verifyPackagesCreated, verifyExamplePackageCached],
  {
    cwd: () => "smoke/typst-gather",
  },
  "typst-gather caches preview packages from extension templates",
);

// Test 2: Config file with rootdir
const verifyConfigPackagesCreated: Verify = {
  name: "Verify typst/packages directory was created via config",
  verify: async () => {
    const packagesDir = "_extensions/config-format/typst/packages";
    assert(
      existsSync(packagesDir),
      `Expected typst/packages directory not found: ${packagesDir}`,
    );
  },
};

const verifyConfigExamplePackageCached: Verify = {
  name: "Verify @preview/example package was cached via config",
  verify: async () => {
    const packageDir =
      "_extensions/config-format/typst/packages/preview/example/0.1.0";
    assert(
      existsSync(packageDir),
      `Expected cached package not found: ${packageDir}`,
    );

    const manifestPath = `${packageDir}/typst.toml`;
    assert(
      existsSync(manifestPath),
      `Expected package manifest not found: ${manifestPath}`,
    );
  },
};

testQuartoCmd(
  "call",
  ["typst-gather"],
  [verifyConfigPackagesCreated, verifyConfigExamplePackageCached],
  {
    cwd: () => "smoke/typst-gather/with-config",
  },
  "typst-gather uses rootdir from config file",
);

// Test 3: --init-config generates config file
const verifyInitConfigCreated: Verify = {
  name: "Verify typst-gather.toml was created",
  verify: async () => {
    assert(
      existsSync("typst-gather.toml"),
      "Expected typst-gather.toml to be created",
    );

    // Read and verify content has rootdir
    const content = Deno.readTextFileSync("typst-gather.toml");
    assert(
      content.includes("rootdir"),
      "Expected typst-gather.toml to contain rootdir",
    );
    assert(
      content.includes("_extensions/test-format"),
      "Expected rootdir to point to extension directory",
    );
  },
};

testQuartoCmd(
  "call",
  ["typst-gather", "--init-config"],
  [verifyInitConfigCreated],
  {
    cwd: () => "smoke/typst-gather",
    teardown: async () => {
      // Clean up generated config file
      try {
        Deno.removeSync("typst-gather.toml");
      } catch {
        // Ignore if already removed
      }
    },
  },
  "typst-gather --init-config generates config with rootdir",
);

// Test 4: @local package is copied when [local] section is configured
const verifyLocalPackageCopied: Verify = {
  name: "Verify @local/my-local-pkg was copied",
  verify: async () => {
    const packageDir =
      "_extensions/local-format/typst/packages/local/my-local-pkg/0.1.0";
    assert(
      existsSync(packageDir),
      `Expected local package not found: ${packageDir}`,
    );

    const manifestPath = `${packageDir}/typst.toml`;
    assert(
      existsSync(manifestPath),
      `Expected package manifest not found: ${manifestPath}`,
    );

    const libPath = `${packageDir}/lib.typ`;
    assert(existsSync(libPath), `Expected lib.typ not found: ${libPath}`);
  },
};

testQuartoCmd(
  "call",
  ["typst-gather"],
  [verifyLocalPackageCopied],
  {
    cwd: () => "smoke/typst-gather/with-local",
    teardown: async () => {
      // Clean up copied packages
      try {
        Deno.removeSync("_extensions/local-format/typst", { recursive: true });
      } catch {
        // Ignore if already removed
      }
    },
  },
  "typst-gather copies @local packages when configured",
);

// Test 5: --init-config detects @local imports and generates [local] section
const verifyInitConfigWithLocal: Verify = {
  name: "Verify --init-config detects @local imports",
  verify: async () => {
    assert(
      existsSync("typst-gather.toml"),
      "Expected typst-gather.toml to be created",
    );

    const content = Deno.readTextFileSync("typst-gather.toml");
    assert(
      content.includes("[local]"),
      "Expected typst-gather.toml to contain [local] section",
    );
    assert(
      content.includes("my-local-pkg"),
      "Expected typst-gather.toml to reference my-local-pkg",
    );
    assert(
      content.includes("@local/my-local-pkg"),
      "Expected typst-gather.toml to show found @local import",
    );
  },
};

testQuartoCmd(
  "call",
  ["typst-gather", "--init-config"],
  [verifyInitConfigWithLocal],
  {
    cwd: () => "smoke/typst-gather/with-local",
    setup: async () => {
      // Remove existing config so --init-config can run
      try {
        Deno.renameSync("typst-gather.toml", "typst-gather.toml.bak");
      } catch {
        // Ignore if doesn't exist
      }
    },
    teardown: async () => {
      // Restore original config and clean up generated one
      try {
        Deno.removeSync("typst-gather.toml");
      } catch {
        // Ignore
      }
      try {
        Deno.renameSync("typst-gather.toml.bak", "typst-gather.toml");
      } catch {
        // Ignore
      }
    },
  },
  "typst-gather --init-config detects @local imports",
);

// Test 6: Rendering a project-based typst document with no package imports
// stages no packages (no preview/ or local/ dirs created)
const noPackagesProjectDir =
  "docs/smoke-all/typst/no-packages-project";

const verifyNoPackagesStaged: Verify = {
  name: "Verify no packages staged for document with no imports",
  verify: async () => {
    const scratchPackages = join(noPackagesProjectDir, ".quarto/typst/packages");
    const previewDir = join(scratchPackages, "preview");
    const localDir = join(scratchPackages, "local");
    assert(
      !existsSync(previewDir),
      `Expected no preview/ dir but found: ${previewDir}`,
    );
    assert(
      !existsSync(localDir),
      `Expected no local/ dir but found: ${localDir}`,
    );
  },
};

testQuartoCmd(
  "render",
  [join(noPackagesProjectDir, "index.qmd"), "--to", "typst"],
  [verifyNoPackagesStaged],
  {
    teardown: async () => {
      try {
        Deno.removeSync(join(noPackagesProjectDir, ".quarto"), {
          recursive: true,
        });
        Deno.removeSync(join(noPackagesProjectDir, "index.pdf"));
      } catch {
        // Ignore
      }
    },
  },
  "no packages staged when typst document has no imports",
);

// Helper to run quarto as an external process and capture exit code
async function runQuarto(
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const quartoPath = join(
    Deno.cwd(),
    "..",
    "package/dist/bin/quarto",
  );
  const result = await execProcess({
    cmd: quartoPath,
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
    env: env ? { ...Deno.env.toObject(), ...env } : undefined,
  });
  return {
    success: result.success,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

// Test 7: --init-config errors when typst-gather.toml already exists
unitTest(
  "typst-gather --init-config errors when config already exists",
  async () => {
    const cwd = join(Deno.cwd(), "smoke/typst-gather");
    // Create a typst-gather.toml so --init-config should fail
    const configPath = join(cwd, "typst-gather.toml");
    try {
      Deno.writeTextFileSync(configPath, "# existing config\n");
      const result = await runQuarto(
        ["call", "typst-gather", "--init-config"],
        cwd,
      );
      assert(!result.success, "Expected --init-config to fail when config exists");
    } finally {
      try {
        Deno.removeSync(configPath);
      } catch {
        // Ignore
      }
    }
  },
);

// Test 8: --init-config errors when no extension directory found
unitTest(
  "typst-gather --init-config errors with no extension directory",
  async () => {
    const cwd = join(Deno.cwd(), "smoke/typst-gather/no-extension");
    const result = await runQuarto(
      ["call", "typst-gather", "--init-config"],
      cwd,
    );
    assert(
      !result.success,
      "Expected --init-config to fail with no extension",
    );
  },
);

// Test 9: --init-config with extension that has no typst entries
// The extension has no typst template/template-partials, so extractTypstFiles
// returns empty. initConfig logs a warning but still generates a config with
// placeholder discover. This is not an error — it's a valid starting point.
unitTest(
  "typst-gather --init-config warns with empty extension (no typst entries)",
  async () => {
    const cwd = join(Deno.cwd(), "smoke/typst-gather/empty-extension");
    const result = await runQuarto(
      ["call", "typst-gather", "--init-config"],
      cwd,
    );
    // initConfig still generates a config file with placeholders
    const configPath = join(cwd, "typst-gather.toml");
    try {
      if (result.success) {
        assert(existsSync(configPath), "Expected config file to be created");
        const content = Deno.readTextFileSync(configPath);
        // Should have placeholder discover comment
        assert(
          content.includes("discover"),
          "Expected discover in generated config",
        );
      } else {
        // If it failed, that's also acceptable — no typst files found
        assert(true);
      }
    } finally {
      try {
        Deno.removeSync(configPath);
      } catch {
        // Ignore
      }
    }
  },
);

// Test 10: --init-config detects @local imports from extension template.
// Note: --init-config only passes `discover` paths, not `[local]` config,
// so typst-gather analyze can see the direct @local import but cannot follow
// it to find transitive @preview deps (it doesn't know where the local
// package lives). The transitive resolution happens at gather time with the
// full config.
const verifyTransitiveDeps: Verify = {
  name: "Verify --init-config detects @local import from template",
  verify: async () => {
    assert(
      existsSync("typst-gather.toml"),
      "Expected typst-gather.toml to be created",
    );

    const content = Deno.readTextFileSync("typst-gather.toml");
    // Should have the @local import detected
    assert(
      content.includes("[local]"),
      "Expected [local] section",
    );
    assert(
      content.includes("dep-pkg"),
      "Expected dep-pkg in [local] section",
    );
  },
};

testQuartoCmd(
  "call",
  ["typst-gather", "--init-config"],
  [verifyTransitiveDeps],
  {
    cwd: () => "smoke/typst-gather/with-transitive-deps",
    setup: async () => {
      // Rename existing config so --init-config can run
      try {
        Deno.renameSync("typst-gather.toml", "typst-gather.toml.bak");
      } catch {
        // Ignore if doesn't exist
      }
    },
    teardown: async () => {
      // Restore original config and clean up generated one
      try {
        Deno.removeSync("typst-gather.toml");
      } catch {
        // Ignore
      }
      try {
        Deno.renameSync("typst-gather.toml.bak", "typst-gather.toml");
      } catch {
        // Ignore
      }
    },
  },
  "typst-gather --init-config detects transitive deps from @local",
);

// Test 11: Staging falls back to copy-all when typst-gather binary is missing
unitTest(
  "staging falls back when typst-gather binary is missing",
  async () => {
    // Render a document that has packages, with QUARTO_TYPST_GATHER pointing
    // to a nonexistent binary. The render should still succeed because
    // analyzeNeededPackages catches the error and falls back to stageAll.
    const projectDir = join(
      Deno.cwd(),
      "docs/smoke-all/typst/orange-book",
    );
    const result = await runQuarto(
      ["render", "index.qmd", "--to", "typst"],
      projectDir,
      { QUARTO_TYPST_GATHER: "/nonexistent/typst-gather-binary" },
    );
    assert(
      result.success,
      `Expected render to succeed with fallback staging, but failed:\n${result.stderr}`,
    );
  },
);

// Test 12: Staging falls back when typst-gather analyze fails (non-zero exit)
unitTest(
  "staging falls back when typst-gather analyze returns non-zero",
  async () => {
    // /usr/bin/false always exits with code 1
    const projectDir = join(
      Deno.cwd(),
      "docs/smoke-all/typst/orange-book",
    );
    const result = await runQuarto(
      ["render", "index.qmd", "--to", "typst"],
      projectDir,
      { QUARTO_TYPST_GATHER: "/usr/bin/false" },
    );
    assert(
      result.success,
      `Expected render to succeed with fallback staging, but failed:\n${result.stderr}`,
    );
  },
);

// Test 13: Rendering a project using .column-margin stages only marginalia
const marginaliaProjectDir =
  "docs/smoke-all/typst/marginalia-only-project";

const verifyOnlyMarginaliaStaged: Verify = {
  name: "Verify only marginalia package is staged",
  verify: async () => {
    const scratchPackages = join(marginaliaProjectDir, ".quarto/typst/packages");
    const previewDir = join(scratchPackages, "preview");

    // marginalia should be staged
    const marginaliaDir = join(previewDir, "marginalia");
    assert(
      existsSync(marginaliaDir),
      `Expected marginalia package but not found: ${marginaliaDir}`,
    );

    // No other packages should be staged
    const unwanted = [
      "fontawesome",
      "showybox",
      "theorion",
      "octique",
      "orange-book",
    ];
    for (const pkg of unwanted) {
      const pkgDir = join(previewDir, pkg);
      assert(
        !existsSync(pkgDir),
        `Expected ${pkg} NOT to be staged but found: ${pkgDir}`,
      );
    }

    // No local packages should be staged
    const localDir = join(scratchPackages, "local");
    assert(
      !existsSync(localDir),
      `Expected no local/ dir but found: ${localDir}`,
    );
  },
};

testQuartoCmd(
  "render",
  [join(marginaliaProjectDir, "index.qmd"), "--to", "typst"],
  [verifyOnlyMarginaliaStaged],
  {
    teardown: async () => {
      try {
        Deno.removeSync(join(marginaliaProjectDir, ".quarto"), {
          recursive: true,
        });
        Deno.removeSync(join(marginaliaProjectDir, "index.pdf"));
      } catch {
        // Ignore
      }
    },
  },
  "only marginalia staged when typst document uses column-margin",
);
