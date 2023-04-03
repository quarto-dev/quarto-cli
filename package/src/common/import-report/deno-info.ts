/*
* deno-info.ts
*
* functions and interfaces for processing data from `deno info --json`
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

////////////////////////////////////////////////////////////////////////////////

export interface DenoInfoDependency {
  specifier: string;
  type?: {
    error?: string;
    specifier?: string;
    span: {
      start: number;
      end: number;
    };
  };
  code?: {
    // apparently, if specifier exists, error doesn't and vice-versa.
    error?: string;
    specifier?: string;
    span: {
      start: number;
      end: number;
    };
  };
}

export interface DenoInfoModule {
  dependencies: DenoInfoDependency[];
  local: string;
  emit: string;
  map: unknown;
  mediaType: string;
  size: number;
  specifier: string;
}

export interface DenoInfoJSON {
  roots: string[];
  modules: DenoInfoModule[];
}

export type DependencyGraph = Record<string, string[]>;

export interface ResolutionError {
  "from": string;
  to: string; // this is the _unresolved_ specifier
  message: string;
}

export interface Edge {
  "from": string;
  to: string;
}

////////////////////////////////////////////////////////////////////////////////

export async function getDenoInfo(_root: string): Promise<DenoInfoJSON> {
  const process = Deno.run({
    cmd: ["deno", "info", Deno.args[0], "--json"],
    stdout: "piped",
  });
  const rawOutput = await process.output();

  const json = JSON.parse(new TextDecoder().decode(rawOutput)) as DenoInfoJSON;
  return json;
}

export function moduleGraph(info: DenoInfoJSON): {
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
      } = code || {};
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

export function graphTranspose(graph: DependencyGraph): DependencyGraph {
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

export function reachability(
  graph: DependencyGraph,
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
