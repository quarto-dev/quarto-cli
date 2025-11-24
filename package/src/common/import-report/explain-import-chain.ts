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

function explain(
  graph: DependencyGraph,
  source: string,
  target: string,
): Edge[] {
  const result: Edge[] = [];
  const deps = reachability(graph, source);
  if (!deps[target]) {
    const [ss, st] = [source, target].map((s) =>
      s.slice(longestCommonDirPrefix([source, target]).length)
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

function edgeColor(source: string, target: string) {
  if (
    source.indexOf("src/core/") !== -1 &&
    target.indexOf("src/core/") === -1
  ) {
    return "red";
  }
  if (
    source.indexOf("src/core/lib") !== -1 &&
    target.indexOf("src/core/lib") === -1
  ) {
    return "red";
  }
  return undefined;
}

function generateGraph(edges: Edge[], source: string, target: string): string {
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

    const c = edgeColor(edgeFrom, to);
    if (c) {
      qmdOut.push(`  ${m[edgeFrom]} -> ${m[to]} [color="${c}"];`);
    } else {
      qmdOut.push(`  ${m[edgeFrom]} -> ${m[to]};`);
    }
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
  qmdOut.push("}\n");
  return qmdOut.join("");
}

async function buildOutput(edges: Edge[], source: string, target: string) {
  const strs: Set<string> = new Set();
  for (const { "from": edgeFrom, to } of edges) {
    strs.add(edgeFrom);
    strs.add(to);
  }
  const p = longestCommonDirPrefix(Array.from(strs)).length;

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
  qmdOut.push("```{ojs}\n//| echo: false\n\ndot`");
  qmdOut.push(generateGraph(edges, source, target));
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
      `explain-import-chain.ts: generate a graph visualization of import paths
between files in quarto.

Usage:
  $ quarto run --dev explain-import-chain.ts <source-file.ts> <target-file.ts> [--simplify] [--graph|--toon [filename]]

Options:
  --simplify       Simplify paths by removing common prefix
  --graph [file]   Output .dot specification (default: import-chain.dot)
  --toon [file]    Output edges in TOON format (default: import-chain.toon)

Examples:

  From project root:

  $ quarto run --dev package/src/common/import-report/explain-import-chain.ts src/command/render/render.ts src/core/esbuild.ts
  $ quarto run --dev package/src/common/import-report/explain-import-chain.ts src/command/check/cmd.ts src/core/lib/external/regexpp.mjs
  $ quarto run --dev package/src/common/import-report/explain-import-chain.ts src/command/render/render.ts src/core/esbuild.ts --simplify --toon

If no dependencies exist, this script will report that:

  $ quarto run --dev package/src/common/import-report/explain-import-chain.ts package/src/bld.ts src/core/lib/external/tree-sitter-deno.js

    package/src/bld.ts does not depend on src/core/lib/external/tree-sitter-deno.js

If no output option is given, opens an interactive preview.
`,
    );
    Deno.exit(1);
  }
  // Parse arguments
  let simplify = false;
  let args = Deno.args;

  if (args[2] === "--simplify") {
    simplify = true;
    args = [args[0], args[1], ...args.slice(3)];
  }

  const json = await getDenoInfo(args[0]);
  const { graph } = moduleGraph(json);

  const targetName = args[1];
  const target = toFileUrl(resolve(targetName)).href;
  let result = explain(graph, json.roots[0], target);

  // Apply simplification if requested
  if (simplify && result.length > 0) {
    const allPaths = result.map(e => [e.from, e.to]).flat();
    const prefix = longestCommonDirPrefix(allPaths);
    result = result.map(({ from, to }) => ({
      from: from.slice(prefix.length),
      to: to.slice(prefix.length),
    }));
  }

  if (args[2] === "--graph") {
    Deno.writeTextFileSync(
      args[3] || "import-chain.dot",
      generateGraph(result, json.roots[0], target),
    );
  } else if (args[2] === "--toon") {
    const lines = [`edges[${result.length}]{from,to}:`];
    for (const { from, to } of result) {
      lines.push(`  ${from},${to}`);
    }
    Deno.writeTextFileSync(
      args[3] || "import-chain.toon",
      lines.join("\n") + "\n",
    );
  } else {
    await buildOutput(result, json.roots[0], target);
  }
}
