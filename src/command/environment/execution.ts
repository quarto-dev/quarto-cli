/*
* execution.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { which } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";
import { rBinaryPath } from "../../core/resources.ts";
import { sessionTempFile } from "../../core/temp.ts";

import { pythonBinary } from "../../execute/jupyter/jupyter.ts";
import { EnvironmentData, EnvironmentDataOutputOptions } from "./cmd.ts";

export function pythonEnv(
  name: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name: name,
    path: () => {
      return Promise.resolve(pythonBinary(name));
    },
    version: async () => {
      try {
        const r = await execProcess({
          cmd: [
            pythonBinary(name),
            "--version",
          ],
          stdout: "piped",
          stderr: "piped",
        });
        return r.stdout;
      } catch {
        return undefined;
      }
    },
    options,
  };
}

export function rBinaryEnv(
  name: string,
  cmd: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name,
    path: async () => {
      let path = rBinaryPath(cmd);
      if (path === cmd) {
        path = await which(cmd) ||
          cmd;
      }
      return Promise.resolve(path);
    },
    version: async () => {
      try {
        const res = await execProcess({
          cmd: [rBinaryPath(cmd), "--version"],
          stdout: "piped",
          stderr: "piped",
        });
        return res.stdout || res.stderr;
      } catch {
        return undefined;
      }
    },
    options,
  };
}

export function rPackageEnv(): EnvironmentData {
  return {
    name: "R Packages",
    path: () => {
      return Promise.resolve(undefined);
    },
    version: () => {
      return Promise.resolve(undefined);
    },
    metadata: async () => {
      const runR = async (code: string): Promise<string> => {
        const codePath = sessionTempFile({ suffix: ".R" });
        Deno.writeTextFileSync(
          codePath,
          code,
        );

        const result = await execProcess(
          {
            cmd: [
              rBinaryPath("Rscript"),
              codePath,
            ],
            stdout: "piped",
            stderr: "piped",
          },
        );

        return Promise.resolve(result.stdout || result.stderr || "");
      };

      // Read the required packages
      const requiredRaw = await runR(
        `ap <- available.packages(repos = "http://cran.us.r-project.org")
        packs <- tools::package_dependencies(packages = "quarto", db = ap, recursive = TRUE)
        packs <- paste(packs, collapse=",")
        packs`,
      );

      const pkgRegex = /\\\"([a-zA-Z0-9_.-]*)\\\"/g;
      const matches = requiredRaw.matchAll(pkgRegex);
      const requiredPackages: string[] = [];
      for (const match of matches) {
        requiredPackages.push(match[1]);
      }

      // Read installed packages
      const packagesRaw = await runR(`
        installedPackages <- as.data.frame(installed.packages()[,c(1,3:4)])
        installedPackages <- installedPackages[is.na(installedPackages$Priority),2,drop=FALSE]
        installedPackages`);

      const packages = packagesRaw
        .split("\n").filter((line) => {
          for (
            const pkg of requiredPackages
          ) {
            if (line.startsWith(`${pkg} `)) {
              return true;
            }
          }
          return false;
        })
        .join("\n");
      return Promise.resolve({
        packages: packages,
      });
    },
    options: { newline: true },
  };
}
