import { resolve, toFileUrl } from "../../../../src/deno_ral/path.ts";
import {
  DependencyGraph,
  Edge,
  getDenoInfo,
  graphTranspose,
  moduleGraph,
  reachability,
} from "./deno-info.ts";

import { longestCommonDirPrefix } from "./utils.ts";

function dropTypesFiles(edges: Edge[])
{
  return edges.filter(({
    "from": edgeFrom,
    to,
  }) => !(to.endsWith("types.ts") || edgeFrom.endsWith("types.ts")));
}

function trimCommonPrefix(edges: Edge[])
{
  // https://stackoverflow.com/a/68702966
  const strs: Set<string> = new Set();
  for (const { "from": edgeFrom, to } of edges) {
    strs.add(edgeFrom);
    strs.add(to);
  }
  const p = longestCommonDirPrefix(Array.from(strs)).length;
  return edges.map(({ "from": edgeFrom, to }) => ({
    "from": edgeFrom.slice(p),
    to: to.slice(p),
  }));
}

function simplify(
  edges: Edge[],
  prefixes: string[],
): Edge[]
{
  edges = trimCommonPrefix(edges);

  const result: Edge[] = [];
  const keepPrefix = (s: string) => {
    for (const prefix of prefixes) {
      if (s.startsWith(prefix)) {
        return prefix + "...";
      }
    }
    return s;
  }
  const edgeSet = new Set<string>();
  for (const edge of edges) {
    const from = keepPrefix(edge.from);
    const to = keepPrefix(edge.to);
    if (from === to) {
      continue;
    }
    const key = `${from} -> ${to}`;
    if (edgeSet.has(key)) {
      continue;
    }
    edgeSet.add(key);
    result.push({ from, to });
  }
  return result;
}

function explain(
  graph: DependencyGraph,
): Edge[] {
  const result: Edge[] = [];
  const transpose = graphTranspose(graph);
  const visited: Set<string> = new Set();
  let found = false;
  let count = 0;

  const deps = reachability(graph);

  for (const source of Object.keys(graph)) {
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
    qmdOut.push(`  ${ix} [ label = "${name}", shape = "none" ];`);
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

  let args = Array.from(Deno.args);

  let result = explain(graph);
  if (args[1] === "--simplify") {
    args.splice(1, 1);
    const prefixes = [];
    while (!args[1].startsWith("--")) {
      prefixes.push(args[1]);
      args.splice(1, 1);
    }
    result = simplify(result, prefixes);
  }

  result = dropTypesFiles(result);

  if (args[1] === "--graph") {
    Deno.writeTextFileSync(
      args[2] ?? "graph.dot",
      generateGraph(result),
    );
  } else {
    await buildOutput(result);
  }
}
