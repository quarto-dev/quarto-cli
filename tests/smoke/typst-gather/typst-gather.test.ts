import { testQuartoCmd, Verify } from "../../test.ts";
import { assert } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";

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
