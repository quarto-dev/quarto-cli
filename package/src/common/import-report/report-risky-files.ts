import { resolve, toFileUrl } from "https://deno.land/std/"../../../../src/deno_ral/path.ts"";
import {
  DependencyGraph,
  Edge,
  getDenoInfo,
  graphTranspose,
  moduleGraph,
  reachability,
} from "./deno-info.ts";

import { longestCommonDirPrefix } from "./utils.ts";

function filesInCycles(
  graph: DependencyGraph,
): string[] {
  const nodesInCycles: string[] = [];

  const transpose = graphTranspose(graph);
  const visited: Set<string> = new Set();

  for (const source of Object.keys(graph)) {
    const deps = reachability(graph, source);
    if (!deps[source]) {
      continue;
    }
    const inner = (node: string) => {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      for (const pred of transpose[node]) {
        if (deps[pred].has(source) || pred === source) {
          if (nodesInCycles.indexOf(node) === -1) {
            nodesInCycles.push(node);
          }
          inner(pred);
        }
      }
    };
    inner(source);
  }
  return nodesInCycles;
}

if (import.meta.main) {
  if (Deno.args.length === 0) {
    console.log(
      `report-dangerous-files.ts

Usage:
  $ quarto run report-dangerous-files.ts`,
    );
    Deno.exit(1);
  }
  const json = await getDenoInfo(Deno.args[0]);
  const { graph } = moduleGraph(json);

  const rawCycleFiles = filesInCycles(graph);

  const cmd = ["rg", "-l", "export const"];
  const p = Deno.run({ cmd, stdout: "piped", stderr: "piped" });
  const { code } = await p.status();
  if (code !== 0) {
    Deno.exit(code);
  }

  // heuristically remove string path prefixes
  const cycleFiles = rawCycleFiles.map((s) =>
    s.slice(rawCycleFiles[0].indexOf("/src/") + 5)
  );

  const exportFiles = new Set(
    (new TextDecoder().decode(await p.output())).trim()
      .split("\n"),
  );

  const result = cycleFiles.filter((s) => exportFiles.has(s));
  result.sort((a, b) => a.localeCompare(b));
  for (const r of result) {
    console.log(r);
  }
}
