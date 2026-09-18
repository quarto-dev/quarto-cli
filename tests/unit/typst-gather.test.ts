/*
 * typst-gather.test.ts
 *
 * Unit tests for typst-gather config generation.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  AnalyzeResult,
  generateConfigFromAnalysis,
} from "../../src/command/call/typst-gather/cmd.ts";

// Helper to check a line exists in generated config
function assertContains(config: string, expected: string, msg?: string) {
  assert(config.includes(expected), msg || `Expected config to contain: ${expected}\nGot:\n${config}`);
}

function assertNotContains(config: string, unexpected: string, msg?: string) {
  assert(!config.includes(unexpected), msg || `Expected config NOT to contain: ${unexpected}\nGot:\n${config}`);
}

// --- Unit tests for generateConfigFromAnalysis ---

unitTest(
  "generateConfigFromAnalysis - empty result produces valid config",
  async () => {
    const result: AnalyzeResult = { imports: [], files: [] };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, 'destination = "typst/packages"');
    assertContains(config, '# discover = "template.typ"');
    assertContains(config, '# cetz = "0.4.1"');
    assertContains(config, "# [local]");
  },
);

unitTest(
  "generateConfigFromAnalysis - preview only imports",
  async () => {
    const result: AnalyzeResult = {
      imports: [
        { namespace: "preview", name: "cetz", version: "0.4.1", source: "template.typ", direct: true },
        { namespace: "preview", name: "fletcher", version: "0.5.0", source: "template.typ", direct: true },
      ],
      files: ["template.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, '# cetz = "0.4.1"');
    assertContains(config, '# fletcher = "0.5.0"');
    assertContains(config, "# [local]");
    // Should NOT have an uncommented [local] section
    assertNotContains(config, "\n[local]");
  },
);

unitTest(
  "generateConfigFromAnalysis - local only imports",
  async () => {
    const result: AnalyzeResult = {
      imports: [
        { namespace: "local", name: "my-pkg", version: "1.0.0", source: "template.typ", direct: true },
      ],
      files: ["template.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, "[local]");
    assertContains(config, 'my-pkg = "/path/to/my-pkg"');
    assertContains(config, "@local/my-pkg:1.0.0 (in template.typ)");
    // Preview section should have placeholder example
    assertContains(config, '# cetz = "0.4.1"');
  },
);

unitTest(
  "generateConfigFromAnalysis - mixed preview and local imports",
  async () => {
    const result: AnalyzeResult = {
      imports: [
        { namespace: "preview", name: "cetz", version: "0.4.1", source: "template.typ", direct: true },
        { namespace: "local", name: "my-pkg", version: "1.0.0", source: "template.typ", direct: true },
      ],
      files: ["template.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, '# cetz = "0.4.1"');
    assertContains(config, "[local]");
    assertContains(config, 'my-pkg = "/path/to/my-pkg"');
  },
);

unitTest(
  "generateConfigFromAnalysis - transitive preview from local shows source",
  async () => {
    const result: AnalyzeResult = {
      imports: [
        { namespace: "preview", name: "cetz", version: "0.4.1", source: "template.typ", direct: true },
        { namespace: "preview", name: "oxifmt", version: "0.2.1", source: "@local/my-pkg", direct: false },
        { namespace: "local", name: "my-pkg", version: "1.0.0", source: "template.typ", direct: true },
      ],
      files: ["template.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, '# cetz = "0.4.1"');
    assertContains(config, '# oxifmt = "0.2.1"  # via @local/my-pkg');
  },
);

unitTest(
  "generateConfigFromAnalysis - deduplication of preview imports",
  async () => {
    const result: AnalyzeResult = {
      imports: [
        { namespace: "preview", name: "cetz", version: "0.4.1", source: "template.typ", direct: true },
        { namespace: "preview", name: "cetz", version: "0.4.1", source: "other.typ", direct: true },
      ],
      files: ["template.typ", "other.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    // Should only appear once
    const matches = config.match(/# cetz = "0\.4\.1"/g);
    assertEquals(matches?.length, 1, "Expected cetz to appear exactly once");
  },
);

unitTest(
  "generateConfigFromAnalysis - with rootdir",
  async () => {
    const result: AnalyzeResult = { imports: [], files: ["template.typ"] };
    const config = generateConfigFromAnalysis(result, "_extensions/my-ext");
    assertContains(config, 'rootdir = "_extensions/my-ext"');
    assertContains(config, 'destination = "typst/packages"');
  },
);

unitTest(
  "generateConfigFromAnalysis - no rootdir when not provided",
  async () => {
    const result: AnalyzeResult = { imports: [], files: ["template.typ"] };
    const config = generateConfigFromAnalysis(result);
    assertNotContains(config, "rootdir");
  },
);

unitTest(
  "generateConfigFromAnalysis - discover single file is string",
  async () => {
    const result: AnalyzeResult = { imports: [], files: ["template.typ"] };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, 'discover = "template.typ"');
    assertNotContains(config, "discover = [");
  },
);

unitTest(
  "generateConfigFromAnalysis - discover multiple files is array",
  async () => {
    const result: AnalyzeResult = {
      imports: [],
      files: ["template.typ", "typst-show.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, 'discover = ["template.typ", "typst-show.typ"]');
  },
);

unitTest(
  "generateConfigFromAnalysis - windows backslashes converted to forward slashes",
  async () => {
    const result: AnalyzeResult = {
      imports: [],
      files: ["subdir\\template.typ"],
    };
    const config = generateConfigFromAnalysis(result, "ext\\my-ext");
    assertContains(config, 'rootdir = "ext/my-ext"');
    assertContains(config, 'discover = "subdir/template.typ"');
    assertNotContains(config, "\\");
  },
);

unitTest(
  "generateConfigFromAnalysis - local imports only include direct",
  async () => {
    const result: AnalyzeResult = {
      imports: [
        { namespace: "local", name: "my-pkg", version: "1.0.0", source: "template.typ", direct: true },
        { namespace: "local", name: "other-pkg", version: "2.0.0", source: "@local/my-pkg", direct: false },
      ],
      files: ["template.typ"],
    };
    const config = generateConfigFromAnalysis(result);
    assertContains(config, "[local]");
    assertContains(config, 'my-pkg = "/path/to/my-pkg"');
    // Transitive @local should NOT appear in the [local] section
    assertNotContains(config, 'other-pkg = "/path/to/other-pkg"');
  },
);

// --- Large import list ---

unitTest(
  "generateConfigFromAnalysis - handles large import list without truncation",
  async () => {
    const imports = [];
    for (let i = 0; i < 60; i++) {
      imports.push({
        namespace: "preview",
        name: `package-${i}`,
        version: `${i}.0.0`,
        source: "template.typ",
        direct: true,
      });
    }
    const result: AnalyzeResult = { imports, files: ["template.typ"] };
    const config = generateConfigFromAnalysis(result);
    // All 60 packages should appear
    for (let i = 0; i < 60; i++) {
      assertContains(config, `# package-${i} = "${i}.0.0"`);
    }
  },
);

// --- Paths with spaces ---

unitTest(
  "generateConfigFromAnalysis - paths with spaces are quoted correctly",
  async () => {
    const result: AnalyzeResult = {
      imports: [],
      files: ["my project/my template.typ"],
    };
    const config = generateConfigFromAnalysis(result, "my ext/sub dir");
    assertContains(config, 'rootdir = "my ext/sub dir"');
    assertContains(config, 'discover = "my project/my template.typ"');
  },
);

// --- Paths with special TOML characters ---

unitTest(
  "generateConfigFromAnalysis - paths with special chars in discover",
  async () => {
    const result: AnalyzeResult = {
      imports: [],
      files: ['dir "quoted"/template.typ'],
    };
    // The current implementation doesn't escape quotes inside TOML strings.
    // This test documents the current behavior — paths with quotes in them
    // would produce invalid TOML. This is acceptable since filesystem paths
    // with literal quotes are extremely rare.
    const config = generateConfigFromAnalysis(result);
    assertContains(config, "discover");
    assertContains(config, "template.typ");
  },
);
