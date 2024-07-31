import { walk } from "./ast-utils.ts";

export const getVariableDependencies = (ast: any) => {
  const dependencies = new Map<string, {
    node: any,
    dependencies: Set<string>
  }>();
  for (const node of ast.children) {
    if (node?.type !== "declaration") {
      continue;
    }
    const varName = node?.property?.variable?.value;
    const varValue = node?.value;
    walk(varValue, (inner: any) => {
      if (inner?.type === "variable") {
        const innerName = inner?.value;
        if (!innerName) {
          console.log(inner);
          throw new Error("stop")  
        }
        if (!dependencies.has(varName)) {
          dependencies.set(varName, {node: node, dependencies: new Set()});
        }
        dependencies.get(varName)!.dependencies.add(innerName);        
      }
      return true;
    });
  }
  return dependencies;
}