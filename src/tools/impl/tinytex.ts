/*
 * tinytex.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { debug, warning } from "log/mod.ts";

import { existsSync } from "fs/exists.ts";
import { basename, join } from "path/mod.ts";

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
import { getLatestRelease } from "../github.ts";
import { hasTinyTex, tinyTexInstallDir } from "./tinytex-info.ts";
import { copyTo } from "../../core/copy.ts";
import { suggestUserBinPaths } from "../../core/env.ts";

import { ensureDirSync, walkSync } from "fs/mod.ts";
import { relative } from "path/mod.ts";

// This the https texlive repo that we use by default
const kDefaultRepos = [
  "https://mirrors.rit.edu/CTAN/systems/texlive/tlnet/",
  "https://ctan.math.illinois.edu/systems/texlive/tlnet/",
  "https://mirror.las.iastate.edu/tex-archive/systems/texlive/tlnet/",
];

// Different packages
const kTinyTexRepo = "rstudio/tinytex-releases";
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
  }, {
    check: () => {
      // Can't be a linux non-x86 platform
      const needsSource = needsSourceInstall();
      return Promise.resolve(!needsSource);
    },
    os: ["linux"],
    message:
      "This platform doesn't support installation at this time. Please install manually instead.",
  }],
  installed,
  installDir,
  binDir,
  installedVersion,
  verifyConfiguration,
  latestRelease: remotePackageInfo,
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
      return await Deno.readTextFile(versionFile);
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
    Deno.writeTextFileSync(
      versionFile,
      version,
    );
  }
}

async function preparePackage(
  context: InstallContext,
): Promise<PackageInfo> {
  // Find the latest version
  const pkgInfo = await remotePackageInfo();
  const version = pkgInfo.version;

  // target package information
  const pkgName = tinyTexPkgName(kPackageMaximal, version);
  const filePath = join(context.workingDir, pkgName);

  // Download the package
  const url = tinyTexUrl(pkgName, pkgInfo);
  if (url) {
    // Download the package
    await context.download(`TinyTex ${version}`, url, filePath);
    return { filePath, version };
  } else {
    context.error("Couldn't determine what URL to use to download");
    return Promise.reject();
  }
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
    const tinyTexDirName = Deno.build.os === "linux" ? ".TinyTeX" : "TinyTeX";
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
          await unzip(pkgInfo.filePath);
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
          if (Deno.build.os === "darwin") {
            for (const file of walkSync(from)) {
              if (file.isFile) {
                const relativePath = relative(from, file.path);
                const destPath = join(installDir, relativePath);
                const srcStat = Deno.statSync(file.path);
                const destStat = Deno.statSync(destPath);
                if (srcStat.mode !== null && srcStat.mode !== destStat.mode) {
                  Deno.chmodSync(destPath, srcStat.mode);
                }
              }
            }
          }

          Deno.removeSync(from, { recursive: true });

          // Note the version that we have installed
          noteInstalledVersion(pkgInfo.version);
          return Promise.resolve();
        },
      );

      context.props[kTlMgrKey] = Deno.build.os === "windows"
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
      `${Deno.build.arch}-${Deno.build.os}`,
    );
    if (existsSync(oldBinFolder)) {
      return oldBinFolder;
    } else {
      return join(
        installDir,
        "bin",
        `universal-${Deno.build.os}`,
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
  return Deno.build.os === "windows" ? winBinFolder() : nixBinFolder();
}

async function afterInstall(context: InstallContext) {
  const tlmgrPath = context.props[kTlMgrKey] as string;
  if (tlmgrPath) {
    // Install tlgpg to permit safe utilization of https
    await context.withSpinner(
      { message: "Verifying tlgpg support" },
      async () => {
        if (["darwin", "windows"].includes(Deno.build.os)) {
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

    // Set the default repo to an https repo
    let restartRequired = false;
    const defaultRepo = textLiveRepo();
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
        if (Deno.build.os !== "windows") {
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
      } else if (Deno.build.os !== "windows") {
        paths.push(...suggestUserBinPaths());
      } else {
        paths.push(tlmgrPath);
      }

      const binPathMessage = envPath
        ? `Setting TeXLive Binpath: ${envPath}`
        : Deno.build.os !== "windows"
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
      if (Deno.build.os === "windows") {
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
        await Deno.remove(installDir, { recursive: true });
      } else {
        context.error("Couldn't find install directory");
        return Promise.reject();
      }
    },
  );
}

function exec(path: string, cmd: string[]) {
  return execProcess({ cmd: [path, ...cmd], stdout: "piped", stderr: "piped" });
}

const kTlMgrKey = "tlmgr";

function textLiveRepo(): string {
  const randomInt = Math.floor(Math.random() * kDefaultRepos.length);
  return kDefaultRepos[randomInt];
}

function tinyTexPkgName(base?: string, ver?: string) {
  const ext = Deno.build.os === "windows"
    ? "zip"
    : Deno.build.os === "linux"
    ? "tar.gz"
    : "tgz";

  base = base || "TinyTeX";
  if (ver) {
    return `${base}-${ver}.${ext}`;
  } else {
    return `${base}.${ext}`;
  }
}

function tinyTexUrl(pkg: string, remotePkgInfo: RemotePackageInfo) {
  const asset = remotePkgInfo.assets.find((asset) => {
    return asset.name === pkg;
  });
  return asset?.url;
}

async function remotePackageInfo(): Promise<RemotePackageInfo> {
  const githubRelease = await getLatestRelease(kTinyTexRepo);
  return {
    url: githubRelease.html_url,
    version: githubRelease.tag_name,
    assets: githubRelease.assets.map((asset) => {
      return { name: asset.name, url: asset.browser_download_url };
    }),
  };
}

async function isWritable(path: string) {
  const desc = { name: "write", path } as const;
  const status = await Deno.permissions.query(desc);
  return status.state === "granted";
}

function needsSourceInstall() {
  if (Deno.build.os === "linux" && Deno.build.arch !== "x86_64") {
    return true;
  } else {
    return false;
  }
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
      const cnfText = Deno.readTextFileSync(cnfFile);
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
    const realPath = await Deno.realPath(texLivePath);
    if (Deno.build.os === "windows") {
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
