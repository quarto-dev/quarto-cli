import {simple} from "acorn-walk";
import walk from "./walk.js";

export default function findFeatures(cell, featureName) {
  const ast = {type: "Program", body: [cell.body]};
  const features = new Map();
  const {references} = cell;

  simple(
    ast,
    {
      CallExpression: node => {
        const {callee, arguments: args} = node;

        // Ignore function calls that are not references to the feature.
        if (
          callee.type !== "Identifier" ||
          callee.name !== featureName ||
          references.indexOf(callee) < 0
        ) return;

        // Forbid dynamic calls.
        if (
          args.length !== 1 ||
          !((args[0].type === "Literal" && /^['"]/.test(args[0].raw)) ||
            (args[0].type === "TemplateLiteral" && args[0].expressions.length === 0))
        ) {
          throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), {node});
        }

        const [arg] = args;
        const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
        const location = {start: arg.start, end: arg.end};
        if (features.has(name)) features.get(name).push(location);
        else features.set(name, [location]);
      }
    },
    walk
  );

  return features;
}
