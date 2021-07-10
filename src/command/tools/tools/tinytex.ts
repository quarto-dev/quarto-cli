/*
 * tinytex.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { existsSync } from "fs/exists.ts";
import { basename, join } from "path/mod.ts";
import { moveSync } from "fs/move.ts";

import { getenv } from "../../../core/env.ts";
import { expandPath, which } from "../../../core/path.ts";
import { unzip } from "../../../core/zip.ts";
import { hasLatexDistribution } from "../../render/latexmk/latex.ts";
import { hasTexLive, removePath } from "../../render/latexmk/texlive.ts";
import { execProcess } from "../../../core/process.ts";

import {
  InstallableTool,
  InstallContext,
  PackageInfo,
  RemotePackageInfo,
} from "../tools.ts";
import { getLatestRelease } from "../github.ts";

// This the https texlive repo that we use by default
const kDefaultRepos = [
  "https://mirrors.rit.edu/CTAN/systems/texlive/tlnet/",
  "https://ctan.math.illinois.edu/systems/texlive/tlnet/",
  "https://mirror.las.iastate.edu/tex-archive/systems/texlive/tlnet/",
];

// Different packages
const kTinyTexRepo = "yihui/tinytex-releases";
// const kPackageMinimal = "TinyTeX-0"; // smallest
// const kPackageDefault = "TinyTeX-1"; // Compiles most RMarkdown
const kPackageMaximal = "TinyTeX"; // Compiles 80% of documents

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
    check: async () => {
      // Can't already have TeXLive
      const hasTl = await hasTexLive();
      return !hasTl;
    },
    os: ["darwin", "linux", "windows"],
    message: "An existing TexLive installation has been detected.",
  }, {
    check: async () => {
      // Can't already have TeX
      const hasTl = await hasLatexDistribution();
      return !hasTl;
    },
    os: ["darwin", "linux", "windows"],
    message: "An existing LaTeX installation has been detected.",
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
  installedVersion,
  latestRelease: remotePackageInfo,
  preparePackage,
  install,
  afterInstall,
  uninstall,
};

async function installed() {
  const hasTl = await hasTexLive();
  if (hasTl) {
    return await isTinyTex();
  } else {
    return Promise.resolve(false);
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

    if (existsSync(realParentDir)) {
      // Extract the package

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
          moveSync(from, installDir, { overwrite: true });

          // Note the version that we have installed
          noteInstalledVersion(pkgInfo.version);
          return Promise.resolve();
        },
      );

      const macBinFolder = () => {
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

      // Find the tlmgr and note its location
      const binFolder = Deno.build.os === "windows"
        ? join(
          installDir,
          "bin",
          "win32",
        )
        : macBinFolder();

      context.props[kTlMgrKey] = Deno.build.os === "windows"
        ? join(binFolder, "tlmgr.bat")
        : join(binFolder, "tlmgr");

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

        if (Deno.build.os === "linux") {
          const binPath = expandPath("~/bin");
          if (!existsSync(binPath)) {
            // Make the directory
            Deno.mkdirSync(binPath);
            restartRequired = true;
          }

          // Notify tlmgr of it
          await exec(
            tlmgrPath,
            ["option", "sys_bin", binPath],
          );
        }
      },
    );

    // Ensure symlinks are all set
    await context.withSpinner(
      { message: "Updating paths" },
      async () => {
        await exec(
          tlmgrPath,
          ["path", "add"],
        );
      },
    );

    // After installing on windows, the path may not be updated which means a restart is required
    if (Deno.build.os === "windows") {
      const tlmgrIsInPath = await hasTexLive();
      restartRequired = restartRequired || !tlmgrIsInPath;
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
  // remove symlinks
  await context.withSpinner(
    { message: "Removing commands" },
    async () => {
      const result = await removePath();
      if (!result.success) {
        context.error("Failed to uninstall");
        return Promise.reject();
      }
    },
  );

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
  return execProcess({ cmd: [path, ...cmd], stdout: "piped" });
}

const kTlMgrKey = "tlmgr";

function textLiveRepo(): string {
  const randomInt = Math.floor(Math.random() * kDefaultRepos.length);
  return kDefaultRepos[randomInt];
}

export function tinyTexInstallDir(): string | undefined {
  switch (Deno.build.os) {
    case "windows":
      return expandPath(join(getenv("APPDATA", undefined), "TinyTeX"));
    case "linux":
      return expandPath("~/.TinyTeX");
    case "darwin":
      return expandPath("~/Library/TinyTeX");
    default:
      return undefined;
  }
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
    return undefined;
  }
}
