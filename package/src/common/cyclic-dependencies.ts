/*
* cyclic-dependencies.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { basename, isAbsolute, join } from "../../../src/deno_ral/path.ts";
import { Command } from "cliffy/command/mod.ts";

import { runCmd } from "../util/cmd.ts";
import { Configuration, readConfiguration } from "./config.ts";
import { error, info } from "../../../src/deno_ral/log.ts";
import { progressBar } from "../../../src/core/console.ts";
import { md5Hash } from "../../../src/core/hash.ts";

export function cycleDependenciesCommand() {
  return new Command()
    .name("cycle-dependencies")
    .description(
      "Debugging tool for helping discover cyclic dependencies in quarto",
    )
    .option(
      "-o, --output",
      "Path to write json output",
    )
    // deno-lint-ignore no-explicit-any
    .action(async (args: Record<string, any>) => {
      const configuration = readConfiguration();
      info("Using configuration:");
      info(configuration);
      info("");
      await cyclicDependencies(args.output as string, configuration);
    });
}

export function parseSwcLogCommand() {
  return new Command()
    .name("parse-swc-log")
    .description(
      "Parses SWC bundler debug log to discover cyclic dependencies in quarto",
    )
    .option(
      "-i, --input",
      "Path to text file containing swc bundler debug output",
    )
    .option(
      "-o, --output",
      "Path to write json output",
    )
    // deno-lint-ignore no-explicit-any
    .action((args: Record<string, any>) => {
      const configuration = readConfiguration();
      info("Using configuration:");
      info(configuration);
      info("");
      parseSwcBundlerLog(args.input, args.output, configuration);
    });
}

export async function cyclicDependencies(
  out: string,
  config: Configuration,
) {
  const modules = await loadModules(config);
  findCyclicDependencies(modules, out, config);
}

// Parses the debug output from the SWC bundler
// (enable --log-level debug when call deno bundle to emit this and redirect stderr/stdout to a file)
// Will create a table of module id and path as well as any circular dependencies
// that SWC complains about
function parseSwcBundlerLog(
  log: string,
  out: string,
  config: Configuration,
) {
  // TODO: This should accept a log output file from the swc bundler
  // and a target results file (rather than being hard coded)

  // TODO: Consider just outputting this after prepare-dist

  // Read the debug output and create alases for module numbers
  const logPath = isAbsolute(log) ? log : join(Deno.cwd(), log);
  const outPath = isAbsolute(out) ? out : join(Deno.cwd(), out);

  const text = Deno.readTextFileSync(logPath);
  if (text) {
    const moduleRegex = /\(ModuleId\(([0-9]+)\)\) <.+:\/\/(.*)>/gm;
    const circularRegex =
      /DEBUG RS - swc_bundler::bundler::chunk.*Circular dep:*.ModuleId\(([0-9]+)\) => ModuleId\(([0-9]+)\)/gm;

    // Parse the modules and create a map
    const moduleMap: Record<string, string> = {};
    moduleRegex.lastIndex = 0;
    let match = moduleRegex.exec(text);
    while (match) {
      const moduleId = match[1];
      const moduleFile = match[2];
      moduleMap[moduleId] = moduleFile;
      match = moduleRegex.exec(text);
    }

    // Function to make a pretty name for this module
    const name = (moduleId: string) => {
      const name = moduleMap[moduleId];
      if (name) {
        return name.replaceAll(config.directoryInfo.src, "");
      } else {
        return `?${moduleId}`;
      }
    };

    // Find any circular reference complains and read the modules, use the map
    // to find the names of the circularlities, and then add to the cycle map
    const cycleMap: Record<string, string> = {};
    let circularMatch = circularRegex.exec(text);
    while (circularMatch) {
      // Add this match to the circular list
      const baseModule = circularMatch[1];
      const depModule = circularMatch[2];
      cycleMap[name(baseModule)] = name(depModule);

      // Search again
      circularMatch = circularRegex.exec(text);
    }

    // Create a human readable map of circulars
    const outputObj = {
      modules: moduleMap,
      circulars: cycleMap,
    };

    // Write the output
    Deno.writeTextFileSync(
      outPath,
      JSON.stringify(outputObj, undefined, 2),
    );
    info("Log written to: " + outPath);
  }
}
async function loadModules(config: Configuration) {
  info("Reading modules");
  const denoExecPath = Deno.env.get("QUARTO_DENO")
  if (! denoExecPath) {
    throw Error("QUARTO_DENO is not defined");
  }
  const result = await runCmd(
    denoExecPath,
    [
      "info",
      join(config.directoryInfo.src, "quarto.ts"),
      "--json",
      "--unstable",
    ],
  );

  const rawOutput = result.stdout;
  const jsonOutput = JSON.parse(rawOutput || "");

  // module path, array of import paths
  const modules: Record<string, string[]> = {};
  for (const mod of jsonOutput["modules"]) {
    modules[mod.specifier] = mod.dependencies.map((dep: { code: string }) => {
      return dep.code;
    }).filter((p: unknown) => p !== undefined);
  }

  return modules;
}

// Holds a detected cycle (with a handful of stacks / sample stacks)
interface Cycle {
  cycle: [string, string];
  stacks: [string[]];
}

function findCyclicDependencies(
  modules: Record<string, string[]>,
  out: string,
  _config: Configuration,
) {
  const outPath = isAbsolute(out) ? out : join(Deno.cwd(), out);

  const cycles: Record<string, Cycle> = {};

  // creates a hash for a set of paths (a cycle)
  const hash = (paths: string[]) => {
    const string = paths.join(" ");
    return md5Hash(string);
  };

  // The current import stack
  const stack: string[] = [];

  const walkImports = (path: string, modules: Record<string, string[]>) => {
    // See if this path is already in the stack.
    const existingIndex = stack.findIndex((item) => item === path);
    // If it is, stop looking and return
    if (existingIndex !== -1) {
      // Log the cycle
      const substack = [...stack.slice(existingIndex), path];
      const key = [stack[existingIndex], substack[substack.length - 1]];
      const currentCycle = cycles[hash(key)] || { cycle: key, stacks: [] };
      // Add the first 5 example stacks
      if (currentCycle.stacks.length < 5) {
        currentCycle.stacks.push(substack);
      }
      cycles[hash(key)] = currentCycle;
    } else {
      stack.push(path);
      const dependencies = modules[path];
      if (dependencies) {
        for (const dependency of dependencies) {
          walkImports(dependency, modules);
        }
      }
      stack.pop();
    }
  };

  const paths = Object.keys(modules);
  const prog = progressBar(paths.length, `Detecting cycles`);
  let count = 0;
  for (const path of paths) {
    if (path.endsWith("quarto.ts")) {
      continue;
    }
    const status = `scanning ${basename(path)} | total of ${
      Object.keys(cycles).length
    } cycles`;
    prog.update(count, status);
    try {
      walkImports(path, modules);
    } catch (er) {
      error(er);
    } finally {
      stack.splice(0, stack.length);
    }

    count = count + 1;

    if (Object.keys(cycles).length > 100) {
      break;
    }
  }
  prog.complete();

  Deno.writeTextFileSync(outPath, JSON.stringify(cycles, undefined, 2));
  info("Log written to: " + outPath);
}
