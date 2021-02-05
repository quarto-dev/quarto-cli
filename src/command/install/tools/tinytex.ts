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
import { hasLatexDistribution } from "../../render/latekmk/latex.ts";
import { hasTexLive, removeAll } from "../../render/latekmk/texlive.ts";
import { execProcess } from "../../../core/process.ts";

import { InstallableTool, InstallContext } from "../install.ts";

const kDefaultRepo = "https://mirrors.rit.edu/CTAN/systems/texlive/tlnet/";

export const tinyTexInstallable: InstallableTool = {
  name: "TinyTeX",
  prereqs: [{
    check: () => {
      // bin must be writable on MacOS
      return isWritable("/usr/local/bin");
    },
    os: ["darwin"],
    notMetMessage: "The directory /usr/local/bin is not writable.",
  }, {
    check: async () => {
      // Can't already have TeXLive
      const hasTl = await hasTexLive();
      return !hasTl;
    },
    os: ["darwin", "linux", "windows"],
    notMetMessage: "An existing TexLive installation has been detected.",
  }, {
    check: async () => {
      // Can't already have TeX
      const hasTl = await hasLatexDistribution();
      return !hasTl;
    },
    os: ["darwin", "linux", "windows"],
    notMetMessage: "An existing LaTeX installation has been detected.",
  }, {
    check: () => {
      // Can't be a linux non-x86 platform
      const needsSource = needsSourceInstall();
      return Promise.resolve(!needsSource);
    },
    os: ["linux"],
    notMetMessage:
      "This platform doesn't support installation at this time. Please install manually instead.",
  }],
  installed: async () => {
    const hasTl = await hasTexLive();
    if (hasTl) {
      return isTinyTex();
    } else {
      return Promise.resolve(false);
    }
  },
  install,
  postinstall,
  uninstall,
};

async function install(context: InstallContext) {
  // target package information
  const pkgName = tinyTexPkgName("TinyTeX-1");
  const pkgFilePath = join(context.workingDir, pkgName);

  // Download the package
  const url = tinyTexUrl(pkgName);
  await context.download("TinyTex", url, pkgFilePath);

  // the target installation
  const installDir = tinyTexInstallDir();
  if (installDir) {
    const parentDir = join(installDir, "..");
    const realParentDir = expandPath(parentDir);
    const tinyTexDirName = Deno.build.os === "linux" ? ".TinyTeX" : "TinyTeX";

    if (existsSync(realParentDir)) {
      // Extract the package
      context.info(`Unzipping ${basename(pkgFilePath)}`);
      await unzip(pkgFilePath);

      // Move it to the install dir
      context.info(`Moving files`);
      const from = join(context.workingDir, tinyTexDirName);
      const to = expandPath(installDir);
      moveSync(from, to, { overwrite: true });

      // Find the tlmgr and note its location
      const binFolder = Deno.build.os === "windows"
        ? join(
          to,
          "bin",
          "win32",
        )
        : join(
          to,
          "bin",
          `${Deno.build.arch}-${Deno.build.os}`,
        );
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

async function postinstall(context: InstallContext) {
  const tlmgrPath = context.props[kTlMgrKey] as string;
  if (tlmgrPath) {
    // Install tlgpg to permit safe utilization of https
    context.info("Verifying tlgpg support");
    if (["darwin", "windows"].includes(Deno.build.os)) {
      await exec(
        tlmgrPath,
        ["--repository", "http://www.preining.info/tlgpg/", "install", "tlgpg"],
      );
    }

    // Set the default repo to an https repo
    context.info("Configuring default repository");
    await exec(
      tlmgrPath,
      ["option", "repository", kDefaultRepo],
    );

    let restartRequired = false;
    if (Deno.build.os === "linux") {
      const binPath = expandPath("~/bin");
      if (!existsSync(binPath)) {
        // Make the directory
        Deno.mkdirSync(binPath);

        // Notify tlmgr of it
        await exec(
          tlmgrPath,
          ["option", "sys_bin", binPath],
        );

        restartRequired = true;
      }
    }

    // Ensure symlinks are all set
    context.info("Updating paths");
    await exec(
      tlmgrPath,
      ["path", "add"],
    );

    // Perform add path and other post install work
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

  const result = await removeAll();
  if (!result.success) {
    context.error("Failed to uninstall");
    return Promise.reject();
  }
}

async function exec(path: string, cmd: string[]) {
  return execProcess({ cmd: [path, ...cmd], stdout: "piped" });
}

const kTlMgrKey = "tlmgr";

function tinyTexInstallDir(): string | undefined {
  switch (Deno.build.os) {
    case "windows":
      return join(getenv("APPDATA", undefined), "TinyTeX");
    case "linux":
      return "~./TinyTeX";
    case "darwin":
      return "~/Library/TinyTeX";
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
    return `${base}-v${ver}.${ext}`;
  } else {
    return `${base}.${ext}`;
  }
}

function tinyTexUrl(pkg: string, ver?: string) {
  if (ver) {
    return `https://github.com/yihui/tinytex-releases/releases/download/v${ver}/${pkg}`;
  } else {
    return `https://yihui.org/tinytex/${pkg}`;
  }
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
    if (root.toLowerCase().endsWith("tinytex")) {
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
      return join(realPath, "..", "..");
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
