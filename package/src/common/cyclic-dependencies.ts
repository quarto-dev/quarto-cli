/*
* cyclic-dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { createHash } from "hash/mod.ts";
import { join } from "path/mod.ts";

import { runCmd } from "../util/cmd.ts";
import { Configuration } from "./config.ts";

export async function cyclicDependencies(
  config: Configuration,
) {
  await DiscoverCyclicDependencies(config);
}

interface Cycle {
  stack: string[];
  count: number;
}

function DiscoverCyclicDependencies(config: Configuration) {
  const text = Deno.readTextFileSync("/Users/charlesteague/Desktop/out.txt");
  if (text) {
    // Read the debug output and create alases for module numbers
    const out = join(config.directoryInfo.pkg, "src", "out.txt");
    const text = Deno.readTextFileSync(out);

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

    const name = (moduleId: string) => {
      const name = moduleMap[moduleId];
      if (name) {
        return name.replaceAll(config.directoryInfo.src, "");
      } else {
        return `?${moduleId}`;
      }
    };

    const dependencyMap: Record<string, string> = {};
    let circularMatch = circularRegex.exec(text);
    while (circularMatch) {
      const baseModule = circularMatch[1];
      const depModule = circularMatch[2];
      dependencyMap[name(baseModule)] = name(depModule);
      circularMatch = circularRegex.exec(text);
    }

    // Read the debug output and find circular imports

    // Create a human readable map of circulars
    const outputObj = {
      modules: moduleMap,
      circulars: dependencyMap,
    };

    Deno.writeTextFileSync(
      "/Users/charlesteague/Desktop/circulars.json",
      JSON.stringify(outputObj, undefined, 2),
    );
  }

  /*
  const deps = await createDependencyList(config);
  info(`Scanning dependencies for ${Object.keys(deps).length} modules.`);

  const dependencyGraph = listToGraph(deps);
  console.log(dependencyGraph);
  const cycles = filterGraph(dependencyGraph);

  
  // Stores the list of discovered cyclic dependencies
  const cycles: Record<string, Cycle> = {};
  const noteCycle = (stack: string[]) => {
    const hash = pathHash(stack);
    let cycle = cycles[hash];
    if (cycle) {
      cycle.count = cycle.count + 1;
    } else {
      cycle = {
        stack,
        count: 1,
      };
    }
    cycles[hash] = cycle;
  };

  // Stores the current module stack and walks
  const currentStack: string[] = [];
  const walk = (path: string) => {
    // See if this path is already in the currentStack.

    const existingIndex = currentStack.findIndex((item) => item === path);

    // If it is, stop looking and return
    if (existingIndex !== -1) {
      noteCycle([...currentStack.slice(existingIndex), path]);
      //throw new Error();
    } else {
      currentStack.push(path);

      const dependencies = deps[path];
      if (dependencies) {
        for (const dependency of dependencies) {
          walk(dependency);
        }
      }
      currentStack.pop();
    }
  };

  const paths = Object.keys(deps);
  const prog = progressBar(paths.length, `Detecting cycles`);
  let count = 0;
  for (const path of paths) {
    // const status = `${Object.keys(cycles).length} cycles`;
    const match = path.match(/.*\/src\/(.*)/);
    const status = match ? match[1] : path;
    try {
      walk(path);
    } catch {
      // console.log(`${currentStack[0]} cycle`);
    } finally {
      currentStack.splice(0, currentStack.length);
      count = count + 1;
      prog.update(count, status);
    }
  }

  const cycleCount = Object.keys(cycles).length;
  const status = cycleCount > 0
    ? `\n${cycleCount} Cyclic Dependencies Detected\nSee 'cycles.json' for details.\n`
    : `\nNo cyclic dependencies detected.\n`;
  prog.complete(status);

  Deno.writeTextFileSync("cycles.json", JSON.stringify(cycles, undefined, 2));
  */
}

// Creates a unique list of imports ([0] importing, [1] imported)
async function createDependencyList(
  config: Configuration,
): Promise<Array<[string, string]>> {
  // Run deno --info on quarto.ts
  const result = await runCmd(
    join(config.directoryInfo.bin, "deno"),
    [
      "info",
      join(config.directoryInfo.src, "quarto.ts"),
      "--json",
      "--unstable",
    ],
  );

  // Capture its output and parse it
  const depTxt = result.stdout;
  const json = JSON.parse(depTxt || "");

  // Generate a set of modules and dependencies
  const dependencySet = new Set<string>();
  const separator = ",";

  let count = 0;
  for (const mod of json["modules"]) {
    // Filter non-file dependencies (e.g. from the import map)
    if (
      mod.specifier && mod.specifier.startsWith("file:")
    ) {
      const importingPath = mod.specifier;
      mod.dependencies.forEach((element: { code: string }) => {
        if (element.code && element.code.startsWith("file:")) {
          const exportingPath = element.code;
          const dependency = [importingPath, exportingPath].join(separator);
          dependencySet.add(dependency);
        }
      });
      count = count + 1;
      if (count >= 105) {
        break;
      }
    }
  }

  const uniqueImports = Array.from(dependencySet.values());
  return uniqueImports.map((imp) => imp.split(separator)) as Array<
    [string, string]
  >;
}

function listToGraph(items: Array<[string, string]>) {
  return items.reduce((graph, [sourceNode, targetNode]) => {
    graph[sourceNode] = graph[sourceNode] || new Set();
    graph[sourceNode].add(targetNode);

    return graph;
  }, {} as Record<string, Set<string>>);
}

function filterGraph(graph: Record<string, Set<string>>) {
  const without = (firstSet: Set<string>, secondSet: Set<string>) => (
    new Set(Array.from(firstSet).filter((it) => !secondSet.has(it)))
  );

  const mergeSets = (sets: Array<Set<string>>) => {
    const sumSet = new Set<string>();
    sets.forEach((set) => {
      Array.from(set.values()).forEach((value) => {
        sumSet.add(value);
      });
    });
    return sumSet;
  };

  const stripTerminalNodes = (graph: Record<string, Set<string>>) => {
    const allSources = new Set(Object.keys(graph));
    const allTargets = mergeSets(Object.values(graph));

    const terminalSources = without(allSources, allTargets);
    const terminalTargets = without(allTargets, allSources);

    const newGraph = Object.entries(graph).reduce(
      (smallerGraph, [source, targets]) => {
        if (!terminalSources.has(source)) {
          const nonTerminalTargets = without(targets, terminalTargets);

          if (nonTerminalTargets.size > 0) {
            smallerGraph[source] = nonTerminalTargets;
          }
        }

        return smallerGraph;
      },
      {} as Record<string, Set<string>>,
    );

    return newGraph;
  };

  const calculateGraphSize = (graph: Record<string, Set<string>>) =>
    mergeSets(Object.values(graph)).size;

  const miminizeGraph = (graph: Record<string, Set<string>>) => {
    const smallerGraph = stripTerminalNodes(graph);
    if (calculateGraphSize(smallerGraph) < calculateGraphSize(graph)) {
      miminizeGraph(smallerGraph);
    }
    return smallerGraph;
  };

  return miminizeGraph(graph);
}

function pathHash(paths: string[]) {
  return createHash("md5").update(paths.join(" ")).toString();
}
