import { error } from "../../../deno_ral/log.ts";
import { walk } from "./ast-utils.ts";
// import { assert } from "jsr:@std/assert";

// deno-lint-ignore no-explicit-any
const assert = (condition: any) => {
  if (!condition) {
    throw new Error("Assertion failed");
  }
};

export const getVariableDependencies = (declarations: Map<string, any>) => {
  const dependencies = new Map<string, {
    // deno-lint-ignore no-explicit-any
    node: any;
    dependencies: Set<string>;
  }>();
  for (const [name, node] of declarations) {
    assert(node?.type === "declaration");
    const varName = node?.property?.variable?.value;
    assert(varName === name);
    if (!dependencies.has(varName)) {
      dependencies.set(varName, { node: node, dependencies: new Set() });
    }
    const varValue = node?.value;
    // deno-lint-ignore no-explicit-any
    walk(varValue, (inner: any) => {
      if (inner?.type === "variable") {
        const innerName = inner?.value;
        if (!innerName) {
          error(inner);
          throw new Error("stop");
        }
        dependencies.get(varName)!.dependencies.add(innerName);
      }
      return true;
    });
  }
  return dependencies;
};
