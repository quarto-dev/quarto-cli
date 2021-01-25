/*
 * texlive.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { ld } from "lodash/mod.ts";

import { message } from "../../../core/console.ts";
import { execProcess } from "../../../core/process.ts";

// Determines whether TexLive is installed and callable on this system
export async function hasTexLive(): Promise<boolean> {
  try {
    execProcess({
      cmd: ["tlmgr", "--version"],
      stdout: "piped",
      stderr: "piped",
    });
    return true;
  } catch (e) {
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
      message(`Finding package for ${searchTerm}`, { bold: true });
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
        const lines = text.split(/\r?\n/);

        // Inspect each line- if it is a package name, collect it and begin
        // looking at each line to see if they end with the search term
        // When we find a line matching the search term, put the package name
        // into the results and continue
        let currentPackage: string | undefined = undefined;
        lines.forEach((line) => {
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
export async function updatePackages(
  all: boolean,
  self: boolean,
  opts?: string[],
  quiet?: boolean,
) {
  const args = ["update"];
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

  return tlmgrCommand("update", (opts || []), quiet);
}

// Install packages using TexLive
export async function installPackages(
  pkgs: string[],
  opts?: string[],
  quiet?: boolean,
) {
  if (!quiet) {
    message(
      `Installing ${pkgs.length} ${pkgs.length === 1 ? "package" : "packages"}`,
      { bold: true },
    );
  }
  let count = 1;
  for (const pkg of pkgs) {
    if (!quiet) {
      message(`Installing ${pkg} (${count} of ${pkgs.length})`, { bold: true });
    }

    await installPackage(pkg, opts, quiet);
    count = count + 1;
  }
  addPath();
}

// Add Symlinks for TexLive executables
async function addPath(opts?: string[]) {
  // Add symlinks for executables, man pages,
  // and info pages in the system directories
  //
  // This is only required for binary files installed with tlmgr
  // but will not hurt each time a package is installed
  return tlmgrCommand("path", ["add", ...(opts || [])], true);
}

async function installPackage(pkg: string, opts?: string[], quiet?: boolean) {
  // Run the install command
  let installResult = await tlmgrCommand(
    "install",
    [...(opts || []), pkg],
    quiet,
  );

  // Failed to even run tlmgr
  if (installResult.code !== 0) {
    return Promise.reject();
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
  quiet?: boolean,
  stdout?: (stdout: Uint8Array) => void,
) {
  return execProcess(
    {
      cmd: ["tlmgr", cmd, ...args],
      stdout: "piped",
      stderr: quiet ? "piped" : undefined,
    },
    undefined,
    (data: Uint8Array) => {
      if (!quiet) {
        Deno.stderr.writeSync(data);
      }

      if (stdout) {
        stdout(data);
      }
    },
  );
}
