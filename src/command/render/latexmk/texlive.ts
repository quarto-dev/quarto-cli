/*
 * texlive.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import * as ld from "../../../core/lodash.ts";

import { execProcess } from "../../../core/process.ts";
import { lines } from "../../../core/text.ts";
import { requireQuoting, safeWindowsExec } from "../../../core/windows.ts";
import { hasTinyTex, tinyTexBinDir } from "../../../tools/impl/tinytex-info.ts";
import { join } from "path/mod.ts";
import { logProgress } from "../../../core/log.ts";

export interface TexLiveContext {
  preferTinyTex: boolean;
  hasTinyTex: boolean;
  hasTexLive: boolean;
  usingGlobal: boolean;
  binDir?: string;
}

export async function texLiveContext(
  preferTinyTex: boolean,
): Promise<TexLiveContext> {
  const hasTiny = hasTinyTex();
  const hasTex = await hasTexLive();
  const binDir = tinyTexBinDir();
  const usingGlobal = await texLiveInPath() && !hasTiny;
  return {
    preferTinyTex,
    hasTinyTex: hasTiny,
    hasTexLive: hasTex,
    usingGlobal,
    binDir,
  };
}

function systemTexLiveContext(): TexLiveContext {
  return {
    preferTinyTex: false,
    hasTinyTex: false,
    hasTexLive: false,
    usingGlobal: true,
  };
}

// Determines whether TexLive is installed and callable on this system
export async function hasTexLive(): Promise<boolean> {
  if (hasTinyTex()) {
    return true;
  } else {
    if (await texLiveInPath()) {
      return true;
    } else {
      return false;
    }
  }
}

export async function texLiveInPath(): Promise<boolean> {
  try {
    const systemContext = systemTexLiveContext();
    const result = await tlmgrCommand("--version", [], systemContext);
    return result.code === 0;
  } catch {
    return false;
  }
}

// Searches TexLive remote for packages that match a given search term.
// searchTerms are interpreted as a (Perl) regular expression
export async function findPackages(
  searchTerms: string[],
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
): Promise<string[]> {
  const results: string[] = [];
  const args = ["--file", "--global"];

  for (const searchTerm of searchTerms) {
    if (!quiet) {
      logProgress(
        `finding package for ${searchTerm}`,
      );
    }
    // Special case for a known package
    // https://github.com/rstudio/tinytex/blob/33cbe601ff671fae47c594250de1d22bbf293b27/R/latex.R#L470
    if (searchTerm === "fandol") {
      results.push("fandol");
    } else {
      const result = await tlmgrCommand(
        "search",
        [...args, ...(opts || []), searchTerm],
        context,
        true,
      );

      if (result.code === 0 && result.stdout) {
        const text = result.stdout;

        // Regexes for reading packages and search matches
        const packageNameRegex = /^(.+)\:$/;
        const searchTermRegex = new RegExp(`\/${searchTerm}$`);

        // Inspect each line- if it is a package name, collect it and begin
        // looking at each line to see if they end with the search term
        // When we find a line matching the search term, put the package name
        // into the results and continue
        let currentPackage: string | undefined = undefined;
        lines(text).forEach((line) => {
          const packageMatch = line.match(packageNameRegex);
          if (packageMatch) {
            const packageName = packageMatch[1];
            // If the packagename contains a dot, the prefix is the package name
            // the portion after the dot is the architecture
            if (packageName.includes(".")) {
              currentPackage = packageName.split(".")[0];
            } else {
              currentPackage = packageName;
            }
          } else {
            // We are in the context of a package, look at the line and
            // if it ends with /<searchterm>, this package is a good match
            if (currentPackage) {
              const searchTermMatch = line.match(searchTermRegex);
              if (searchTermMatch) {
                results.push(currentPackage);
                currentPackage = undefined;
              }
            }
          }
        });
      } else {
        const errorMessage = tlMgrError(result.stderr);
        if (errorMessage) {
          throw new Error(errorMessage);
        }
      }
    }
  }
  return ld.uniq(results);
}

// Update TexLive.
// all = update installed packages
// self = update TexLive (tlmgr) itself
export function updatePackages(
  all: boolean,
  self: boolean,
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
) {
  const args = [];
  // Add any tlmg args
  if (opts) {
    args.push(...opts);
  }

  if (all) {
    args.push("--all");
  }

  if (self) {
    args.push("--self");
  }

  return tlmgrCommand("update", args || [], context, quiet);
}

// Install packages using TexLive
export async function installPackages(
  pkgs: string[],
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
) {
  if (!quiet) {
    logProgress(
      `> ${pkgs.length} ${
        pkgs.length === 1 ? "package" : "packages"
      } to install`,
    );
  }
  let count = 1;
  for (const pkg of pkgs) {
    if (!quiet) {
      logProgress(
        `> installing ${pkg} (${count} of ${pkgs.length})`,
      );
    }

    await installPackage(pkg, context, opts, quiet);
    count = count + 1;
  }
  if (context.usingGlobal) {
    await addPath(context);
  }
}

// Add Symlinks for TexLive executables
function addPath(context: TexLiveContext, opts?: string[]) {
  // Add symlinks for executables, man pages,
  // and info pages in the system directories
  //
  // This is only required for binary files installed with tlmgr
  // but will not hurt each time a package is installed
  return tlmgrCommand("path", ["add", ...(opts || [])], context, true);
}

// Remove Symlinks for TexLive executables and commands
export function removePath(
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
) {
  return tlmgrCommand("path", ["remove", ...(opts || [])], context, quiet);
}

async function installPackage(
  pkg: string,
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
) {
  // if any packages have been installed already, update packages first
  let isInstalled = await verifyPackageInstalled(pkg, context);
  if (isInstalled) {
    // update tlmgr itself
    const updateResult = await updatePackages(
      true,
      true,
      context,
      opts,
      quiet,
    );
    if (updateResult.code !== 0) {
      return Promise.reject();
    }
  }

  // Run the install command
  let installResult = await tlmgrCommand(
    "install",
    [...(opts || []), pkg],
    context,
    quiet,
  );

  // Failed to even run tlmgr
  if (installResult.code !== 0 && installResult.code !== 255) {
    return Promise.reject(
      `tlmgr returned a non zero status code\n${installResult.stderr}`,
    );
  }

  // Check whether we should update again and retry the install
  isInstalled = await verifyPackageInstalled(pkg, context);
  if (!isInstalled) {
    // update tlmgr itself
    const updateResult = await updatePackages(
      false,
      true,
      context,
      opts,
      quiet,
    );
    if (updateResult.code !== 0) {
      return Promise.reject();
    }

    // Rerun the install command
    installResult = await tlmgrCommand(
      "install",
      [...(opts || []), pkg],
      context,
      quiet,
    );
  }

  return installResult;
}

export async function removePackage(
  pkg: string,
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
) {
  // Run the install command
  const result = await tlmgrCommand(
    "remove",
    [...(opts || []), pkg],
    context,
    quiet,
  );

  // Failed to even run tlmgr
  if (!result.success) {
    return Promise.reject();
  }
  return result;
}

// Removes texlive itself
export async function removeAll(
  context: TexLiveContext,
  opts?: string[],
  quiet?: boolean,
) {
  // remove symlinks
  const result = await tlmgrCommand(
    "remove",
    [...(opts || []), "--all", "--force"],
    context,
    quiet,
  );
  // Failed to even run tlmgr
  if (!result.success) {
    return Promise.reject();
  }
  return result;
}

export async function tlVersion(context: TexLiveContext) {
  try {
    const result = await tlmgrCommand(
      "--version",
      ["--machine-readable"],
      context,
      true,
    );

    if (result.success) {
      const versionStr = result.stdout;
      const match = versionStr && versionStr.match(/tlversion (\d*)/);
      if (match) {
        return match[1];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}

export type TexLiveCmd = {
  cmd: string;
  fullPath: string;
};

export function texLiveCmd(cmd: string, context: TexLiveContext): TexLiveCmd {
  if (context.preferTinyTex && context.hasTinyTex) {
    if (context.binDir) {
      return {
        cmd,
        fullPath: join(context.binDir, cmd),
      };
    } else {
      return { cmd, fullPath: cmd };
    }
  } else {
    return { cmd, fullPath: cmd };
  }
}

function tlMgrError(msg?: string) {
  if (msg && msg.indexOf("is older than remote repository") > -1) {
    const message =
      `Your TexLive version is not updated enough to connect to the remote repository and download packages. Please update your installation of TexLive or TinyTex.\n\nUnderlying message:`;
    return `${message} ${msg.replace("\ntlmgr: ", "")}`;
  } else {
    return undefined;
  }
}

// Verifies whether the package has been installed
async function verifyPackageInstalled(
  pkg: string,
  context: TexLiveContext,
  opts?: string[],
): Promise<boolean> {
  const result = await tlmgrCommand(
    "info",
    [
      "--list",
      "--only-installed",
      "--data",
      "name",
      ...(opts || []),
      pkg,
    ],
    context,
  );
  return result.stdout?.trim() === pkg;
}

// Execute correctly tlmgr <cmd> <args>
function tlmgrCommand(
  tlmgrCmd: string,
  args: string[],
  context: TexLiveContext,
  _quiet?: boolean,
) {
  const execTlmgr = (tlmgrCmd: string[]) => {
    return execProcess(
      {
        cmd: tlmgrCmd,
        stdout: "piped",
        stderr: "piped",
      },
    );
  };

  // If TinyTex is here, prefer that
  const tlmgr = texLiveCmd("tlmgr", context);

  // On windows, we always want to call tlmgr through the 'safe'
  // cmd /c approach since it is a bat file
  if (Deno.build.os === "windows") {
    const quoted = requireQuoting(args);
    return safeWindowsExec(
      tlmgr.fullPath,
      [tlmgrCmd, ...quoted.args],
      execTlmgr,
    );
  } else {
    return execTlmgr([tlmgr.fullPath, tlmgrCmd, ...args]);
  }
}
