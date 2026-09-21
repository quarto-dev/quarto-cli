/*
 * typst-staging.test.ts
 *
 * Unit tests for typst package staging functions.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import { ensureDirSync } from "../../src/deno_ral/fs.ts";
import {
  buildAnalyzeToml,
  type NeededPackage,
  stageAllPackages,
  stageSelectedPackages,
} from "../../src/command/render/output-typst.ts";

// Helper: create a fake package directory with a typst.toml and lib.typ
function createFakePackage(
  baseDir: string,
  namespace: string,
  name: string,
  version: string,
  content = "default",
): string {
  const pkgDir = join(baseDir, namespace, name, version);
  ensureDirSync(pkgDir);
  Deno.writeTextFileSync(
    join(pkgDir, "typst.toml"),
    `[package]\nname = "${name}"\nversion = "${version}"\n`,
  );
  Deno.writeTextFileSync(join(pkgDir, "lib.typ"), `// ${content}\n`);
  return pkgDir;
}

// Helper: read lib.typ content to verify which source won
function readLibContent(cacheDir: string, ns: string, name: string, ver: string): string {
  return Deno.readTextFileSync(join(cacheDir, ns, name, ver, "lib.typ"));
}

// --- buildAnalyzeToml tests ---

unitTest("buildAnalyzeToml - correct discover and package-cache fields", async () => {
  const toml = buildAnalyzeToml("/path/to/doc.typ", ["/src1", "/src2"]);
  assert(toml.includes('discover = ["/path/to/doc.typ"]'));
  assert(toml.includes('package-cache = ["/src1", "/src2"]'));
});

unitTest("buildAnalyzeToml - windows backslashes converted to forward slashes", async () => {
  const toml = buildAnalyzeToml(
    "C:\\Users\\test\\doc.typ",
    ["C:\\pkg\\source1", "D:\\pkg\\source2"],
  );
  assert(toml.includes('discover = ["C:/Users/test/doc.typ"]'));
  assert(toml.includes('package-cache = ["C:/pkg/source1", "D:/pkg/source2"]'));
  assert(!toml.includes("\\"), "TOML should not contain backslashes");
});

unitTest("buildAnalyzeToml - single source", async () => {
  const toml = buildAnalyzeToml("/doc.typ", ["/only-source"]);
  assert(toml.includes('package-cache = ["/only-source"]'));
});

unitTest("buildAnalyzeToml - paths with spaces are quoted correctly", async () => {
  const toml = buildAnalyzeToml(
    "/my project/doc file.typ",
    ["/source one/packages", "/source two/pkgs"],
  );
  assert(toml.includes('discover = ["/my project/doc file.typ"]'));
  assert(
    toml.includes('package-cache = ["/source one/packages", "/source two/pkgs"]'),
  );
});

// --- stageSelectedPackages tests ---

unitTest("stageSelectedPackages - single package", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    createFakePackage(source, "preview", "cetz", "0.4.1");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
    ];
    stageSelectedPackages([source], cache, needed);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "preview/cetz/0.4.1/lib.typ")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - multiple packages from same source", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    createFakePackage(source, "preview", "cetz", "0.4.1");
    createFakePackage(source, "preview", "fontawesome", "0.5.0");
    createFakePackage(source, "preview", "fletcher", "0.3.0");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
      { namespace: "preview", name: "fontawesome", version: "0.5.0" },
      { namespace: "preview", name: "fletcher", version: "0.3.0" },
    ];
    stageSelectedPackages([source], cache, needed);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "preview/fontawesome/0.5.0/typst.toml")));
    assert(existsSync(join(cache, "preview/fletcher/0.3.0/typst.toml")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - from multiple sources", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source1 = join(tmp, "source1");
    const source2 = join(tmp, "source2");
    const cache = join(tmp, "cache");
    ensureDirSync(source1);
    ensureDirSync(source2);
    ensureDirSync(cache);

    createFakePackage(source1, "preview", "cetz", "0.4.1", "from-source1");
    createFakePackage(source2, "preview", "fontawesome", "0.5.0", "from-source2");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
      { namespace: "preview", name: "fontawesome", version: "0.5.0" },
    ];
    stageSelectedPackages([source1, source2], cache, needed);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "preview/fontawesome/0.5.0/typst.toml")));
    assert(readLibContent(cache, "preview", "cetz", "0.4.1").includes("from-source1"));
    assert(readLibContent(cache, "preview", "fontawesome", "0.5.0").includes("from-source2"));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - last source wins", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const builtin = join(tmp, "builtin");
    const extension = join(tmp, "extension");
    const cache = join(tmp, "cache");
    ensureDirSync(builtin);
    ensureDirSync(extension);
    ensureDirSync(cache);

    createFakePackage(builtin, "preview", "cetz", "0.4.1", "builtin-version");
    createFakePackage(extension, "preview", "cetz", "0.4.1", "extension-version");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
    ];
    // builtin first, extension second — extension should win
    stageSelectedPackages([builtin, extension], cache, needed);

    const content = readLibContent(cache, "preview", "cetz", "0.4.1");
    assert(
      content.includes("extension-version"),
      `Expected extension to win, got: ${content}`,
    );
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - overwrites existing cache", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    // Pre-populate cache with old content
    createFakePackage(cache, "preview", "cetz", "0.4.1", "old-cached");
    // Source has new content
    createFakePackage(source, "preview", "cetz", "0.4.1", "new-source");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
    ];
    stageSelectedPackages([source], cache, needed);

    const content = readLibContent(cache, "preview", "cetz", "0.4.1");
    assert(
      content.includes("new-source"),
      `Expected overwrite, got: ${content}`,
    );
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - package not in sources is skipped", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    // Source has cetz but NOT fontawesome
    createFakePackage(source, "preview", "cetz", "0.4.1");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
      { namespace: "preview", name: "fontawesome", version: "0.5.0" },
    ];
    // Should not throw — missing package is silently skipped
    stageSelectedPackages([source], cache, needed);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(!existsSync(join(cache, "preview/fontawesome")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - mixed namespaces", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    createFakePackage(source, "preview", "cetz", "0.4.1");
    createFakePackage(source, "local", "my-theme", "1.0.0");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
      { namespace: "local", name: "my-theme", version: "1.0.0" },
    ];
    stageSelectedPackages([source], cache, needed);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "local/my-theme/1.0.0/typst.toml")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageSelectedPackages - preserves package contents", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    // Create package with subdirectory
    const pkgDir = join(source, "preview/cetz/0.4.1");
    ensureDirSync(pkgDir);
    Deno.writeTextFileSync(join(pkgDir, "typst.toml"), '[package]\nname = "cetz"\n');
    Deno.writeTextFileSync(join(pkgDir, "lib.typ"), "// main\n");
    ensureDirSync(join(pkgDir, "src"));
    Deno.writeTextFileSync(join(pkgDir, "src/draw.typ"), "// draw\n");
    Deno.writeTextFileSync(join(pkgDir, "src/canvas.typ"), "// canvas\n");

    const needed: NeededPackage[] = [
      { namespace: "preview", name: "cetz", version: "0.4.1" },
    ];
    stageSelectedPackages([source], cache, needed);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "preview/cetz/0.4.1/lib.typ")));
    assert(existsSync(join(cache, "preview/cetz/0.4.1/src/draw.typ")));
    assert(existsSync(join(cache, "preview/cetz/0.4.1/src/canvas.typ")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

// --- stageAllPackages (fallback) tests ---

unitTest("stageSelectedPackages - null needed triggers stageAll fallback", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    createFakePackage(source, "preview", "cetz", "0.4.1");
    createFakePackage(source, "preview", "fontawesome", "0.5.0");

    // null = fallback, should copy everything
    stageSelectedPackages([source], cache, null);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "preview/fontawesome/0.5.0/typst.toml")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageAllPackages - merges packages across sources", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source1 = join(tmp, "source1");
    const source2 = join(tmp, "source2");
    const cache = join(tmp, "cache");
    ensureDirSync(source1);
    ensureDirSync(source2);
    ensureDirSync(cache);

    // source1 has cetz and fontawesome
    createFakePackage(source1, "preview", "cetz", "0.4.1", "builtin-cetz");
    createFakePackage(source1, "preview", "fontawesome", "0.5.0", "builtin-fa");
    // source2 has only a custom cetz (extension override)
    createFakePackage(source2, "preview", "cetz", "0.4.1", "ext-cetz");

    stageAllPackages([source1, source2], cache);

    // fontawesome from source1 should be preserved
    assert(existsSync(join(cache, "preview/fontawesome/0.5.0/typst.toml")));
    assert(readLibContent(cache, "preview", "fontawesome", "0.5.0").includes("builtin-fa"));

    // cetz should be overwritten by source2 (last write wins)
    const cetzContent = readLibContent(cache, "preview", "cetz", "0.4.1");
    assert(
      cetzContent.includes("ext-cetz"),
      `Expected extension override, got: ${cetzContent}`,
    );
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

unitTest("stageAllPackages - handles mixed namespaces", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "quarto-stage-test-" });
  try {
    const source = join(tmp, "source");
    const cache = join(tmp, "cache");
    ensureDirSync(source);
    ensureDirSync(cache);

    createFakePackage(source, "preview", "cetz", "0.4.1");
    createFakePackage(source, "local", "my-theme", "1.0.0");

    stageAllPackages([source], cache);

    assert(existsSync(join(cache, "preview/cetz/0.4.1/typst.toml")));
    assert(existsSync(join(cache, "local/my-theme/1.0.0/typst.toml")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});
