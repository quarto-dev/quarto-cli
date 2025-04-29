import { parse } from "npm:scss-parser";
import { assert } from "jsr:@std/assert";
import * as prettier from "npm:prettier";
import { propagateDeclarationTypes } from "./sass-analyzer/declaration-types.ts";
import { getVariableDependencies } from "./sass-analyzer/get-dependencies.ts";
import { cleanSassAst } from "./sass-analyzer/clean-ast.ts";
import { makeParserModule } from "./sass-analyzer/parse.ts";

export const getSassAst = makeParserModule(parse, prettier.format).getSassAst;

const drawColorDependencyGraph = (ast: any) => {
  const declarations = propagateDeclarationTypes(ast);

  let labelCount = 0;
  const labels: Map<string, string> = new Map();
  const dotNodeName = (name: string) => {
    if (labels.has(name)) {
      return { id: labels.get(name) };
    }
    const newName = `N${labelCount++}`;
    labels.set(name, newName);
    return { id: newName, nodeDecl: `${newName}[label="${name}"]` };
  }

  console.log("```{dot}");
  console.log("digraph G {\n  rankdir=LR;\n");
  console.log("  splines=false;");
  console.log("  node [shape=rectangle, color=gray]");
  console.log("  edge [color=gray]");

  const varDeps = getVariableDependencies(declarations);
  const inverseVarDeps = new Map<string, Set<string>>();
  const origins = new Map<string, Set<string>>();
  const addToSetMap = (map: Map<string, Set<string>>, key: string, value: string) => {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(value);
  }

  for (const [name, deps] of varDeps) {
    // update origin sets
    const node = deps.node;
    const origin = node?.annotation?.origin ?? "unknown";
    addToSetMap(origins, origin, name);
    // update inverse dependencies
    for (const dep of deps.dependencies) {
      if (declarations.get(name)?.valueType !== "color" ||
        declarations.get(dep)?.valueType !== "color") {
        continue;
      }
      addToSetMap(inverseVarDeps, dep, name);
    }
  }
  let subgraphCount = 0;
  for (const [name, vars] of origins) {
    if (name === "unknown") {
      continue;
    }
    subgraphCount++;
    console.log(`subgraph subgraph_${subgraphCount} {`);
    for (const varName of vars) {
      // only show numbered colors if they have inverse dependencies
      if (varName.match(/^.+-[0-9]00$/) && !inverseVarDeps.get(varName)?.size) {
        continue;
      }
      const { nodeDecl: sourceNodeDecl } = dotNodeName(varName);
      if (!sourceNodeDecl) {
        throw new Error("multiple origins for a variable? " + varName);
      }
      assert(sourceNodeDecl);
      console.log(`  ${sourceNodeDecl}`);
    }
    console.log(`  label = "${name}"`);
		console.log(`  color=red`);
    console.log("}");
  }
  
  for (const [name, deps] of varDeps) {
    if (deps.node.valueType !== "color") {
      continue;
    }
    // only show numbered colors if they have inverse dependencies
    if (name.match(/^.+-[0-9]00$/) && !inverseVarDeps.get(name)?.size) {
      continue;
    }
    for (const dep of deps.dependencies) {
      if (declarations.get(dep)?.valueType !== "color") {
        continue;
      }
      const {id: sourceId, nodeDecl: sourceNodeDecl } = dotNodeName(dep);
      const {id: targetId, nodeDecl: targetNodeDecl } = dotNodeName(name);
      if (sourceNodeDecl) {
        console.log(`  ${sourceNodeDecl}`);
      }
      if (targetNodeDecl) {
        console.log(`  ${targetNodeDecl}`);
      }

      console.log(`  ${sourceId} -> ${targetId}`);
    }
  }

  console.log("}");
  console.log("```");
}

if (import.meta.main) {
  const ast = await getSassAst(Deno.readTextFileSync(Deno.args[0] || "/dev/stdin"));
  let cleaned = cleanSassAst(ast);
  drawColorDependencyGraph(cleaned);
  // const declarations = propagateDeclarationTypes(cleaned);
  // for (const [name, node] of declarations) {
  //   if (node.valueType === "color") {
  //     console.log(name, node.line);
  //   }
  //   // console.log(name, node);
  // }
}