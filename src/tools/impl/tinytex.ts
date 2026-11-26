/*
 * tinytex.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { debug, warning } from "../../deno_ral/log.ts";

import { chmodSync, existsSync, readTextFile, readTextFileSync, realPath as fsRealPath, remove, safeRemoveSync, statSync, writeTextFileSync } from "../../deno_ral/fs.ts";
import { basename, join, relative } from "../../deno_ral/path.ts";

import { expandPath, which } from "../../core/path.ts";
import { unzip } from "../../core/zip.ts";
import {
  hasTexLive,
  removePath,
  texLiveContext,
  texLiveInPath,
} from "../../command/render/latexmk/texlive.ts";
import { execProcess } from "../../core/process.ts";

import {
  InstallableTool,
  InstallContext,
  kUpdatePath,
  PackageInfo,
  RemotePackageInfo,
  ToolConfigurationState,
} from "../types.ts";
import { getLatestRelease, githubToken } from "../github.ts";
import { hasTinyTex, tinyTexInstallDir } from "./tinytex-info.ts";
import { copyTo } from "../../core/copy.ts";
import { suggestUserBinPaths } from "../../core/path.ts";

import { ensureDirSync, walkSync } from "../../deno_ral/fs.ts";
import {
  arch,
  isLinux,
  isMac,
  isWindows,
  os as platformOs,
} from "../../deno_ral/platform.ts";

// This the https texlive repo that we use by default
export const kDefaultRepos = [
  "https://mirrors.rit.edu/CTAN/systems/texlive/tlnet/",
  "https://ctan.math.illinois.edu/systems/texlive/tlnet/",
  "https://mirror.las.iastate.edu/tex-archive/systems/texlive/tlnet/",
];

// CDN-backed TinyTeX mirror (https://yihui.org/en/2026/03/tinytex-ctan-mirror/).
export const kTlnetMirror = "https://tlnet.yihui.org";

// Different packages
const kTinyTexRepo = "rstudio/tinytex-releases";
const kTinyTexReleasesUrl = `https://github.com/${kTinyTexRepo}/releases`;
// const kPackageMinimal = "TinyTeX-0"; // smallest
// const kPackageDefault = "TinyTeX-1"; // Compiles most RMarkdown
const kPackageMaximal = "TinyTeX"; // Compiles 80% of documents
// const kPackageComplete = "TinyTex-2"; // Includes complete texlive library. Huge, 4GB download.

// The name of the file that we use to store the installed version
const kVersionFileName = "version";

export const tinyTexInstallable: InstallableTool = {
  name: "TinyTeX",
  prereqs: [{
    check: () => {
      // bin must be writable on MacOS
      return isWritable("/usr/local/bin");
    },
    os: ["darwin"],
    message: "The directory /usr/local/bin is not writable.",
  }],
  installed,
  installDir,
  binDir,
  installedVersion,
  verifyConfiguration,
  latestRelease: () => tinyTexLatestRelease(),
  preparePackage,
  install,
  afterInstall,
  uninstall,
};

async function installed() {
  const hasTiny = hasTinyTex();
  if (hasTiny) {
    return true;
  } else {
    if (await hasTexLive()) {
      return await isTinyTex();
    } else {
      return false;
    }
  }
}

async function installDir() {
  if (await installed()) {
    return Promise.resolve(tinyTexInstallDir());
  } else {
    return Promise.resolve(undefined);
  }
}

function verifyConfiguration(): Promise<ToolConfigurationState> {
  return Promise.resolve({ status: "ok" });
}

async function binDir() {
  if (await installed()) {
    const installDir = tinyTexInstallDir();
    if (installDir) {
      return Promise.resolve(binFolder(installDir));
    } else {
      warning(
        "Failed to resolve tinytex install directory even though it is installed.",
      );
      return Promise.resolve(undefined);
    }
  } else {
    return Promise.resolve(undefined);
  }
}

async function installedVersion() {
  const installDir = tinyTexInstallDir();
  if (installDir) {
    const versionFile = join(installDir, kVersionFileName);
    if (existsSync(versionFile)) {
      return await readTextFile(versionFile);
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

function noteInstalledVersion(version: string) {
  const installDir = tinyTexInstallDir();
  if (installDir) {
    const versionFile = join(installDir, kVersionFileName);
    writeTextFileSync(
      versionFile,
      version,
    );
  }
}

export async function preparePackage(
  context: InstallContext,
  latest?: RemotePackageInfo,
  fetchFn: typeof fetch = fetch,
): Promise<PackageInfo> {
  const pkgInfo = latest ?? await tinyTexLatestRelease(fetchFn);
  const version = pkgInfo.version;

  // Assets in candidate order; a release may carry only the old naming.
  const candidates = tinyTexPkgName(kPackageMaximal, version);
  const assets = candidates.flatMap((name) =>
    pkgInfo.assets.filter((asset) => asset.name === name)
  );
  const asset = await firstAvailableAsset(assets, fetchFn);
  if (asset) {
    const filePath = join(context.workingDir, asset.name);
    await context.download(`TinyTex ${version}`, asset.url, filePath);
    return { filePath, version };
  }
  context.error(
    `Couldn't determine what URL to use to download TinyTeX. ` +
      `Tried: ${candidates.join(", ")}`,
  );
  return Promise.reject();
}

// A failed download ends the install, so a missing candidate is found with a
// HEAD request first. Anything but a 404 counts as available: the download
// then reports a real failure.
async function firstAvailableAsset(
  assets: Array<{ name: string; url: string }>,
  fetchFn: typeof fetch,
): Promise<{ name: string; url: string } | undefined> {
  for (const asset of assets) {
    try {
      const response = await fetchFn(asset.url, {
        method: "HEAD",
        redirect: "manual",
      });
      if (response.status !== 404) {
        return asset;
      }
      debug(`${asset.url} not found, trying the next candidate`);
    } catch (e) {
      debug(`HEAD ${asset.url} failed: ${e}`);
      return asset;
    }
  }
  return undefined;
}

async function install(
  pkgInfo: PackageInfo,
  context: InstallContext,
) {
  // the target installation
  const installDir = tinyTexInstallDir();
  if (installDir) {
    const parentDir = join(installDir, "..");
    const realParentDir = expandPath(parentDir);
    const tinyTexDirName = isLinux ? ".TinyTeX" : "TinyTeX";
    debug(`TinyTex Directory Information:`);
    debug(`> installDir:  ${installDir}`);
    debug(`> parentDir:  ${parentDir}`);
    debug(`> realParentDir:  ${realParentDir}`);

    if (existsSync(realParentDir)) {
      // Extract the package

      debug(`Unzipping file ${pkgInfo.filePath}`);
      await context.withSpinner(
        { message: `Unzipping ${basename(pkgInfo.filePath)}` },
        async () => {
          const result = await unzip(pkgInfo.filePath);
          if (!result.success) {
            const hint = pkgInfo.filePath.endsWith(".tar.xz") && isLinux
              ? "\nYou may need to install xz-utils (e.g., apt install xz-utils)."
              : "";
            throw new Error(
              `Failed to extract ${basename(pkgInfo.filePath)}.${hint}\n${result.stderr}`,
            );
          }
        },
      );

      await context.withSpinner(
        { message: `Moving files` },
        () => {
          const from = join(context.workingDir, tinyTexDirName);
          debug(`Moving files\n> from ${from}\n> to   ${installDir}`);

          copyTo(from, installDir);

          // Work around: https://github.com/denoland/deno/issues/16921
          // This will verify that the permissions of the file
          // are preserved after the file has been copied.
          //
          // Once the Deno bug is resolve, the commit containing
          // this change should be reverted, quarto tinytex should
          // be remove and reinstalled and the smoke tests
          // should be run and pass.
          if (isMac) {
            for (const file of walkSync(from)) {
              if (file.isFile) {
                const relativePath = relative(from, file.path);
                const destPath = join(installDir, relativePath);
                const srcStat = statSync(file.path);
                const destStat = statSync(destPath);
                if (srcStat.mode !== null && srcStat.mode !== destStat.mode) {
                  chmodSync(destPath, srcStat.mode);
                }
              }
            }
          }

          safeRemoveSync(from, { recursive: true });

          // Note the version that we have installed
          noteInstalledVersion(pkgInfo.version);
          return Promise.resolve();
        },
      );

      context.props[kTlMgrKey] = isWindows
        ? join(binFolder(installDir), "tlmgr.bat")
        : join(binFolder(installDir), "tlmgr");

      return Promise.resolve();
    } else {
      context.error("Installation target directory doesn't exist");
      return Promise.reject();
    }
  } else {
    context.error("Unable to determine installation directory");
    return Promise.reject();
  }
}

function binFolder(installDir: string) {
  const nixBinFolder = () => {
    const oldBinFolder = join(
      installDir,
      "bin",
      `${Deno.build.arch}-${platformOs}`,
    );
    if (existsSync(oldBinFolder)) {
      return oldBinFolder;
    } else {
      return join(
        installDir,
        "bin",
        `universal-${platformOs}`,
      );
    }
  };

  const winBinFolder = () => {
    // TeX Live 2023 use windows now. Previous version were using win32
    const oldBinFolder = join(
      installDir,
      "bin",
      "win32",
    );
    if (existsSync(oldBinFolder)) {
      return oldBinFolder;
    } else {
      return join(
        installDir,
        "bin",
        "windows",
      );
    }
  };

  // Find the tlmgr and note its location
  return isWindows ? winBinFolder() : nixBinFolder();
}

async function afterInstall(context: InstallContext) {
  const tlmgrPath = context.props[kTlMgrKey] as string;
  if (tlmgrPath) {
    // Install tlgpg to permit safe utilization of https
    await context.withSpinner(
      { message: "Verifying tlgpg support" },
      async () => {
        if (["darwin", "windows"].includes(platformOs)) {
          await exec(
            tlmgrPath,
            [
              "-q",
              "--repository",
              "http://www.preining.info/tlgpg/",
              "install",
              "tlgpg",
            ],
          );
        }
      },
    );

    // Reconfigure font paths for xetex (rstudio/tinytex#313)
    await context.withSpinner(
      { message: "Configuring font paths" },
      async () => {
        await exec(
          tlmgrPath,
          [
            "postaction",
            "install",
            "script",
            "xetex",
          ],
        );
      },
    );

    // Set the default repo to an https repo.
    // Allow override via QUARTO_TINYTEX_REPOSITORY, or CTAN_REPO (honored for
    // parity with the R tinytex package, which reads it during install-tl).
    let restartRequired = false;
    // Use `||` (not `??`) so an explicit empty `QUARTO_TINYTEX_REPOSITORY=""`
    // falls through to `CTAN_REPO` rather than masking it.
    const envRepo = Deno.env.get("QUARTO_TINYTEX_REPOSITORY") ||
      Deno.env.get("CTAN_REPO");
    const defaultRepo = await resolveTinytexRepo(envRepo);
    await context.withSpinner(
      {
        message: `Setting default repository`,
        doneMessage: `Default Repository: ${defaultRepo}`,
      },
      async () => {
        await exec(
          tlmgrPath,
          ["-q", "option", "repository", defaultRepo],
        );
      },
    );

    // If the environment has requested, add this tex installation to
    // the system path
    if (context.flags[kUpdatePath]) {
      const message =
        `Unable to determine a path to use when installing TeX Live. 
To complete the installation, please run the following:

${tlmgrPath} option sys_bin <bin_dir_on_path>
${tlmgrPath} path add

This will instruct TeX Live to create symlinks that it needs in <bin_dir_on_path>.`;

      const configureBinPath = async (path: string) => {
        if (!isWindows) {
          // Find bin paths on this machine
          // Ensure the directory exists
          const expandedPath = expandPath(path);
          ensureDirSync(expandedPath);

          // Set the sys_bin for texlive
          await exec(
            tlmgrPath,
            ["option", "sys_bin", expandedPath],
          );
          return true;
        } else {
          return true;
        }
      };

      const paths: string[] = [];
      const envPath = Deno.env.get("QUARTO_TEXLIVE_BINPATH");
      if (envPath) {
        paths.push(envPath);
      } else if (!isWindows) {
        paths.push(...suggestUserBinPaths());
      } else {
        paths.push(tlmgrPath);
      }

      const binPathMessage = envPath
        ? `Setting TeXLive Binpath: ${envPath}`
        : !isWindows
        ? `Updating Path (inspecting ${paths.length} possible paths)`
        : "Updating Path";

      // Ensure symlinks are all set
      await context.withSpinner(
        { message: binPathMessage },
        async () => {
          let result;
          for (const path of paths) {
            const pathConfigured = await configureBinPath(path);
            if (pathConfigured) {
              result = await exec(
                tlmgrPath,
                ["path", "add"],
              );
              if (result.success) {
                break;
              }
            }
          }
          if (result && !result.success) {
            warning(message);
          }
        },
      );

      // After installing on windows, the path may not be updated which means a restart is required
      if (isWindows) {
        const texLiveInstalled = await hasTexLive();
        const texLivePath = await texLiveInPath();
        restartRequired = restartRequired || !texLiveInstalled || !texLivePath;
      }
    }

    return Promise.resolve(restartRequired);
  } else {
    context.error("Couldn't locate tlmgr after installation");
    return Promise.reject();
  }
}

async function uninstall(context: InstallContext) {
  if (!isTinyTex()) {
    context.error("Current LateX installation does not appear to be TinyTex");
    return Promise.reject();
  }

  if (context.flags[kUpdatePath]) {
    // remove symlinks
    if (await texLiveInPath()) {
      await context.withSpinner(
        { message: "Removing commands" },
        async () => {
          const texLive = await texLiveContext(true);
          const result = await removePath(texLive);
          if (!result.success) {
            context.error("Failed to uninstall");
            return Promise.reject();
          }
        },
      );
    }
  }

  await context.withSpinner(
    { message: "Removing directory" },
    async () => {
      // Remove the directory
      const installDir = tinyTexInstallDir();
      if (installDir) {
        await remove(installDir, { recursive: true });
      } else {
        context.error("Couldn't find install directory");
        return Promise.reject();
      }
    },
  );
}

function exec(path: string, cmd: string[]) {
  return execProcess({
    cmd: path,
    args: cmd,
    stdout: "piped",
    stderr: "piped",
  });
}

const kTlMgrKey = "tlmgr";

async function textLiveRepoFallback(
  fetchFn: typeof fetch = fetch,
) {
  // We don't set the default to `ctan` because one caveat of mirror.ctan.org
  // is that it resolves to many different hosts, and they are not perfectly synchronized;
  // Recommendation is to update only daily (at most), and not more often, which we don't want.
  // So:
  // 1. Try to get the automatic CTAN mirror returned from mirror.ctan.org
  // 2. If that fails, use one of the selected mirrors
  let autoUrl;
  try {
    const url = "https://mirror.ctan.org/systems/texlive/tlnet";
    const response = await fetchFn(url, { redirect: "follow" });
    autoUrl = response.url;
  } catch (_e) {}
  if (!autoUrl) {
    const randomInt = Math.floor(Math.random() * kDefaultRepos.length);
    autoUrl = kDefaultRepos[randomInt];
  }
  return autoUrl;
}

export async function isTlnet(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  // Probe the TLPDB file inside the mirror, not the URL root: a valid mirror
  // root commonly serves an HTML directory index, while a misconfigured
  // Cloudflare catch-all returns text/html for every path including the TLPDB.
  // Combining a deep-file probe with the text/html guard rejects both
  // unreachable and catch-all-misconfigured deployments. Matches R tinytex's
  // is_tlnet() at R/install.R.
  const probeUrl = `${url.replace(/\/$/, "")}/tlpkg/texlive.tlpdb`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchFn(probeUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    if (response.status >= 400) {
      debug(`isTlnet probe ${probeUrl} rejected: status ${response.status}`);
      return false;
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.toLowerCase().includes("text/html")) {
      debug(
        `isTlnet probe ${probeUrl} rejected: Content-Type ${contentType} (catch-all html)`,
      );
      return false;
    }
    return true;
  } catch (e) {
    debug(`isTlnet probe ${probeUrl} rejected: fetch error ${e}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveTinytexRepo(
  envOverride?: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  if (envOverride) {
    return envOverride;
  }
  if (await isTlnet(kTlnetMirror, fetchFn)) {
    return kTlnetMirror;
  }
  return textLiveRepoFallback(fetchFn);
}

export function tinyTexPkgName(
  base?: string,
  ver?: string,
  options?: { os?: string; arch?: string },
): string[] {
  const effectiveOs = options?.os ??
    (isWindows ? "windows" : isLinux ? "linux" : "darwin");
  const effectiveArch = options?.arch ?? arch;

  base = base || "TinyTeX";

  if (!ver) {
    const ext = effectiveOs === "windows"
      ? "zip"
      : effectiveOs === "linux"
      ? "tar.gz"
      : "tgz";
    return [`${base}.${ext}`];
  }

  const candidates: string[] = [];

  if (effectiveOs === "windows") {
    candidates.push(`${base}-windows-${ver}.exe`);
    candidates.push(`${base}-${ver}.zip`);
  } else if (effectiveOs === "linux") {
    if (effectiveArch === "aarch64") {
      candidates.push(`${base}-linux-arm64-${ver}.tar.xz`);
      candidates.push(`${base}-arm64-${ver}.tar.gz`);
    } else {
      candidates.push(`${base}-linux-x86_64-${ver}.tar.xz`);
      candidates.push(`${base}-${ver}.tar.gz`);
    }
  } else {
    candidates.push(`${base}-darwin-${ver}.tar.xz`);
    candidates.push(`${base}-${ver}.tgz`);
  }

  return candidates;
}

// Reads the tag from the Location of github.com's releases/latest redirect.
export function parseReleaseTag(location: string | null): string | undefined {
  const match = location?.match(/\/releases\/tag\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Download URLs for this platform's TinyTeX bundle, in candidate order.
// They are not checked against the release's assets.
export function tinyTexReleaseAssets(
  tag: string,
  options?: { os?: string; arch?: string },
): Array<{ name: string; url: string }> {
  return tinyTexPkgName(kPackageMaximal, tag, options).map((name) => ({
    name,
    url: `${kTinyTexReleasesUrl}/download/${encodeURIComponent(tag)}/${name}`,
  }));
}

// The unauthenticated REST API allows 60 requests per hour per IP, which
// shared egress (CI runners, build farms, NAT) exhausts, so without a token
// the tag comes from the github.com redirect. The API remains the fallback.
export async function tinyTexLatestRelease(
  fetchFn: typeof fetch = fetch,
  token: string | undefined = githubToken(),
): Promise<RemotePackageInfo> {
  if (!token) {
    const tag = await latestTagFromRedirect(fetchFn);
    if (tag) {
      return {
        url: `${kTinyTexReleasesUrl}/tag/${encodeURIComponent(tag)}`,
        version: tag,
        assets: tinyTexReleaseAssets(tag),
      };
    }
  }
  const githubRelease = await getLatestRelease(kTinyTexRepo, fetchFn, token);
  return {
    url: githubRelease.html_url,
    version: githubRelease.tag_name,
    assets: githubRelease.assets.map((asset) => {
      return { name: asset.name, url: asset.browser_download_url };
    }),
  };
}

async function latestTagFromRedirect(
  fetchFn: typeof fetch,
): Promise<string | undefined> {
  const url = `${kTinyTexReleasesUrl}/latest`;
  try {
    const response = await fetchFn(url, {
      method: "HEAD",
      redirect: "manual",
    });
    const location = response.headers.get("Location");
    const tag = parseReleaseTag(location);
    if (!tag) {
      debug(
        `No release tag in ${url} response (status ${response.status}, Location ${location})`,
      );
    }
    return tag;
  } catch (e) {
    debug(`Request to ${url} failed: ${e}`);
    return undefined;
  }
}

async function isWritable(path: string) {
  const desc = { name: "write", path } as const;
  const status = await Deno.permissions.query(desc);
  return status.state === "granted";
}

async function isTinyTex() {
  const root = await texLiveRoot();
  if (root) {
    // directory name (lower) is tinytex
    if (root.match(/[/\\][Tt]iny[Tt]e[Xx][/\\]?/)) {
      return true;
    }

    // Format config contains references to tinytex
    const cnfFile = join(root, "texmf-dist/web2c/fmtutil.cnf");
    if (existsSync(cnfFile)) {
      const cnfText = readTextFileSync(cnfFile);
      const match = cnfText.match(/\W[.]?TinyTeX\W/);
      if (match) {
        return true;
      }
    }
    return false;
  }
  return false;
}

async function texLiveRoot() {
  const texLivePath = await which("tlmgr");
  if (texLivePath) {
    // The real (non-symlink) path
    const realPath = await fsRealPath(texLivePath);
    if (isWindows) {
      return join(realPath, "..", "..", "..");
    } else {
      // Check that the directory coontains a bin folder
      const root = join(realPath, "..", "..", "..", "..");
      const tlBin = join(root, "bin");
      if (existsSync(tlBin)) {
        return root;
      } else {
        return undefined;
      }
    }
  } else {
    const installDir = tinyTexInstallDir();
    if (installDir && existsSync(installDir)) {
      return installDir;
    } else {
      return undefined;
    }
  }
}
