import { walk } from "./ast-utils.ts";
// import { assert } from "jsr:@std/assert";

const assert = (condition: any) => {
  if (!condition) {
    throw new Error("Assertion failed");
  }
}

export const getVariableDependencies = (declarations: Map<string, any>) => {
  const dependencies = new Map<string, {
    node: any,
    dependencies: Set<string>
  }>();
  for (const [name, node] of declarations) {
    assert(node?.type === "declaration");
    const varName = node?.property?.variable?.value;
    assert(varName === name);
    if (!dependencies.has(varName)) {
      dependencies.set(varName, {node: node, dependencies: new Set()});
    }
    const varValue = node?.value;
    walk(varValue, (inner: any) => {
      if (inner?.type === "variable") {
        const innerName = inner?.value;
        if (!innerName) {
          console.log(inner);
          throw new Error("stop")  
        }
        dependencies.get(varName)!.dependencies.add(innerName);        
      }
      return true;
    });
  }
  return dependencies;
}