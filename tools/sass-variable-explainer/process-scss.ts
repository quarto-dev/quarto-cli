import { getSassAst } from "./sass-analyze.ts";
import { walk } from "./sass-analyzer/ast-utils.ts";

let contents = Deno.readTextFileSync(Deno.args[0] || "/dev/stdin");
const ast = getSassAst(contents);

type Matcher = number | ((v: unknown) => unknown);

const isType = (type: string): Matcher => {
  return (v: unknown) => {
    if (!v || typeof v !== "object") return false;
    if ((v as Record<string, unknown>).type === type) { return v; } else { return false };
  };
}

const getSingleValueOfType = (type: string): Matcher => {
  return (v: unknown) => {
    if (!v || typeof v !== "object") return false;
    const value = (v as Record<string, unknown>).value;
    if (!Array.isArray(value)) return false;
    const valuesOfType = value.filter((v) => (v as Record<string, unknown>).type === type);
    if (valuesOfType.length !== 1) return false;
    return valuesOfType[0];
  };
}

const isDefault = (v: unknown): Matcher => {
  return (v: unknown) => {
    if (!v || typeof v !== "object") return false;
    if ((v as Record<string, unknown>).type !== "value") return false;
    const value = (v as Record<string, unknown>).value as any[];
    if (value[value.length - 1].type !== "identifier" || value[value.length - 1].value !== "default") return false;
    if (value[value.length - 2].type !== "operator" || value[value.length - 2].value !== "!") return false;
    return v;
  }
}

const match = (param: unknown, matcher: Matcher[]): unknown => {
  if (!param || typeof param !== "object") return undefined;
  if (matcher.length === 0) return param;
  const obj = param as Record<string, unknown>;
  const [key, ...rest] = matcher;
  if (typeof key === "function") {
    const result = key(obj);
    if (!result) return undefined;
    return match(result, rest);
  } else if (typeof key === "number") {
    if (!(Array.isArray(obj.value))) {
      return undefined;
    }
    return match(obj.value[key], rest);
  }
} 

type Dependency = {
  name: string;
  references: string[];
};

const getDependencies = (ast: any): Dependency[] => {
  const dependencies: any[] = [];

  for (const entry of ast.value) {
    const variableNameMatcher = [
      isType("declaration"),
      0,
      isType("property"),
      0,
      isType("variable"),
    ];
    const variableNameNode = match(entry, variableNameMatcher);
    if (!variableNameNode) {
      continue;
    }
    const variableValueMatcher = [
      isType("declaration"),
      getSingleValueOfType("value"),
    ];
    const variableValueNode = match(entry, variableValueMatcher);
    if (!variableValueNode) {
      continue;
    }

    // console.log((variableNameNode as any).type);
    // console.log(variableValueNode); // (variableValueNode as any).type);
    const variableName = (variableNameNode as { value: string }).value;

    const references: string[] = [];

    const walker = (node: any) => {
      const ifStmt = [
        isType("function"),
        0,
        isType("identifier"),
        (v: any) => v.value === "if" && v,
      ];
      if (match(node, ifStmt)) {
        // this thing really is not a parser, it's a glorified tokenizer

        const tokenStream = node.value[1].value.filter(
          (x: any) => x.type !== "space" && 
          x.type !== "comment_singleline" && 
          x.type !== "comment_multiline");
        // split on comma: { type: "punctuation", value: "," }
        let currentArg: any[] = [];
        let firstArg = true;
        for (const token of tokenStream) {
          if (token.type === "punctuation" && token.value === ",") {
            if (firstArg) {
              firstArg = false;
            } else {
              walk(currentArg, walker);
            }
            currentArg = [];
          } else {
            currentArg.push(token);
          }
        }
        if (!firstArg) {
          walk(currentArg, walker);
        }
        return false;
      }
      if (node.type === "variable") {
        references.push(node.value);
      }
      return true;
    };

    walk(variableValueNode, walker);

    if (references.length) {
      dependencies.push({ name: variableName, references });
    }
  }
  return dependencies;
}

const dependencies = getDependencies(ast);

const getTypeAnalysis = (ast: any) => {
  // now we try to figure out variable types as best we can
  const variableTypes: Record<string, string[]> = {};
  for (const entry of ast.value) {
  }
}


console.log(JSON.stringify({
  dependencies
}, null, 2));