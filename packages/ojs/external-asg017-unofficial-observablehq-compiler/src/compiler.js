import { parseCell, parseModule } from "@observablehq/parser";
import { setupRegularCell, setupImportCell, extractPath } from "./utils";
import { treeShakeModule } from "./tree-shake";

function ESMImports(moduleObject, resolveImportPath) {
  const importMap = new Map();
  let importSrc = "";
  let j = 0;

  for (const { body } of moduleObject.cells) {
    if (body.type !== "ImportDeclaration" || importMap.has(body.source.value))
      continue;

    const defineName = `define${++j}`;
    // TODO get cell specififiers here and pass in as 2nd param to resolveImportPath
    // need to use same logic as tree-shake name()s
    const specifiers = body.specifiers.map(d => {
      const prefix = d.view ? "viewof " : d.mutable ? "mutable " : "";
      return `${prefix}${d.imported.name}`;
    });
    const fromPath = resolveImportPath(body.source.value, specifiers);
    importMap.set(body.source.value, { defineName, fromPath });
    importSrc += `import ${defineName} from "${fromPath}";\n`;
  }

  if (importSrc.length) importSrc += "\n";
  return { importSrc, importMap };
}

// by default, file attachments get resolved like:
//   [ ["a", "https://example.com/files/a"] ]
// but sometimes, you'll want to write JS code when resolving
// instead of being limiting by strings. The third param
// enables that, allowing for resolving like:
//   [ ["a", new URL("./files/a", import.meta.url)] ]
function ESMAttachments(
  moduleObject,
  resolveFileAttachments,
  UNSAFE_allowJavascriptFileAttachments = false
) {
  let mapValue;
  if (UNSAFE_allowJavascriptFileAttachments) {
    const attachmentMapEntries = [];
    for (const cell of moduleObject.cells) {
      if (cell.fileAttachments.size === 0) continue;
      for (const file of cell.fileAttachments.keys())
        attachmentMapEntries.push([file, resolveFileAttachments(file)]);
    }
    if (attachmentMapEntries.length)
      mapValue = `[${attachmentMapEntries
        .map(([key, value]) => `[${JSON.stringify(key)}, ${value}]`)
        .join(",")}]`;
  } else {
    const attachmentMapEntries = [];
    // loop over cells with fileAttachments
    for (const cell of moduleObject.cells) {
      if (cell.fileAttachments.size === 0) continue;
      // add filenames and resolved URLs to array
      for (const file of cell.fileAttachments.keys())
        attachmentMapEntries.push([file, resolveFileAttachments(file)]);
    }
    if (attachmentMapEntries.length)
      mapValue = JSON.stringify(attachmentMapEntries);
  }

  if (!mapValue) return "";
  return `  const fileAttachments = new Map(${mapValue});
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));`;
}

