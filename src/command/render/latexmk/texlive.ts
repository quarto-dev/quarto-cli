/*
 * texlive.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { info } from "log/mod.ts";
import * as ld from "../../../core/lodash.ts";

import { execProcess } from "../../../core/process.ts";
import { kLatexHeaderMessageOptions } from "./types.ts";
import { lines } from "../../../core/text.ts";

const tlmgr = Deno.build.os === "windows"
  ? ["cmd.exe", "/c", "tlmgr"]
  : ["tlmgr"];

// Determines whether TexLive is installed and callable on this system
export async function hasTexLive(): Promise<boolean> {
  try {
    const result = await execProcess({
      cmd: [...tlmgr, "--version"],
      stdout: "piped",
      stderr: "piped",
    });
    return result.code === 0;
  } catch {
    return false;
  }
}

// Searches TexLive remote for packages that match a given search term.
// searchTerms are interpreted as a (Perl) regular expression
export async function findPackages(
  searchTerms: string[],
  opts?: string[],
  quiet?: boolean,
): Promise<string[]> {
  const results: string[] = [];
  const args = ["--file", "--global"];

  for (const searchTerm of searchTerms) {
    if (!quiet) {
      info(
        `finding package for ${searchTerm}`,
        kLatexHeaderMessageOptions,
      );
    }
    // Special case for a known package
    // https://github.com/yihui/tinytex/blob/33cbe601ff671fae47c594250de1d22bbf293b27/R/latex.R#L470
    if (searchTerm === "fandol") {
      results.push("fandol");
    } else {
      const result = await tlmgrCommand(
        "search",
        [...args, ...(opts || []), searchTerm],
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

  return tlmgrCommand("update", (args || []), quiet);
}

// Install packages using TexLive
export async function installPackages(
  pkgs: string[],
  opts?: string[],
  quiet?: boolean,
) {
  if (!quiet) {
    info(
      `> ${pkgs.length} ${
        pkgs.length === 1 ? "package" : "packages"
      } to install`,
      kLatexHeaderMessageOptions,
    );
  }
  let count = 1;
  for (const pkg of pkgs) {
    if (!quiet) {
      info(
        `> installing ${pkg} (${count} of ${pkgs.length})`,
        kLatexHeaderMessageOptions,
      );
    }

    await installPackage(pkg, opts, quiet);
    count = count + 1;
  }
  await addPath();
}

// Add Symlinks for TexLive executables
function addPath(opts?: string[]) {
  // Add symlinks for executables, man pages,
  // and info pages in the system directories
  //
  // This is only required for binary files installed with tlmgr
  // but will not hurt each time a package is installed
  return tlmgrCommand("path", ["add", ...(opts || [])], true);
}

// Remove Symlinks for TexLive executables and commands
export function removePath(opts?: string[], quiet?: boolean) {
  return tlmgrCommand("path", ["remove", ...(opts || [])], quiet);
}

async function installPackage(pkg: string, opts?: string[], quiet?: boolean) {
  // Run the install command
  let installResult = await tlmgrCommand(
    "install",
    [...(opts || []), pkg],
    quiet,
  );

  // Failed to even run tlmgr
  if (installResult.code !== 0 && installResult.code !== 255) {
    return Promise.reject(
      `tlmgr returned a non zero status code\n${installResult.stderr}`,
    );
  }

  // Check whether we should update and retry the install
  const isInstalled = await verifyPackageInstalled(pkg);
  if (!isInstalled) {
    // update tlmgr itself
    const updateResult = await updatePackages(false, true, opts, quiet);
    if (updateResult.code !== 0) {
      return Promise.reject();
    }

    // Rerun the install command
    installResult = await tlmgrCommand(
      "install",
      [...(opts || []), pkg],
      quiet,
    );
  }

  return installResult;
}

export async function removePackage(
  pkg: string,
  opts?: string[],
  quiet?: boolean,
) {
  // Run the install command
  const result = await tlmgrCommand(
    "remove",
    [...(opts || []), pkg],
    quiet,
  );

  // Failed to even run tlmgr
  if (!result.success) {
    return Promise.reject();
  }
  return result;
}

// Removes texlive itself
export async function removeAll(opts?: string[], quiet?: boolean) {
  // remove symlinks
  const result = await tlmgrCommand(
    "remove",
    [...(opts || []), "--all", "--force"],
    quiet,
  );
  // Failed to even run tlmgr
  if (!result.success) {
    return Promise.reject();
  }
  return result;
}

export async function tlVersion() {
  try {
    const result = await tlmgrCommand(
      "--version",
      ["--machine-readable"],
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

// Verifies whether the package has been installed
async function verifyPackageInstalled(
  pkg: string,
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
  );
  return result.stdout?.trim() === pkg;
}

function tlmgrCommand(
  cmd: string,
  args: string[],
  _quiet?: boolean,
) {
  try {
    const result = execProcess(
      {
        cmd: [...tlmgr, cmd, ...args],
        stdout: "piped",
        stderr: "piped",
      },
    );
    return result;
  } catch {
    return Promise.reject();
  }
}
