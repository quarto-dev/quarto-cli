import { walk } from "@observablehq/parser";

import { full, simple } from "acorn-walk";

/**
 *  FINISH REPLACING THE SIMPLE WALKER WITH A FULL WALKER THAT DOES SUBSTITUTION ALL AT ONCE.
 * 
 */

export const extractPath = path => {
  let source = path;
  let m;

  // "https://api.observablehq.com/@jashkenas/inputs.js?v=3" => strip off ".js"
  if ((m = /\.js(\?|$)/i.exec(source))) source = source.slice(0, m.index);

  // "74f872c4fde62e35" => "d/..."
  if ((m = /^[0-9a-f]{16}$/i.test(source))) source = `d/${source}`;

  // link of notebook
  if ((m = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source)))
    source = source.slice(m[0].length);
  return source;
};

export function setupImportCell(cell) {
  const specifiers = [];

  if (cell.body.specifiers)
    for (const specifier of cell.body.specifiers) {
      if (specifier.view) {
        specifiers.push({
          name: "viewof " + specifier.imported.name,
          alias: "viewof " + specifier.local.name
        });
      } else if (specifier.mutable) {
        specifiers.push({
          name: "mutable " + specifier.imported.name,
          alias: "mutable " + specifier.local.name
        });
      }
      specifiers.push({
        name: specifier.imported.name,
        alias: specifier.local.name
      });
    }
  // If injections is undefined, do not derive!
  const hasInjections = cell.body.injections !== undefined;
  const injections = [];
  if (hasInjections)
    for (const injection of cell.body.injections) {
      // This currently behaves like notebooks on observablehq.com
      // Commenting out the if & else if blocks result in behavior like Example 3 here: https://observablehq.com/d/7ccad009e4d89969
      if (injection.view) {
        injections.push({
          name: "viewof " + injection.imported.name,
          alias: "viewof " + injection.local.name
        });
      } else if (injection.mutable) {
        injections.push({
          name: "mutable " + injection.imported.name,
          alias: "mutable " + injection.local.name
        });
      }
      injections.push({
        name: injection.imported.name,
        alias: injection.local.name
      });
    }
  const importString = `import {${specifiers
    .map(specifier => `${specifier.name} as ${specifier.alias}`)
    .join(", ")}} ${
    hasInjections
      ? `with {${injections
          .map(injection => `${injection.name} as ${injection.alias}`)
          .join(", ")}} `
      : ``
  }from "${cell.body.source.value}"`;

  return { specifiers, hasInjections, injections, importString };
}

export function setupRegularCell(cell) {
  let name = null;
  if (cell.id && cell.id.name) name = cell.id.name;
  else if (cell.id && cell.id.id && cell.id.id.name) name = cell.id.id.name;
  let bodyText = cell.input.substring(cell.body.start, cell.body.end);
  let expressionMap = {};
  let references = [];
  let counter = 0;
  const cellReferences = Array.from(new Set((cell.references || []).map(ref => {
    if (ref.type === "ViewExpression") {
      if (expressionMap[ref.id.name] === undefined) {
        const newName = `$${counter++}`;
        expressionMap[ref.id.name] = newName;
        references.push(newName);
      }
      return "viewof " + ref.id.name;
    } else if (ref.type === "MutableExpression") {
      if (expressionMap[ref.id.name] === undefined) {
        const newName = `$${counter++}`;
        expressionMap[ref.id.name] = newName;
        references.push(newName);
      }
      return "mutable " + ref.id.name;
    } else {
      references.push(ref.name);
      return ref.name;
    }
  })));
  const uniq = (lst) => {
    const result = [];
    const s = new Set();
    for (const v of lst) {
      if (s.has(v)) continue;
      s.add(v);
      result.push(v);
    }
    return result;
  }
  const patches = [];
  let latestPatch = { newStr: "", span: [cell.body.start, cell.body.start] };
  full(cell.body, node => {
    if (node.type === "ViewExpression" || node.type === "MutableExpression") {
      // cover previous ground?
      if (node.start !== latestPatch.span[1]) {
        patches.push({ newStr: cell.input.substring(latestPatch.span[1], node.start)});
      }
      const suffix = node.type === "MutableExpression" ? ".value" : "";
      const newStr = `${expressionMap[node.id.name]}${suffix}`;
      const patch = {
        newStr,
        span: [node.start, node.end]
      };
      latestPatch = patch;
      patches.push(patch);
    }
  }, walk);
  patches.push({newStr: cell.input.substring(latestPatch.span[1], cell.body.end), span: [latestPatch.span[1], cell.body.end]});
  bodyText = patches.map(x => x.newStr).join("");

  return {
    cellName: name,
    references: uniq(references),
    bodyText,
    cellReferences: uniq(cellReferences)
  };
}