function ESMVariables(moduleObject, importMap, params) {
  const {
    defineImportMarkdown,
    observeViewofValues,
    observeMutableValues
  } = params;

  let childJ = 0;
  return moduleObject.cells
    .map(cell => {
      let src = "";

      if (cell.body.type === "ImportDeclaration") {
        const {
          specifiers,
          hasInjections,
          injections,
          importString
        } = setupImportCell(cell);

        if (defineImportMarkdown)
          src +=
            `  main.variable(observer()).define(
    null,
    ["md"],
    md => md\`~~~javascript
${importString}
~~~\`
  );` + "\n";

        // name imported notebook define functions
        const childName = `child${++childJ}`;
        src += `  const ${childName} = runtime.module(${
          importMap.get(cell.body.source.value).defineName
        })${
          hasInjections ? `.derive(${JSON.stringify(injections)}, main)` : ""
        };
${specifiers
  .map(
    specifier =>
      `  main.import("${specifier.name}", "${specifier.alias}", ${childName});`
  )
  .join("\n")}`;
      } else {
        const {
          cellName,
          references,
          bodyText,
          cellReferences
        } = setupRegularCell(cell);

        const cellNameString = cellName ? `"${cellName}"` : "";
        const referenceString = references.join(",");
        let code = "";
        if (cell.body.type !== "BlockStatement")
          code = `{return(
${bodyText}
)}`;
        else code = "\n" + bodyText + "\n";
        const cellReferencesString = cellReferences.length
          ? JSON.stringify(cellReferences) + ", "
          : "";
        let cellFunction = "";
        if (cell.generator && cell.async)
          cellFunction = `async function*(${referenceString})${code}`;
        else if (cell.async)
          cellFunction = `async function(${referenceString})${code}`;
        else if (cell.generator)
          cellFunction = `function*(${referenceString})${code}`;
        else cellFunction = `function(${referenceString})${code}`;

        if (cell.id && cell.id.type === "ViewExpression") {
          const reference = `"viewof ${cellName}"`;
          src += `  main.variable(observer(${reference})).define(${reference}, ${cellReferencesString}${cellFunction});
  main.variable(${
    observeViewofValues ? `observer("${cellName}")` : `null`
  }).define("${cellName}", ["Generators", ${reference}], (G, _) => G.input(_));`;
        } else if (cell.id && cell.id.type === "MutableExpression") {
          const initialName = `"initial ${cellName}"`;
          const mutableName = `"mutable ${cellName}"`;
          src += `  main.define(${initialName}, ${cellReferencesString}${cellFunction});
  main.variable(observer(${mutableName})).define(${mutableName}, ["Mutable", ${initialName}], (M, _) => new M(_));
  main.variable(${
    observeMutableValues ? `observer("${cellName}")` : `null`
  }).define("${cellName}", [${mutableName}], _ => _.generator);`;
        } else {
          src += `  main.variable(observer(${cellNameString})).define(${
            cellName ? cellNameString + ", " : ""
          }${cellReferencesString}${cellFunction});`;
        }
      }
      return src;
    })
    .join("\n");
}
function createESModule(moduleObject, params = {}) {
  const {
    resolveImportPath,
    resolveFileAttachments,
    defineImportMarkdown,
    observeViewofValues,
    observeMutableValues,
    UNSAFE_allowJavascriptFileAttachments
  } = params;
  const { importSrc, importMap } = ESMImports(moduleObject, resolveImportPath);
  return `${importSrc}export default function define(runtime, observer) {
  const main = runtime.module();
${ESMAttachments(
  moduleObject,
  resolveFileAttachments,
  UNSAFE_allowJavascriptFileAttachments
)}
${ESMVariables(moduleObject, importMap, {
  defineImportMarkdown,
  observeViewofValues,
  observeMutableValues
}) || ""}
  return main;
}`;
}

function defaultResolveImportPath(path) {
  const source = extractPath(path);
  return `https://api.observablehq.com/${source}.js?v=3`;
}

function defaultResolveFileAttachments(name) {
  return name;
}
export class Compiler {
  constructor(params = {}) {
    const {
      resolveFileAttachments = defaultResolveFileAttachments,
      resolveImportPath = defaultResolveImportPath,
      defineImportMarkdown = true,
      observeViewofValues = true,
      observeMutableValues = true,
      UNSAFE_allowJavascriptFileAttachments = false
    } = params;
    this.resolveFileAttachments = resolveFileAttachments;
    this.resolveImportPath = resolveImportPath;
    this.defineImportMarkdown = defineImportMarkdown;
    this.observeViewofValues = observeViewofValues;
    this.observeMutableValues = observeMutableValues;
    this.UNSAFE_allowJavascriptFileAttachments = UNSAFE_allowJavascriptFileAttachments;
  }
  module(input, params = {}) {
    let m1 = typeof input === "string" ? parseModule(input) : input;

    if (params.treeShake) m1 = treeShakeModule(m1, params.treeShake);

    return createESModule(m1, {
      resolveImportPath: this.resolveImportPath,
      resolveFileAttachments: this.resolveFileAttachments,
      defineImportMarkdown: this.defineImportMarkdown,
      observeViewofValues: this.observeViewofValues,
      observeMutableValues: this.observeMutableValues,
      UNSAFE_allowJavascriptFileAttachments: this
        .UNSAFE_allowJavascriptFileAttachments
    });
  }
  notebook(obj) {
    const cells = obj.nodes.map(({ value }) => {
      const cell = parseCell(value);
      cell.input = value;
      return cell;
    });
    return createESModule(
      { cells },
      {
        resolveImportPath: this.resolveImportPath,
        resolveFileAttachments: this.resolveFileAttachments,
        defineImportMarkdown: this.defineImportMarkdown,
        observeViewofValues: this.observeViewofValues,
        observeMutableValues: this.observeMutableValues
      }
    );
  }
}
