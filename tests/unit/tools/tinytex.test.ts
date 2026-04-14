/*
 * tinytex.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects } from "testing/asserts";
import {
  tinyTexInstallable,
  tinyTexPkgName,
} from "../../../src/tools/impl/tinytex.ts";
import { getLatestRelease } from "../../../src/tools/github.ts";
import { GitHubRelease, InstallContext, PackageInfo } from "../../../src/tools/types.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { isLinux } from "../../../src/deno_ral/platform.ts";

// ---- Pure logic tests for tinyTexPkgName ----

unitTest("tinyTexPkgName - Linux aarch64 with version", async () => {
  assertEquals(
    tinyTexPkgName("TinyTeX", "v2026.04", { os: "linux", arch: "aarch64" }),
    [
      "TinyTeX-linux-arm64-v2026.04.tar.xz",
      "TinyTeX-arm64-v2026.04.tar.gz",
    ],
  );
});

unitTest("tinyTexPkgName - Linux x86_64 with version", async () => {
  assertEquals(
    tinyTexPkgName("TinyTeX", "v2026.04", { os: "linux", arch: "x86_64" }),
    [
      "TinyTeX-linux-x86_64-v2026.04.tar.xz",
      "TinyTeX-v2026.04.tar.gz",
    ],
  );
});

unitTest("tinyTexPkgName - macOS with version", async () => {
  assertEquals(
    tinyTexPkgName("TinyTeX", "v2026.04", { os: "darwin", arch: "aarch64" }),
    [
      "TinyTeX-darwin-v2026.04.tar.xz",
      "TinyTeX-v2026.04.tgz",
    ],
  );
});

unitTest("tinyTexPkgName - Windows with version", async () => {
  assertEquals(
    tinyTexPkgName("TinyTeX", "v2026.04", { os: "windows", arch: "x86_64" }),
    [
      "TinyTeX-windows-v2026.04.exe",
      "TinyTeX-v2026.04.zip",
    ],
  );
});

unitTest("tinyTexPkgName - versionless Linux aarch64", async () => {
  assertEquals(
    tinyTexPkgName("TinyTeX", undefined, { os: "linux", arch: "aarch64" }),
    ["TinyTeX.tar.gz"],
  );
});

unitTest("tinyTexPkgName - TinyTeX-1 ARM64 Linux", async () => {
  assertEquals(
    tinyTexPkgName("TinyTeX-1", "v2026.04", {
      os: "linux",
      arch: "aarch64",
    }),
    [
      "TinyTeX-1-linux-arm64-v2026.04.tar.xz",
      "TinyTeX-1-arm64-v2026.04.tar.gz",
    ],
  );
});

unitTest("tinyTexPkgName - default base", async () => {
  assertEquals(
    tinyTexPkgName(undefined, "v2026.04", { os: "linux", arch: "x86_64" }),
    [
      "TinyTeX-linux-x86_64-v2026.04.tar.xz",
      "TinyTeX-v2026.04.tar.gz",
    ],
  );
});

// ---- Asset-existence tests (network, verify against latest release) ----

const kTinyTexRepo = "rstudio/tinytex-releases";

let cachedRelease: GitHubRelease | undefined;
async function getRelease() {
  if (!cachedRelease) {
    cachedRelease = await getLatestRelease(kTinyTexRepo);
  }
  return cachedRelease;
}

function assertAssetExists(
  candidates: string[],
  assetNames: string[],
  label: string,
) {
  const found = candidates.some((c) => assetNames.includes(c));
  assert(
    found,
    `No matching asset for ${label}. Candidates: ${candidates.join(", ")}. ` +
      `Available TinyTeX assets: ${assetNames.filter((a) => a.startsWith("TinyTeX")).join(", ")}`,
  );
}

unitTest(
  "tinyTexPkgName - Linux x86_64 candidates match latest release",
  async () => {
    const release = await getRelease();
    const assetNames = release.assets.map((a) => a.name);
    const candidates = tinyTexPkgName("TinyTeX", release.tag_name, {
      os: "linux",
      arch: "x86_64",
    });
    assertAssetExists(candidates, assetNames, "Linux x86_64");
  },
);

unitTest(
  "tinyTexPkgName - Linux aarch64 candidates match latest release",
  async () => {
    const release = await getRelease();
    const assetNames = release.assets.map((a) => a.name);
    const candidates = tinyTexPkgName("TinyTeX", release.tag_name, {
      os: "linux",
      arch: "aarch64",
    });
    assertAssetExists(candidates, assetNames, "Linux aarch64");
  },
);

unitTest(
  "tinyTexPkgName - macOS candidates match latest release",
  async () => {
    const release = await getRelease();
    const assetNames = release.assets.map((a) => a.name);
    const candidates = tinyTexPkgName("TinyTeX", release.tag_name, {
      os: "darwin",
      arch: "aarch64",
    });
    assertAssetExists(candidates, assetNames, "macOS");
  },
);

unitTest(
  "tinyTexPkgName - Windows candidates match latest release",
  async () => {
    const release = await getRelease();
    const assetNames = release.assets.map((a) => a.name);
    const candidates = tinyTexPkgName("TinyTeX", release.tag_name, {
      os: "windows",
      arch: "x86_64",
    });
    assertAssetExists(candidates, assetNames, "Windows");
  },
);

// ---- Extraction failure tests ----

function createMockContext(workingDir: string): InstallContext {
  return {
    workingDir,
    info: (_msg: string) => {},
    withSpinner: async (_options, op) => {
      await op();
    },
    error: (_msg: string) => {},
    confirm: async (_msg: string) => true,
    download: async (_name: string, _url: string, _target: string) => {},
    props: {},
    flags: {},
  };
}

unitTest(
  "install - throws on extraction failure for corrupt archive",
  async () => {
    const workingDir = Deno.makeTempDirSync({ prefix: "quarto-tinytex-test" });
    try {
      // Create a corrupt .tar.xz file that tar cannot extract
      const badArchive = join(
        workingDir,
        "TinyTeX-linux-x86_64-v2026.04.tar.xz",
      );
      Deno.writeTextFileSync(badArchive, "this is not a valid archive");

      const pkgInfo: PackageInfo = {
        filePath: badArchive,
        version: "v2026.04",
      };
      const context = createMockContext(workingDir);

      await assertRejects(
        () => tinyTexInstallable.install(pkgInfo, context),
        Error,
        "Failed to extract",
      );
    } finally {
      Deno.removeSync(workingDir, { recursive: true });
    }
  },
);

unitTest(
  "install - extraction failure for .tar.xz includes xz-utils hint only on Linux",
  async () => {
    const workingDir = Deno.makeTempDirSync({ prefix: "quarto-tinytex-test" });
    try {
      const badArchive = join(
        workingDir,
        "TinyTeX-linux-x86_64-v2026.04.tar.xz",
      );
      Deno.writeTextFileSync(badArchive, "this is not a valid archive");

      const pkgInfo: PackageInfo = {
        filePath: badArchive,
        version: "v2026.04",
      };
      const context = createMockContext(workingDir);

      try {
        await tinyTexInstallable.install(pkgInfo, context);
        throw new Error("Expected install to throw");
      } catch (e) {
        assert(
          e instanceof Error && e.message.includes("Failed to extract"),
          `Error should indicate extraction failure, got: ${e}`,
        );
        if (isLinux) {
          assert(
            e.message.includes("xz-utils"),
            `On Linux, error should mention xz-utils, got: ${e.message}`,
          );
        } else {
          assert(
            !e.message.includes("xz-utils"),
            `On non-Linux, error should not mention xz-utils, got: ${e.message}`,
          );
        }
      }
    } finally {
      Deno.removeSync(workingDir, { recursive: true });
    }
  },
);
