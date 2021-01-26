/*
 * tinytex.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { existsSync } from "fs/exists.ts";
import { join } from "path/mod.ts";
import { which } from "../../../core/path.ts";
import { hasLatexDistribution } from "../../render/latekmk/latex.ts";
import { hasTexLive } from "../../render/latekmk/texlive.ts";

import {
  InstallableTool,
  InstallMsgHandler,
  InstallPreReq,
} from "../install.ts";

const binWritable: InstallPreReq = {
  check: () => {
    return isWritable("/usr/local/bin");
  },
  os: ["darwin"],
  notMetMessage: "The directory /usr/local/bin is not writable.",
};

const noTexLive: InstallPreReq = {
  check: async () => {
    const hasTl = await hasTexLive();
    return !hasTl;
  },
  os: ["darwin", "linux", "windows"],
  notMetMessage: "An existing TexLive installation has been detected.",
};

const noTex: InstallPreReq = {
  check: async () => {
    const hasTl = await hasLatexDistribution();
    return !hasTl;
  },
  os: ["darwin", "linux", "windows"],
  notMetMessage: "An existing LaTeX installation has been detected.",
};

export const tinyTexInstallable: InstallableTool = {
  prereqs: [binWritable, noTexLive, noTex],
  installed,
  install,
  postinstall,
};

async function installed() {
  const hasTl = await hasTexLive();
  if (hasTl) {
    return isTinyTex();
  } else {
    return Promise.resolve(false);
  }
}

async function install(msgHandler: InstallMsgHandler) {
  // We don't currently need to implement source install as Deno is only supported
  // on the x86 architecture that we have packages for
  if (needsSourceInstall()) {
    msgHandler.error(
      "Unable to install TinyTex from source at this time. Please install it manually.",
    );
    return Promise.reject();
  }

  // Working directory for downloads, etc...
  const workingDir = Deno.makeTempDirSync();
  const pkgName = tinyTexPkgName("TinyTeX-1");
  const pkgFilePath = join(workingDir, pkgName);

  // Perform the install either from source or from package

  // Clean up the working Directory
  // Deno.removeSync(workingDir, { recursive: true });

  return Promise.resolve();
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

function postinstall(msgHandler: InstallMsgHandler) {
  // Perform add path and other post install work
  return Promise.resolve();
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
