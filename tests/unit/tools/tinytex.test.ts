/*
 * tinytex.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects } from "testing/asserts";
import {
  isTlnet,
  kDefaultRepos,
  kTlnetMirror,
  parseReleaseTag,
  resolveTinytexRepo,
  tinyTexInstallable,
  tinyTexLatestRelease,
  tinyTexPkgName,
  tinyTexReleaseAssets,
} from "../../../src/tools/impl/tinytex.ts";
import { getLatestRelease, githubToken } from "../../../src/tools/github.ts";
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

// ---- isTlnet probe tests ----

function mockResponse(
  status: number,
  contentType: string | null,
): Response {
  const headers = new Headers();
  if (contentType !== null) headers.set("Content-Type", contentType);
  return new Response(null, { status, headers });
}

// Stub that always resolves to a given (status, contentType) response.
const okStub = (status: number, contentType: string | null): typeof fetch =>
() => Promise.resolve(mockResponse(status, contentType));

// Stub that always rejects with the given error message.
const errStub = (message: string): typeof fetch =>
() => Promise.reject(new Error(message));

unitTest("isTlnet - returns true for 200 with non-html Content-Type", async () => {
  assertEquals(
    await isTlnet(kTlnetMirror, okStub(200, "application/octet-stream")),
    true,
  );
});

unitTest("isTlnet - returns true when Content-Type header missing", async () => {
  assertEquals(await isTlnet(kTlnetMirror, okStub(200, null)), true);
});

unitTest("isTlnet - returns false for 200 with text/html (Cloudflare catch-all)", async () => {
  assertEquals(
    await isTlnet(kTlnetMirror, okStub(200, "text/html; charset=utf-8")),
    false,
  );
});

unitTest("isTlnet - returns false for 4xx status", async () => {
  assertEquals(await isTlnet(kTlnetMirror, okStub(404, "text/plain")), false);
});

unitTest("isTlnet - returns false for status exactly 400 (boundary)", async () => {
  assertEquals(
    await isTlnet(kTlnetMirror, okStub(400, "application/octet-stream")),
    false,
  );
});

unitTest("isTlnet - returns false for 5xx server error", async () => {
  assertEquals(await isTlnet(kTlnetMirror, okStub(503, "text/plain")), false);
});

unitTest("isTlnet - rejects Content-Type case-insensitively (uppercase TEXT/HTML)", async () => {
  assertEquals(
    await isTlnet(kTlnetMirror, okStub(200, "TEXT/HTML; CHARSET=UTF-8")),
    false,
  );
});

unitTest("isTlnet - passes method 'HEAD', redirect 'follow', and AbortSignal to fetchFn", async () => {
  let init: RequestInit | undefined;
  const stub: typeof fetch = (_input, requestInit) => {
    init = requestInit;
    return Promise.resolve(mockResponse(200, "application/octet-stream"));
  };
  await isTlnet(kTlnetMirror, stub);
  assertEquals(init?.method, "HEAD");
  assertEquals(init?.redirect, "follow");
  assert(
    init?.signal instanceof AbortSignal,
    "expected AbortSignal wired to fetch init",
  );
});

unitTest("isTlnet - returns false when fetch throws", async () => {
  assertEquals(
    await isTlnet(kTlnetMirror, errStub("network unreachable")),
    false,
  );
});

unitTest("isTlnet - probes <url>/tlpkg/texlive.tlpdb, not root", async () => {
  let probedUrl: string | undefined;
  const stub: typeof fetch = (input) => {
    probedUrl = typeof input === "string" ? input : input.toString();
    return Promise.resolve(mockResponse(200, "application/octet-stream"));
  };
  await isTlnet(kTlnetMirror, stub);
  assertEquals(probedUrl, `${kTlnetMirror}/tlpkg/texlive.tlpdb`);
});

unitTest("isTlnet - strips trailing slash from url before appending tlpdb path", async () => {
  let probedUrl: string | undefined;
  const stub: typeof fetch = (input) => {
    probedUrl = typeof input === "string" ? input : input.toString();
    return Promise.resolve(mockResponse(200, "application/octet-stream"));
  };
  await isTlnet(`${kTlnetMirror}/`, stub);
  assertEquals(probedUrl, `${kTlnetMirror}/tlpkg/texlive.tlpdb`);
});

// ---- resolveTinytexRepo orchestrator tests ----

unitTest("resolveTinytexRepo - env override bypasses probe", async () => {
  let probed = false;
  const stub: typeof fetch = () => {
    probed = true;
    return Promise.resolve(mockResponse(200, "application/octet-stream"));
  };
  const result = await resolveTinytexRepo(
    "https://example.com/my/mirror",
    stub,
  );
  assertEquals(result, "https://example.com/my/mirror");
  assertEquals(probed, false);
});

unitTest("resolveTinytexRepo - empty env override is treated as unset", async () => {
  let probed = false;
  const stub: typeof fetch = () => {
    probed = true;
    return Promise.resolve(mockResponse(200, "application/octet-stream"));
  };
  const result = await resolveTinytexRepo("", stub);
  assertEquals(result, kTlnetMirror);
  assertEquals(probed, true);
});

unitTest("resolveTinytexRepo - returns kTlnetMirror when probe succeeds", async () => {
  const result = await resolveTinytexRepo(
    undefined,
    okStub(200, "application/octet-stream"),
  );
  assertEquals(result, kTlnetMirror);
});

unitTest("resolveTinytexRepo - falls back to kDefaultRepos when probe and mirror.ctan.org both unreachable", async () => {
  // Stub returns html for the tlnet probe and throws for any other fetch
  // (mirror.ctan.org). textLiveRepoFallback then picks from kDefaultRepos.
  const stub: typeof fetch = (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith(kTlnetMirror)) {
      return Promise.resolve(mockResponse(200, "text/html"));
    }
    return Promise.reject(new Error("unreachable"));
  };
  const result = await resolveTinytexRepo(undefined, stub);
  assert(
    kDefaultRepos.includes(result),
    `Expected result in kDefaultRepos, got ${result}`,
  );
});

// ---- Release resolution without the GitHub REST API ----

const kReleasesUrl = "https://github.com/rstudio/tinytex-releases/releases";

function redirectResponse(location: string | null): Response {
  const headers = new Headers();
  if (location !== null) headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

function apiReleaseResponse(tag: string): Response {
  const release: GitHubRelease = {
    html_url: `${kReleasesUrl}/tag/${tag}`,
    tag_name: tag,
    assets: [{
      name: `TinyTeX-${tag}.zip`,
      browser_download_url: `${kReleasesUrl}/download/${tag}/TinyTeX-${tag}.zip`,
    }],
  };
  return new Response(JSON.stringify(release), { status: 200 });
}

// Records requested URLs and request headers.
function recordingStub(
  respond: (url: string) => Response,
): { fetchFn: typeof fetch; requests: { url: string; init?: RequestInit }[] } {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    requests.push({ url, init });
    return Promise.resolve(respond(url));
  };
  return { fetchFn, requests };
}

unitTest("parseReleaseTag - reads the tag from a releases/tag Location", async () => {
  assertEquals(parseReleaseTag(`${kReleasesUrl}/tag/v2026.11`), "v2026.11");
  assertEquals(parseReleaseTag(`${kReleasesUrl}/tag/v2026.11.02`), "v2026.11.02");
});

unitTest("parseReleaseTag - returns undefined for a missing or unrelated Location", async () => {
  assertEquals(parseReleaseTag(null), undefined);
  assertEquals(parseReleaseTag(`${kReleasesUrl}`), undefined);
  assertEquals(parseReleaseTag("https://github.com/login"), undefined);
});

unitTest("tinyTexReleaseAssets - Windows download URLs, new then old naming", async () => {
  assertEquals(
    tinyTexReleaseAssets("v2026.11", { os: "windows", arch: "x86_64" }),
    [
      {
        name: "TinyTeX-windows-v2026.11.exe",
        url: `${kReleasesUrl}/download/v2026.11/TinyTeX-windows-v2026.11.exe`,
      },
      {
        name: "TinyTeX-v2026.11.zip",
        url: `${kReleasesUrl}/download/v2026.11/TinyTeX-v2026.11.zip`,
      },
    ],
  );
});

unitTest("tinyTexReleaseAssets - Linux x86_64 download URLs, new then old naming", async () => {
  assertEquals(
    tinyTexReleaseAssets("v2026.11", { os: "linux", arch: "x86_64" }).map((a) => a.url),
    [
      `${kReleasesUrl}/download/v2026.11/TinyTeX-linux-x86_64-v2026.11.tar.xz`,
      `${kReleasesUrl}/download/v2026.11/TinyTeX-v2026.11.tar.gz`,
    ],
  );
});

unitTest("tinyTexReleaseAssets - Linux aarch64 download URLs, new then old naming", async () => {
  assertEquals(
    tinyTexReleaseAssets("v2026.11", { os: "linux", arch: "aarch64" }).map((a) => a.url),
    [
      `${kReleasesUrl}/download/v2026.11/TinyTeX-linux-arm64-v2026.11.tar.xz`,
      `${kReleasesUrl}/download/v2026.11/TinyTeX-arm64-v2026.11.tar.gz`,
    ],
  );
});

unitTest("tinyTexReleaseAssets - macOS download URLs, new then old naming", async () => {
  assertEquals(
    tinyTexReleaseAssets("v2026.11", { os: "darwin", arch: "aarch64" }).map((a) => a.url),
    [
      `${kReleasesUrl}/download/v2026.11/TinyTeX-darwin-v2026.11.tar.xz`,
      `${kReleasesUrl}/download/v2026.11/TinyTeX-v2026.11.tgz`,
    ],
  );
});

unitTest("tinyTexLatestRelease - without a token, makes no api.github.com request", async () => {
  const { fetchFn, requests } = recordingStub(() =>
    redirectResponse(`${kReleasesUrl}/tag/v2026.11`)
  );
  const info = await tinyTexLatestRelease(fetchFn, undefined);
  assertEquals(info.version, "v2026.11");
  assertEquals(info.url, `${kReleasesUrl}/tag/v2026.11`);
  assertEquals(info.assets, tinyTexReleaseAssets("v2026.11"));
  assertEquals(requests.map((r) => r.url), [`${kReleasesUrl}/latest`]);
  assertEquals(requests[0].init?.method, "HEAD");
  assertEquals(requests[0].init?.redirect, "manual");
});

unitTest("tinyTexLatestRelease - falls back to the API when the redirect has no tag", async () => {
  const { fetchFn, requests } = recordingStub((url) =>
    url.startsWith("https://api.github.com/")
      ? apiReleaseResponse("v2026.10")
      : redirectResponse(null)
  );
  const info = await tinyTexLatestRelease(fetchFn, undefined);
  assertEquals(info.version, "v2026.10");
  assertEquals(requests.map((r) => r.url), [
    `${kReleasesUrl}/latest`,
    "https://api.github.com/repos/rstudio/tinytex-releases/releases/latest",
  ]);
});

unitTest("tinyTexLatestRelease - with a token, uses the authenticated API", async () => {
  const { fetchFn, requests } = recordingStub(() => apiReleaseResponse("v2026.10"));
  const info = await tinyTexLatestRelease(fetchFn, "secret");
  assertEquals(info.version, "v2026.10");
  assertEquals(requests.map((r) => r.url), [
    "https://api.github.com/repos/rstudio/tinytex-releases/releases/latest",
  ]);
  assertEquals(
    new Headers(requests[0].init?.headers).get("Authorization"),
    "Bearer secret",
  );
});

// ---- GitHub token lookup ----

const envOf = (vars: Record<string, string>) => (name: string) => vars[name];

unitTest("githubToken - prefers GH_TOKEN over GITHUB_TOKEN", async () => {
  assertEquals(githubToken(envOf({ GH_TOKEN: "gh", GITHUB_TOKEN: "ghs" })), "gh");
});

unitTest("githubToken - uses GITHUB_TOKEN when GH_TOKEN is unset", async () => {
  assertEquals(githubToken(envOf({ GITHUB_TOKEN: "ghs" })), "ghs");
});

unitTest("githubToken - returns undefined when no token is set", async () => {
  assertEquals(githubToken(envOf({})), undefined);
});

unitTest("getLatestRelease - sends no Authorization header without a token", async () => {
  const { fetchFn, requests } = recordingStub(() => apiReleaseResponse("v2026.10"));
  await getLatestRelease(kTinyTexRepo, fetchFn, undefined);
  assertEquals(new Headers(requests[0].init?.headers).get("Authorization"), null);
});

// ---- preparePackage ----

function downloadRecordingContext(
  workingDir: string,
  missing: string[] = [],
): { context: InstallContext; downloads: string[] } {
  const downloads: string[] = [];
  const context = createMockContext(workingDir);
  context.download = (_name, url, _target) => {
    downloads.push(url);
    if (missing.includes(url)) {
      return Promise.reject(
        new Error("download failed (HTTP status 404 - Not Found)"),
      );
    }
    return Promise.resolve();
  };
  return { context, downloads };
}

unitTest("preparePackage - uses the release info it is given", async () => {
  const latest = {
    url: `${kReleasesUrl}/tag/v2000.01`,
    version: "v2000.01",
    assets: tinyTexReleaseAssets("v2000.01"),
  };
  const { context, downloads } = downloadRecordingContext("work");
  const pkg = await tinyTexInstallable.preparePackage(context, latest);
  assertEquals(pkg.version, "v2000.01");
  assertEquals(downloads, [latest.assets[0].url]);
});

unitTest("preparePackage - tries the old asset name when the new one is a 404", async () => {
  const latest = {
    url: `${kReleasesUrl}/tag/v2000.01`,
    version: "v2000.01",
    assets: tinyTexReleaseAssets("v2000.01"),
  };
  const { context, downloads } = downloadRecordingContext("work", [
    latest.assets[0].url,
  ]);
  const pkg = await tinyTexInstallable.preparePackage(context, latest);
  assertEquals(downloads, [latest.assets[0].url, latest.assets[1].url]);
  assertEquals(pkg.filePath, join("work", latest.assets[1].name));
});
