import { resolve, toFileUrl } from "https://deno.land/std@0.122.0/path/mod.ts";

// https://stackoverflow.com/a/68702966
const longestCommonPrefix = (strs: string[]) => {
  let prefix = strs.reduce((acc, str) => str.length < acc.length ? str : acc);

  for (const str of strs) {
    while (str.slice(0, prefix.length) != prefix) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
};

interface DenoInfoDependency {
  specifier: string;
  code: {
    // apparently, if specifier exists, error doesn't and vice-versa.
    error?: string;
    specifier?: string;
    span: {
      start: number;
      end: number;
    };
  };
}

interface DenoInfoModule {
  dependencies: DenoInfoDependency[];
  local: string;
  emit: string;
  map: unknown;
  mediaType: string;
  size: number;
  specifier: string;
}

interface DenoInfoJSON {
  roots: string[];
  modules: DenoInfoModule[];
}

type DependencyGraph = Record<string, string[]>;

interface ResolutionError {
  "from": string;
  to: string; // this is the _unresolved_ specifier
  message: string;
}

function moduleGraph(info: DenoInfoJSON): {
  graph: DependencyGraph;
  errors: ResolutionError[];
} {
  const graph: DependencyGraph = {};
  const errors: ResolutionError[] = [];

  const { modules } = info;
  for (const { specifier: depFrom, dependencies } of modules) {
    const edges: string[] = [];
    for (const { specifier: to, code } of dependencies || []) {
      const {
        error,
        specifier: depTo,
      } = code;
      if (depTo !== undefined) {
        edges.push(depTo);
      } else {
        errors.push({
          message: error!,
          "from": depFrom,
          to,
        });
      }
    }
    graph[depFrom] = edges;
  }

  return { graph, errors };
}

function graphTranspose(graph: DependencyGraph): DependencyGraph {
  const result: DependencyGraph = {};
  for (const node of Object.keys(graph)) {
    result[node] = [];
  }
  for (const [nodeFrom, children] of Object.entries(graph)) {
    for (const nodeTo of children) {
      result[nodeTo].push(nodeFrom);
    }
  }
  return result;
}

function reachability(
  graph: DependencyGraph,
  source: string,
): Record<string, Set<string>> {
  const result: Record<string, Set<string>> = Object.fromEntries(
    Object.keys(graph).map((k) => [k, new Set()]),
  );

  let changed = false;
  const graphNodes = Object.keys(graph);
  do {
    changed = false;
    for (const node of graphNodes) {
      for (const child of graph[node]) {
        for (const nodeDep of result[node]) {
          changed = changed || !(result[child].has(nodeDep));
          result[child].add(nodeDep);
        }
        changed = changed || !(result[child].has(node));
        result[child].add(node);
      }
    }
  } while (changed);
  return result;
}

interface Edge {
  "from": string;
  to: string;
}

function explain(
  graph: DependencyGraph,
  source: string,
  target: string,
): Edge[] {
  const result: Edge[] = [];
  const deps = reachability(graph, source);
  if (!deps[target]) {
    const [ss, st] = [source, target].map((s) =>
      s.slice(longestCommonPrefix([source, target]).length)
    );
    console.error(`${ss} does not depend on ${st}`);
    Deno.exit(1);
  }
  if (!deps[target].has(source)) {
    return result;
  }
  const transpose = graphTranspose(graph);
  const visited: Set<string> = new Set();
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
  inner(target);
  return result;
}

async function buildOutput(edges: Edge[], source: string, target: string) {
  const strs: Set<string> = new Set();
  for (const { "from": edgeFrom, to } of edges) {
    strs.add(edgeFrom);
    strs.add(to);
  }
  const p = longestCommonPrefix(Array.from(strs)).length;

  const qmdOut: string[] = [`---
title: explain.ts
format: html
---
`];
  qmdOut.push(
    "This graph shows all import chains from `" + source.slice(p) +
      "` (a <span style='color:#1f77b4'>blue node</span>) to `" +
      target.slice(p) +
      "` (an <span style='color:#ff7f0e'>orange node</span>).\n\n",
  );
  qmdOut.push("```{ojs}\n//| echo: false\n\ndot`digraph G {");
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
    if (name.slice(p) === source.slice(p)) {
      qmdOut.push(
        `  ${ix} [ label = "${
          name.slice(p)
        }", shape = "box", fillcolor = "#1f77b4", style = "filled", fontcolor = "white" ];`,
      );
    } else if (name.slice(p) === target.slice(p)) {
      qmdOut.push(
        `  ${ix} [ label = "${
          name.slice(p)
        }", shape = "box", fillcolor = "#ff7f0e", style = "filled" ];`,
      );
    } else {
      qmdOut.push(`  ${ix} [ label = "${name.slice(p)}", shape = "none" ];`);
    }
  }
  qmdOut.push("}`\n```\n");

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
    console.log(`inspect.ts: generate a graph visualization of import paths
between files in quarto.

Usage:
  $ quarto run inspect.ts <source-file.ts> <target-file.ts>

Examples:

  From ./src:

  $ quarto run ../package/scripts/common/explain.ts command/render/render.ts core/esbuild.ts
  $ quarto run ../package/scripts/common/explain.ts command/check/cmd.ts core/lib/external/regexpp.mjs

If no dependencies exist, this script will report that:

  $ quarto run ../package/scripts/common/explain.ts ../package/src/bld.ts core/lib/external/tree-sitter-deno.js

    package/src/bld.ts does not depend on src/core/lib/external/tree-sitter-deno.js
`);
    Deno.exit(1);
  }
  const process = Deno.run({
    cmd: ["deno", "info", Deno.args[0], "--json"],
    stdout: "piped",
  });
  const rawOutput = await process.output();

  const json = JSON.parse(new TextDecoder().decode(rawOutput)) as DenoInfoJSON;
  const { graph, errors } = moduleGraph(json);

  const targetName = Deno.args[1];
  const target = toFileUrl(resolve(targetName)).href;
  const result = explain(graph, json.roots[0], target);
  await buildOutput(result, json.roots[0], target);
}
