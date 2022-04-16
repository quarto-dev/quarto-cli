import { resolve, toFileUrl } from "https://deno.land/std/path/mod.ts";
import {
  DependencyGraph,
  Edge,
  getDenoInfo,
  graphTranspose,
  moduleGraph,
  reachability,
} from "./deno-info.ts";

import { longestCommonDirPrefix } from "./utils.ts";

function explain(
  graph: DependencyGraph,
): Edge[] {
  const result: Edge[] = [];
  const transpose = graphTranspose(graph);
  const visited: Set<string> = new Set();
  let found = false;

  for (const source of Object.keys(graph)) {
    const deps = reachability(graph, source);
    if (!deps[source]) {
      continue;
    }
    found = true;
    const inner = (node: string) => {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      for (const pred of transpose[node]) {
        if (deps[pred].has(source) || pred === source) {
          result.push({ "from": pred, "to": node });
          inner(pred);
        }
      }
    };
    inner(source);
  }
  if (!found) {
    console.error(`graph does not have cyclic imports`);
    Deno.exit(1);
  }
  return result;
}

function generateGraph(edges: Edge[]): string {
  // https://stackoverflow.com/a/68702966
  const strs: Set<string> = new Set();
  for (const { "from": edgeFrom, to } of edges) {
    strs.add(edgeFrom);
    strs.add(to);
  }
  const p = longestCommonDirPrefix(Array.from(strs)).length;

  const qmdOut: string[] = [];
  qmdOut.push("digraph G {");
  const m: Record<string, number> = {};
  let ix = 1;
  for (const { "from": edgeFrom, to } of edges) {
    if (m[edgeFrom] === undefined) {
      m[edgeFrom] = ix++;
    }
    if (m[to] === undefined) {
      m[to] = ix++;
    }
    qmdOut.push(`  ${m[edgeFrom]} -> ${m[to]};`);
  }
  for (const [name, ix] of Object.entries(m)) {
    qmdOut.push(`  ${ix} [ label = "${name.slice(p)}", shape = "none" ];`);
  }
  qmdOut.push("}\n");
  return qmdOut.join("");
}

async function buildOutput(edges: Edge[]) {
  const qmdOut: string[] = [`---
title: explain.ts
format: html
---
`];
  qmdOut.push(
    "This graph shows all cyclic import chains.\n\n",
  );
  qmdOut.push("```{ojs}\n//| echo: false\n\ndot`");
  qmdOut.push(generateGraph(edges));
  qmdOut.push("`\n");
  qmdOut.push("```\n");

  const filename = await Deno.makeTempFile({ suffix: ".qmd" });
  Deno.writeTextFileSync(filename, qmdOut.join("\n"));

  const process = Deno.run({
    cmd: ["quarto", "preview", filename],
  });
  await process.status();

  Deno.remove(filename);
}

if (import.meta.main) {
  if (Deno.args.length === 0) {
    console.log(
      `explain-all-cycles.ts: generate a graph visualization of cyclic imports
between all files reachable from some source file.

Usage:
  $ quarto run explain-all-cycles.ts <entry-point.ts> 

Examples:

  From ./src:

  $ quarto run quarto.ts

If the second parameter is "--graph", then this program outputs the .dot specification to the file given by the third parameter, rather opening a full report.
`,
    );
    Deno.exit(1);
  }
  const json = await getDenoInfo(Deno.args[0]);
  const { graph } = moduleGraph(json);

  const result = explain(graph);
  if (Deno.args[1] === "--graph") {
    Deno.writeTextFileSync(
      Deno.args[2],
      generateGraph(result),
    );
  } else {
    await buildOutput(result);
  }
}
