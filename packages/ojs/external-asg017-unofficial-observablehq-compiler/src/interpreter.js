import { parseCell, parseModule } from "@observablehq/parser";
import { setupRegularCell, setupImportCell, extractPath } from "./utils";

const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const GeneratorFunction = Object.getPrototypeOf(function*() {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(async function*() {})
  .constructor;

function createRegularCellDefinition(cell) {
  const { cellName, references, bodyText, cellReferences } = setupRegularCell(
    cell
  );

  let code;
  if (cell.body.type !== "BlockStatement") {
    if (cell.async)
      code = `return (async function(){ return (${bodyText});})()`;
    else code = `return (function(){ return (${bodyText});})()`;
  } else code = bodyText;

  let f;
  if (cell.generator && cell.async)
    f = new AsyncGeneratorFunction(...references, code);
  else if (cell.async) f = new AsyncFunction(...references, code);
  else if (cell.generator) f = new GeneratorFunction(...references, code);
  else f = new Function(...references, code);
  return {
    cellName,
    cellFunction: f,
    cellReferences
  };
}

function defaultResolveImportPath(path) {
  const source = extractPath(path);
  return import(`https://api.observablehq.com/${source}.js?v=3`).then(
    m => m.default
  );
}

function defaultResolveFileAttachments(name) {
  return name;
}

export class Interpreter {
  constructor(params = {}) {
    const {
      module = null,
      observer = null,
      resolveImportPath = defaultResolveImportPath,
      resolveFileAttachments = defaultResolveFileAttachments,
      defineImportMarkdown = true,
      observeViewofValues = true,
      observeMutableValues = true
    } = params;

    // can't be this.module bc of async module().
    // so make defaultObserver follow same convention.
    this.defaultModule = module;
    this.defaultObserver = observer;

    this.resolveImportPath = resolveImportPath;
    this.resolveFileAttachments = resolveFileAttachments;
    this.defineImportMarkdown = defineImportMarkdown;
    this.observeViewofValues = observeViewofValues;
    this.observeMutableValues = observeMutableValues;
  }

  async module(input, module, observer) {
    module = module || this.defaultModule;
    observer = observer || this.defaultObserver;

    if (!module) throw Error("No module provided.");
    if (!observer) throw Error("No observer provided.");

    const parsedModule = parseModule(input);
    const cellPromises = [];
    for (const cell of parsedModule.cells) {
      cell.input = input;
      cellPromises.push(this.cell(cell, module, observer));
    }
    return Promise.all(cellPromises);
  }

  async cell(input, module, observer) {
    module = module || this.defaultModule;
    observer = observer || this.defaultObserver;

    if (!module) throw Error("No module provided.");
    if (!observer) throw Error("No observer provided.");

    let cell;
    if (typeof input === "string") {
      cell = parseCell(input);
      cell.input = input;
    } else {
      cell = input;
    }

    if (cell.body.type === "ImportDeclaration") {
      const path = cell.body.source.value;
      const specs = cell.body.specifiers.map(d => {
        const prefix = d.view ? "viewof " : d.mutable ? "mutable " : "";
        return `${prefix}${d.imported.name}`;
      });
      const fromModule = await this.resolveImportPath(path, specs);
      let mdVariable, vars;

      const {
        specifiers,
        hasInjections,
        injections,
        importString
      } = setupImportCell(cell);

      const other = module._runtime.module(fromModule);

      if (this.defineImportMarkdown)
        mdVariable = module.variable(observer()).define(
          null,
          ["md"],
          md => md`~~~javascript
  ${importString}
  ~~~`
        );
      if (hasInjections) {
        const child = other.derive(injections, module);
        vars = specifiers.map(({ name, alias }) =>
          module.import(name, alias, child)
        );
      } else {
        vars = specifiers.map(({ name, alias }) =>
          module.import(name, alias, other)
        );
      }
      return mdVariable ? [mdVariable, ...vars] : vars;
    } else {
      const {
        cellName,
        cellFunction,
        cellReferences
      } = createRegularCellDefinition(cell);
      if (cell.id && cell.id.type === "ViewExpression") {
        const reference = `viewof ${cellName}`;
        return [
          module
            .variable(observer(reference))
            .define(reference, cellReferences, cellFunction.bind(this)),
          module
            .variable(this.observeViewofValues ? observer(cellName) : null)
            .define(cellName, ["Generators", reference], (G, _) => G.input(_))
        ];
      } else if (cell.id && cell.id.type === "MutableExpression") {
        const initialName = `initial ${cellName}`;
        const mutableName = `mutable ${cellName}`;
        return [
          module
            .variable(null)
            .define(initialName, cellReferences, cellFunction),
          module
            .variable(observer(mutableName))
            .define(mutableName, ["Mutable", initialName], (M, _) => new M(_)),
          module
            .variable(this.observeMutableValues ? observer(cellName) : null)
            .define(cellName, [mutableName], _ => _.generator)
        ];
      } else {
        return [
          module
            .variable(observer(cellName))
            .define(cellName, cellReferences, cellFunction.bind(this))
        ];
      }
    }
  }
}
