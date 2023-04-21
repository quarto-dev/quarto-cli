/*
 * kernels.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, join } from "path/mod.ts";
import { existsSync, walkSync } from "fs/mod.ts";

import { debug } from "log/mod.ts";

import { execProcess } from "../process.ts";
import { jupyterExec } from "./exec.ts";
import { JupyterKernelspec } from "./types.ts";

// deno-lint-ignore no-explicit-any
export function isJupyterKernelspec(x: any): x is JupyterKernelspec {
  if (x && typeof (x) === "object") {
    return typeof (x.name) === "string" &&
      typeof (x.language) === "string" &&
      typeof (x.display_name) === "string";
  } else {
    return false;
  }
}

export async function jupyterKernelspecForLanguage(
  language: string,
): Promise<JupyterKernelspec | undefined> {
  const kernelspecs = await jupyterKernelspecs();
  for (const kernelspec of kernelspecs.values()) {
    if (kernelspec.language === language) {
      return kernelspec;
    }
  }
}

export async function jupyterKernelspec(
  name: string,
): Promise<JupyterKernelspec | undefined> {
  const kernelspecs = await jupyterKernelspecs();
  return kernelspecs.get(name);
}

let kJupyterKernelspecs: Map<string, JupyterKernelspec> | undefined = undefined;
export async function jupyterKernelspecs(): Promise<
  Map<string, JupyterKernelspec>
> {
  if (kJupyterKernelspecs) {
    return kJupyterKernelspecs;
  }
  kJupyterKernelspecs = await computeJupyterKernelspecs();
  return kJupyterKernelspecs;
}

async function computeJupyterKernelspecs(): Promise<
  Map<string, JupyterKernelspec>
> {
  try {
    const result = await execProcess(
      {
        cmd: [...(await jupyterExec()), "--paths", "--json"],
        stdout: "piped",
        stderr: "piped",
      },
    );
    if (result.success) {
      const kernelmap = new Map<string, JupyterKernelspec>();
      const dataPaths = JSON.parse(result.stdout!).data;
      for (const path of dataPaths) {
        if (!existsSync(path)) {
          continue;
        }
        const kernels = join(path, "kernels");

        if (!existsSync(kernels)) {
          continue;
        }
        for (const walk of walkSync(kernels, { maxDepth: 1 })) {
          if (walk.path === kernels || !walk.isDirectory) {
            continue;
          }
          const kernelConfig = join(walk.path, "kernel.json");
          if (existsSync(kernelConfig)) {
            const config = JSON.parse(Deno.readTextFileSync(kernelConfig));
            const name = basename(walk.path);
            kernelmap.set(name, {
              name,
              language: config.language,
              display_name: config.display_name,
            });
          }
        }
      }
      if (kernelmap.size > 0) {
        return kernelmap;
      } else {
        return kDefaultKernelspecs;
      }
    } else {
      return kDefaultKernelspecs;
    }
  } catch (e) {
    debug("Error reading kernelspecs: " + e.message);
    return kDefaultKernelspecs;
  }
}

export function jupyterDefaultPythonKernelspec(): JupyterKernelspec {
  return {
    "display_name": "Python 3",
    "language": "python",
    "name": "python3",
  };
}

// default kernelspecs for when we can't talk to to jupyter
const kDefaultKernelspecs = new Map<string, JupyterKernelspec>();
kDefaultKernelspecs.set("python3", jupyterDefaultPythonKernelspec());
