/*global Shiny, $, DOMParser
*
* ojs-bundle.js
*
* Copyright (C) 2021 RStudio, PBC
*
* NB: This should not have any local module imports, since that will break
* the bundling provided by pandoc when building self-contained files.
*
* External imports (from eg skypack) are fine because the module
* resolution rules still work there.
*
*/

// to bundle this with the d3-require stdlib:
//
// $ esbuild --bundle ojs-bundle.js --outfile=esbuild-bundle.js --format=esm

import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
  Runtime,
  RuntimeError,
} from "https://cdn.skypack.dev/@observablehq/runtime";
import {
  FileAttachments, Library
} from "./stdlib.js";
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";
import { button } from "https://cdn.skypack.dev/@observablehq/inputs";

import { PandocCodeDecorator } from "./pandoc-code-decorator.js";

//////////////////////////////////////////////////////////////////////////////

const kQuartoModuleWaitClass = "ojs-in-a-box-waiting-for-module-import";

function calloutBlock(opts)
{
  const {
    type,
    heading,
    message
  } = opts;
  
  const outerBlock = document.createElement("div");
  outerBlock.classList.add(`callout-${type}`, "callout", "callout-style-default", "callout-captioned");
  const header = document.createElement("div");
  header.classList.add("callout-header", "d-flex", "align-content-center");
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("callout-icon-container");
  const icon = document.createElement("i");
  icon.classList.add("callout-icon");
  iconContainer.appendChild(icon);
  header.appendChild(iconContainer);

  const headingDiv = document.createElement("div");
  headingDiv.classList.add("callout-caption-container", "flex-fill");
  headingDiv.innerText = heading;
  header.appendChild(headingDiv);
  outerBlock.appendChild(header);

  const container = document.createElement("div");
  container.classList.add("callout-body-container", "callout-body");
  if (typeof message === "string") {
    const p = document.createElement("p");
    p.innerText = message;
    container.appendChild(p);
  } else {
    container.append(message);
  }
  outerBlock.appendChild(container);
  
  return outerBlock;
}

//////////////////////////////////////////////////////////////////////////////

class EmptyInspector {
  pending() {
  }
  fulfilled(_value, _name) {
  }
  rejected(_error, _name) {
    // FIXME we should probably communicate this upstream somehow.
  }
}

export class OJSConnector {
  constructor({ paths, inspectorClass, library, allowPendingGlobals = false }) {
    this.library = library || new Library();

    // this map contains a mapping from resource names to data URLs
    // that governs fileAttachment and import() resolutions in the
    // case of self-contained files.
    this.localResolverMap = new Map();
    // Keeps track of variables that have been requested by ojs code, but do
    // not exist (not in the module, not in the library, not on window).
    // The keys are variable names, the values are {promise, resolve, reject}.
    // This is intended to allow for a (hopefully brief) phase during startup
    // in which, if an ojs code chunk references a variable that is not defined,
    // instead of treating it as an "x is not defined" error we instead
    // take a wait-and-see approach, in case the variable dynamically becomes
    // defined later. When the phase ends, killPendingGlobals() must be called
    // so any variables that are still missing do cause "x is not defined"
    // errors.
    this.pendingGlobals = {};
    // When true, the mechanism described in the `this.pendingGlobals` comment
    // is used. When false, the result of accessing undefined variables is just
    // "x is not defined". This should be considered private, only settable via
    // constructor or `killPendingGlobals`.
    this.allowPendingGlobals = allowPendingGlobals;
    // NB it looks like Runtime makes a local copy of the library object,
    // such that mutating library after this is initializaed doesn't actually
    // work.
    this.runtime = new Runtime(this.library, (name) => this.global(name));
    this.mainModule = this.runtime.module();
    this.interpreter = new Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths, this.localResolverMap),
    });
    this.inspectorClass = inspectorClass || Inspector;

    // state to handle flash of unevaluated js because of async module imports
    this.mainModuleHasImports = false;
    this.mainModuleOutstandingImportCount = 0;
    this.chunkPromises = [];
  }

  // Customizes the Runtime's behavior when an undefined variable is accessed.
  // This is needed for cases where the ojs graph is not all present at the
  // time of initialization; in particular, the case where a dependent cell
  // starts executing before one or more of its dependencies have been defined.
  // Without this customization, the user would see a flash of errors while the
  // graph is constructed; with this customization, the dependents stay blank
  // while they wait.
  global(name) {
    if (typeof window[name] !== "undefined") {
      return window[name];
    }
    if (!this.allowPendingGlobals) {
      return undefined;
    }

    // deno-lint-ignore no-prototype-builtins
    if (!this.pendingGlobals.hasOwnProperty(name)) {
      // This is a pending global we haven't seen before. Stash a new promise,
      // along with its resolve/reject callbacks, in an object and remember it
      // for later.
      const info = {};
      info.promise = new Promise((resolve, reject) => {
        info.resolve = resolve;
        info.reject = reject;
      });
      this.pendingGlobals[name] = info
    }
    return this.pendingGlobals[name].promise;
  }

  // Signals the end of the "pending globals" phase. Any promises we've handed
  // out from the global() method now are rejected. (We never resolve these
  // promises to values; if these variables made an appearance, it would've
  // been as variables on modules.)
  killPendingGlobals() {
    this.allowPendingGlobals = false;
    for (const [name, { reject }] of Object.entries(this.pendingGlobals)) {
      reject(new RuntimeError(`${name} is not defined`));
    }
  }

  setLocalResolver(map) {
    for (const [key, value] of Object.entries(map)) {
      this.localResolverMap.set(key, value);
    }
  }

  define(name, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    let change;
    const obs = this.library.Generators.observe((change_) => {
      change = change_;
      // FIXME: do something about destruction
    });
    module.variable().define(name, obs);
    return change;
  }

  watch(name, k, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    module.variable({
      fulfilled: (x) => k(x, name),
    }).define([name], (val) => val);
  }

  async value(val, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    const result = await module.value(val);
    return result;
  }

  clearImportModuleWait() {
    const array = Array.from(
      document.querySelectorAll(
        `.${kQuartoModuleWaitClass}`
      ),
    );
    for (const node of array) {
      node.classList.remove(kQuartoModuleWaitClass);
    }
  }

  finishInterpreting() {
    return Promise.all(this.chunkPromises)
      .then(() => {
        if (this.mainModuleHasImports) {
          this.clearImportModuleWait();
        }
      });
  }

  interpretWithRunner(src, runner) {
    try {
      const parse = parseModule(src);
      const chunkPromise = Promise.all(parse.cells.map(runner));
      this.chunkPromises.push(chunkPromise);
      return chunkPromise;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  waitOnImports(cell, promise) {
    if (cell.body.type !== "ImportDeclaration") {
      return promise;
    } else {
      this.mainModuleHasImports = true;
      this.mainModuleOutstandingImportCount++;
      return promise.then((result) => {
        this.mainModuleOutstandingImportCount--;
        if (this.mainModuleOutstandingImportCount === 0) {
          this.clearImportModuleWait();
        }
        return result;
      });
    }
  }

  interpretQuiet(src) {
    const runCell = (cell) => {
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(
        cellSrc,
        undefined,
        (_name) => new EmptyInspector(),
      );
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }


  ////////////////////////////////////////////////////////////////////////////
  // Error tracking/reporting
  //
  // FIXME this should all be moved into a class of its own, so OJSConnector
  // remains agnostic to the presentation layer.

  locatePreDiv(cellDiv, ojsDiv) {
    // locate the correct pre div with the pandocDecorator
    // of all potential divs, we need to find the one that most
    // immediately precedes `ojsDiv` in the DOM.
    let preDiv;
    for (const candidate of cellDiv.querySelectorAll("pre.sourceCode")) {
      if (candidate.compareDocumentPosition(ojsDiv) & ojsDiv.DOCUMENT_POSITION_FOLLOWING) {
        preDiv = candidate;
      } else {
        break;
      }
    }
    return preDiv;
  };

  findCellOutputDisplay(ojsDiv) {
    while (ojsDiv && !ojsDiv.classList.contains("cell-output-display")) {
      ojsDiv = ojsDiv.parentElement;
    }
    if (!ojsDiv) {
      throw new Error("Internal error: couldn't find output display div");
    }
    return ojsDiv;
  }
  
  clearErrorPinpoints(cellDiv, ojsDiv) {
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === undefined) {
      return;
    }
    preDiv.classList.remove("numberSource");
    let startingOffset = 0;
    if (preDiv.parentElement.dataset.sourceOffset) {
      startingOffset = -Number(preDiv.parentElement.dataset.sourceOffset);
    }
    preDiv._decorator.clearSpan(
      startingOffset, Infinity, ["quarto-ojs-error-pinpoint"]);
  };
  
  decorateOjsDivWithErrorPinpoint(ojsDiv, start, end) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    if (cellOutputDisplay._errorSpans === undefined) {
      cellOutputDisplay._errorSpans = [];
    }
    cellOutputDisplay._errorSpans.push({start, end});
  }

  decorateSource(cellDiv, ojsDiv) {
    this.clearErrorPinpoints(cellDiv, ojsDiv);
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    // sometimes the source code is not echoed.
    // FIXME: should ojs source always be "hidden" so we can show it
    // in case of runtime errors?
    if (preDiv === undefined) {
      return;
    }
    // now find all ojsDivs that contain errors that need to be decorated
    // on preDiv
    let div = preDiv.parentElement.nextElementSibling;
    while (div !== null && div.classList.contains("cell-output-display")) {
      for (const errorSpan of (div._errorSpans || [])) {
        preDiv._decorator.decorateSpan(
          errorSpan.start, errorSpan.end, ["quarto-ojs-error-pinpoint"]);
      }
      div = div.nextElementSibling;
    }
  }

  clearError(ojsDiv) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    cellOutputDisplay._errorSpans = [];
  }
  
  signalError(cellDiv, ojsDiv, ojsAst) {
    const buildCallout = (ojsDiv) => {
      const inspectChild = ojsDiv.querySelector(".observablehq--inspect");
      let [heading, message] = inspectChild.textContent.split(": ");
      if (heading === "RuntimeError") {
        heading = "OJS Runtime Error";
        if (message.match(/^(.+) is not defined$/)) {
          const [varName, ...rest] = message.split(" ");
          const p = document.createElement("p");
          const tt = document.createElement("tt");
          tt.innerText = varName;
          p.appendChild(tt);
          p.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p;
          
          const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
          // preDiv might not be exist in case source isn't echoed to HTML
          if (preDiv !== undefined) {
            // force line numbers to show
            preDiv.classList.add("numberSource");
            const missingRef = ojsAst.references.find(n => n.name === varName);
            // FIXME when missingRef === undefined, it likely means an unresolved
            // import reference. For now we will leave things as is, but
            // this needs better handling.
            if (missingRef !== undefined) {
              const {line, column} = preDiv._decorator.offsetToLineColumn(missingRef.start);
              if (line === undefined) {
                debugger;
              }
              heading = `${heading} (line ${line}, column ${column})`;
              this.decorateOjsDivWithErrorPinpoint(ojsDiv, missingRef.start, missingRef.end);
              // preDiv._decorator.decorateSpan(
              //   missingRef.start,
              //   missingRef.end, ["quarto-ojs-error-pinpoint"]);
            }
          }
        } else if (message.match(/^(.+) could not be resolved$/) ||
                   message.match(/^(.+) is defined more than once$/)) {
          const [varName, ...rest] = message.split(" ");
          const p = document.createElement("p");
          const tt = document.createElement("tt");
          tt.innerText = varName;
          p.appendChild(tt);
          p.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p;
        } else if (message === "circular definition") {
          const p = document.createElement("p");
          p.appendChild(document.createTextNode("circular definition"));
          message = p;
        } else {
          throw new Error(`Internal error, could not parse OJS error message "${message}"`);
        }
      } else {
        heading = "OJS Error";
        const p = document.createNode("p");
        p.appendChild(document.createTextNode(inspectChild.textContent));
        message = p;
      }
      const callout = calloutBlock({
        type: "important",
        heading,
        message
      });
      ojsDiv.appendChild(callout);
    };

    buildCallout(ojsDiv);
  }

  
  interpret(src, elementGetter, elementCreator) {
    const that = this;
    const observer = (targetElement, ojsAst) => {
      return (name) => {
        const element = typeof elementCreator === "function"
          ? elementCreator()
          : elementCreator;
        targetElement.appendChild(element);

        // FIXME the unofficial interpreter always calls viewexpression observers
        // twice, one with the name, and the next with 'viewof $name'.
        // we check for 'viewof ' here and hide the element we're creating.
        // this behavior appears inconsistent with OHQ's interpreter, so we
        // shouldn't be surprised to see this fail in the future.
        if (
          (ojsAst.id && (ojsAst.id.type === "ViewExpression")) &&
          !name.startsWith("viewof ")
        ) {
          element.classList.add("quarto-ojs-hide");
        }

        // handle output:all hiding
        //
        // if every output from a cell is is not displayed, then we
        // must also not display the cell output display element
        // itself.
        
        // collect the cell element as well as the cell output display
        // element
        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }

        const config = { childList: true };
        const callback = function(mutationsList, observer) {
          // we may fail to find a cell in inline settings; but
          // inline cells won't have inspectors, so in that case
          // we never hide
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;

            if (cellDiv && cellDiv.dataset.output !== "all") {
              // hide the inner inspect outputs that aren't errors or
              // declarations
              Array.from(mutation.target.childNodes)
                .filter(n => {
                  return (n.classList.contains("observablehq--inspect")) &&
                    !n.parentNode.classList.contains("observablehq--error") &&
                    (n.parentNode.parentNode.dataset.nodetype !== "expression");
                })
                .forEach(n => n.classList.add("quarto-ojs-hide"));

              // show the inspect outputs that aren't errors and are
              // expressions (they might have been hidden in the past,
              // since errors can clear)
              Array.from(mutation.target.childNodes)
                .filter(n => {
                  return (n.classList.contains("observablehq--inspect")) &&
                    !n.parentNode.classList.contains("observablehq--error") &&
                    (n.parentNode.parentNode.dataset.nodetype === "expression");
                })
                .forEach(n => n.classList.remove("quarto-ojs-hide"));
            }

            // if the ojsDiv shows an error, display a callout block instead of it.
            if (ojsDiv.classList.contains("observablehq--error")) {
              // we don't use quarto-ojs-hide here because that would confuse
              // the code which depends on that class for its logic.
              ojsDiv.querySelector(".observablehq--inspect").style.display = "none";
              
              if (ojsDiv.querySelectorAll(".callout-important").length === 0) {
                that.signalError(cellDiv, ojsDiv, ojsAst);
              }
            } else {
              that.clearError(ojsDiv);
              // if the ojsDiv no longer has errors, then we remove the display="none" style
              if (
                (ojsDiv.parentNode.dataset.nodetype !== "expression") &&
                  Array.from(ojsDiv.childNodes).every(
                    n => n.classList.contains("observablehq--inspect"))) {
                // if every child is an inspect output, hide the ojsDiv
                ojsDiv.classList.add("quarto-ojs-hide");
              } 
            }

            that.decorateSource(cellDiv, ojsDiv);
            
            // hide import statements even if output === "all"
            for (const added of mutation.addedNodes) {
              // We search here for code.javascript and node span.hljs-... because
              // at this point in the DOM, observable's runtime hasn't called
              // HLJS yet. if you inspect the DOM yourself, you're likely to see
              // HLJS, so this comment is here to prevent future confusion.
              const result = added.querySelectorAll("code.javascript");
              if (result.length !== 1) {
                continue;
              }
              if (result[0].textContent.trim().startsWith("import")) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
          }

          // cellOutputDisplay doesn't exist in inline spans, so we must check it explicitly
          if (cellOutputDisplay) {
            const children = Array.from(cellOutputDisplay.querySelectorAll("div.observablehq"));
            // after all mutations are handled, we check the full cell for hiding
            if (children.every(n => {
              return n.classList.contains("quarto-ojs-hide");
            })) {
              cellOutputDisplay.classList.add("quarto-ojs-hide");
            } else {
              cellOutputDisplay.classList.remove("quarto-ojs-hide");
            }
          }
        };
        const observer = new MutationObserver(callback);
        // 'element' is the outer div given to observable's runtime to insert their output
        // every quarto cell will have either one or two such divs.
        // The parent of these divs should always be a div corresponding to an ojs "cell"
        // (with ids "ojs-cell-*")
        
        observer.observe(element, config);
        
        element.classList.add(kQuartoModuleWaitClass);

        return new this.inspectorClass(element, ojsAst);
      };
    };
    const runCell = (cell) => {
      const targetElement = typeof elementGetter === "function"
        ? elementGetter()
        : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(
        cellSrc,
        undefined,
        observer(targetElement, cell),
      );
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
}

// here we need to convert from an ES6 module to an observable module
// in, well, a best-effort kind of way.
function es6ImportAsObservableModule(m) {
  return function (runtime, observer) {
    const main = runtime.module();

    Object.keys(m).forEach((key) => {
      const v = m[key];
      main.variable(observer(key)).define(key, [], () => v);
    });

    return main;
  };
}

// this is essentially the import resolution code from observable's
// runtime. we change it to add a license check for permissive
// open-source licenses before resolving the import
async function defaultResolveImportPath(path) {
  const extractPath = (path) => {
    let source = path;
    let m;
    if ((m = /\.js(\?|$)/i.exec(source))) {
      source = source.slice(0, m.index);
    }
    if ((m = /^[0-9a-f]{16}$/i.test(source))) {
      source = `d/${source}`;
    }
    if ((m = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source))) {
      source = source.slice(m[0].length);
    }
    return source;
  };
  const source = extractPath(path);
  const metadataURL = `https://api.observablehq.com/document/${source}`;
  const moduleURL = `https://api.observablehq.com/${source}.js?v=3`;

  // return fetch(metadataURL, { mode: 'no-cors' })
  //   .then(r => r.json())
  //   .then(json => {
  //     if (["isc", "mit", "bsd-3-clause", "apache-2.0"].indexOf(json.license) === -1) {
  //       throw new Error(`Notebook doesn't have a permissive open-source license`);
  //     }
  //     return import(moduleURL);
  //   })
  //   .then(m => m.default);

  const m = await import(moduleURL);
  return m.default;

  /*
  const metadata = await fetch(metadataURL, { mode: 'no-cors' });
  const nbJson = metadata.json();
  if (["isc", "mit", "bsd-3-clause", "apache-2.0"].indexOf(nbJson.license) === -1) {
    throw new Error(`Notebook doesn't have a permissive open-source license`);
  }
  */
  // const m = await import(moduleURL);
  // return m.default;
}

/*
  importPathResolver encodes the rules for quarto ojs to resolve
  import statements. We use the same name from observable's runtime
  (because we need to actually pass this function in as a parameter).
  However, note that the name is misleading. importPathResolver not
  only resolves import paths but performs module imports as well. This
  is useful for us because it allows us to extend the meaning of ojs's
  import statement, but it makes the name confusing.

  Here are the rules for our version of the import statement.

  The function returned by importPathResolver expects a "module specifier", and
  produces a module as defined by observable's runtime.

  ## Local vs remote vs observable imports

  A module specifier is a string, interpreted differently depending on
  the following properties:

  - it starts with "." or "/", in which case we call it a "local module"

  - it is a well-defined absolute URL which does _not_ match the regexp:
    /^https:\/\/(api\.|beta\.|)observablehq\.com\//i
    in which case we call it a "remote import"

  - otherwise, it is an "observable import"

  If the string is an observable import, it behaves exactly like the import
  statement inside observable notebooks (we actually defer to their function
  call.) Otherwise, the import statement first retrieves the text content
  of the resource referenced by the path, and then interprets it.

  ## where resources come from

  When operating in non-self-contained mode, local and remote import
  paths are then interpreted as relative URLs (RFC 1808) with base URL
  window.location (specifically as "relative path" and "absolute path"
  relative URLs).

  In self-contained mode, these paths are interpreted as paths in the
  quarto project, either as root-relative or relative paths. The
  contents of these files are converted to data URLs and stored in a
  local resolution map.

  ## how are contents interpreted

  The contents of the resource are then interpreted differently
  depending on the file type of the requested resource.

  For non-self-contained imports, the file type is determined by the
  extension of the URL pathname. If the extension is "js", we take the
  specifier to mean an ES module; If the extension is "ojs", we take
  the specifier to mean an "ojs" module (a collection of observable
  statements packaged into a module, suitable for reuse). Finally,
  if the extension is "qmd", we take the specifier
  to mean an "implicit ojs module", equivalent to extracting all
  the ojs statements from the .qmd file and producing an OJS module.

  For self-contained imports, the file type is determined by the MIME
  type of the data URL. "application/javascript" is interpreted to
  mean an ES module, and "application/ojs-javascript" is interpreted
  to mean an "ojs" module. (.qmd imports will have been
  translated to ojs modules by the compilation step.)

  The resources are finally retrieved, compiled into modules
  compatible with the observable runtime, and returned as
  the result of the import statement.

*/

function importPathResolver(paths, localResolverMap) {
  // NB: only resolve the field values in paths when calling rootPath
  // and relativePath. If we prematurely optimize this by moving the
  // const declarations outside, then we will capture the
  // uninitialized values.

  // fetch() and import() have different relative path semantics, so
  // we need different paths for each use case

  function importRootPath(path) {
    const { runtimeToRoot } = paths;
    if (!runtimeToRoot) {
      return path;
    } else {
      return `${runtimeToRoot}/${path}`;
    }
  }

  function importRelativePath(path) {
    const { runtimeToDoc } = paths;
    if (!runtimeToDoc) {
      return path;
    } else {
      return `${runtimeToDoc}/${path}`;
    }
  }

  // a fetch path of a root-relative path is resolved wrt to
  // the document root
  function fetchRootPath(path) {
    const { docToRoot } = paths;
    if (!docToRoot) {
      return path;
    } else {
      return `${docToRoot}/${path}`;
    }
  }

  // a fetch path of a relative path is resolved the naive way
  function fetchRelativePath(path) {
    return path;
  }

  return (path) => {
    const isLocalModule = path.startsWith("/") || path.startsWith(".");
    const isImportFromObservableWebsite = path.match(
      /^https:\/\/(api\.|beta\.|)observablehq\.com\//i,
    );

    if (!isLocalModule || isImportFromObservableWebsite) {
      return defaultResolveImportPath(path);
    }

    let importPath, fetchPath;
    let moduleType;
    if (window._ojs.selfContained) {
      const resolved = localResolverMap.get(path);
      if (resolved === undefined) {
        throw new Error(`missing local file ${path} in self-contained mode`);
      }
      // self-contained resolves to data URLs, so they behave the same.
      importPath = resolved;
      fetchPath = resolved;

      // we have a data URL here.
      const mimeType = resolved.match(/data:(.*);base64/)[1];
      switch (mimeType) {
        case "application/javascript":
          moduleType = "js";
          break;
        case "application/ojs-javascript":
          moduleType = "ojs";
          break;
        default:
          throw new Error(`unrecognized MIME type ${mimeType}`);
      }
    } else {
      // we have a relative URL here
      const resourceURL = new URL(path, window.location);
      moduleType = resourceURL.pathname.match(/\.(ojs|js|qmd)$/)[1];

      // resolve path according to quarto path resolution rules.
      if (path.startsWith("/")) {
        importPath = importRootPath(path);
        fetchPath = fetchRootPath(path);
      } else {
        importPath = importRelativePath(path);
        fetchPath = fetchRelativePath(path);
      }
    }

    if (moduleType === "js") {
      return import(importPath).then((m) => es6ImportAsObservableModule(m));
    } else if (moduleType === "ojs") {
      return importOjsFromURL(fetchPath);
    } else if (moduleType === "qmd") {
      const htmlPath = `${fetchPath.slice(0, -4)}.html`;
      return fetch(htmlPath)
        .then((response) => response.text())
        .then(createOjsModuleFromHTMLSrc);
    } else {
      throw new Error(`internal error, unrecognized module type ${moduleType}`);
    }
  };
}

function createOjsModuleFromHTMLSrc(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const staticDefns = [];
  for (const el of doc.querySelectorAll('script[type="ojs-define"]')) {
    staticDefns.push(el.text);
  }
  const ojsSource = [];
  for (
    const content of doc.querySelectorAll('script[type="ojs-module-contents"]')
  ) {
    for (const cell of JSON.parse(content.text).contents) {
      ojsSource.push(cell.source);
    }
  }
  return createOjsModuleFromSrc(ojsSource.join("\n"), staticDefns);
}

function createOjsModuleFromSrc(src, staticDefns = []) {
  return (runtime, _observer) => {
    const newModule = runtime.module();
    const interpreter = window._ojs.ojsConnector.interpreter;
    const _cells = interpreter.module(
      src,
      newModule,
      (_name) => new EmptyInspector(),
    );
    for (const defn of staticDefns) {
      for (const { name, value } of JSON.parse(defn).contents) {
        window._ojs.ojsConnector.define(name, newModule)(value);
      }
    }
    return newModule;
  };
}

/*
 * Given a URL, fetches the text content and creates a new observable module
 * exporting all of the names as variables
 */
async function importOjsFromURL(path) {
  const r = await fetch(path);
  const src = await r.text();
  return createOjsModuleFromSrc(src);
}

//////////////////////////////////////////////////////////////////////////////
// previously quarto-observable-shiny.js

const shinyInputVars = new Set();
let shinyInitialValue = {};

export function extendObservableStdlib(lib) {
  class NamedVariableOutputBinding extends Shiny.OutputBinding {
    constructor(name, change) {
      super();
      this._name = name;
      this._change = change;
    }
    find(scope) {
      return $(scope).find("#" + this._name);
    }
    getId(el) {
      return el.id;
    }
    renderValue(_el, data) {
      this._change(data);
    }
    onValueError(el, err) {
      const group = `Shiny error in ${el.id}`;
      console.groupCollapsed(`%c${group}`, "color:red");
      console.log(`${err.message}`);
      console.log(`call: ${err.call}`);
      console.groupEnd(group);
    }
  }

  $(document).on("shiny:connected", function (_event) {
    Object.entries(shinyInitialValue).map(([k, v]) => {
      window.Shiny.setInputValue(k, v);
    });
    shinyInitialValue = {};
  });

  lib.shinyInput = function () {
    return (name) => {
      shinyInputVars.add(name);
      window._ojs.ojsConnector.mainModule.value(name)
        .then((val) => {
          if (window.Shiny && window.Shiny.setInputValue) {
            window.Shiny.setInputValue(name, val);
          } else {
            shinyInitialValue[name] = val;
          }
        });
    };
  };

  lib.shinyOutput = function () {
    return function (name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("ojs-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(
          new NamedVariableOutputBinding(name, change),
        );
      });
    };
  };
}

export class QuartoInspector extends Inspector {
  constructor(node, cellAst) {
    super(node);
    this._cellAst = cellAst;
  }
  rejected(error) {
    return super.rejected(error);
  }
}

export class ShinyInspector extends QuartoInspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      if (window.Shiny.setInputValue === undefined) {
        shinyInitialValue[name] = value;
      } else {
        window.Shiny.setInputValue(name, value);
      }
    }
    return super.fulfilled(value, name);
  }
}

const { Generators } = new Library();

class OjsButtonInput /*extends ShinyInput*/ {
  find(_scope) {
    return document.querySelectorAll(".ojs-inputs-button");
  }

  init(el, change) {
    const btn = button(el.textContent);
    el.innerHTML = "";
    el.appendChild(btn);

    const obs = Generators.input(el.firstChild);
    (async function () {
      // throw away the first value, it doesn't count for buttons
      await obs.next().value;
      for (const x of obs) {
        change(await x);
      }
    })();
    // TODO: error handling

    return {
      onSetValue: (_value) => {
      },
      dispose: () => {
        obs.return();
      },
    };
  }
}

export function initOjsShinyRuntime() {
  const valueSym = Symbol("value");
  const callbackSym = Symbol("callback");
  const instanceSym = Symbol("instance");
  // const values = new WeakMap(); // unused?

  class BindingAdapter extends Shiny.InputBinding {
    constructor(x) {
      super();
      this.x = x;
    }

    find(scope) {
      const matches = this.x.find(scope);
      return $(matches);
    }
    getId(el) {
      if (this.x.getId) {
        return this.x.getId(el);
      } else {
        return super.getId(el);
      }
    }
    initialize(el) {
      const changeHandler = (value) => {
        el[valueSym] = value;
        el[callbackSym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[instanceSym] = instance;
    }
    getValue(el) {
      return el[valueSym];
    }
    setValue(el, value) {
      el[valueSym] = value;
      el[instanceSym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[callbackSym] = callback;
    }
    unsubscribe(el) {
      el[instanceSym].dispose();
    }
  }

  class InspectorOutputBinding extends Shiny.OutputBinding {
    find(scope) {
      return $(scope).find(".observablehq-inspector");
    }
    getId(el) {
      return el.id;
    }
    renderValue(el, data) {
      (new Inspector(el)).fulfilled(data);
    }
  }

  if (window.Shiny === undefined) {
    console.warn("Shiny runtime not found; Shiny features won't work.");
    return false;
  }

  Shiny.inputBindings.register(new BindingAdapter(new OjsButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());

  // Handle requests from the server to export Shiny outputs to ojs.
  Shiny.addCustomMessageHandler("ojs-export", ({ name }) => {
    window._ojs.ojsConnector.mainModule.redefine(
      name,
      window._ojs.ojsConnector.library.shinyOutput()(name),
    );
    // shinyOutput() creates an output DOM element, but we have to cause it to
    // be actually bound. I don't love this code being here, I'd prefer if we
    // could receive Shiny outputs without using output bindings at all (for
    // this case, not for things that truly are DOM-oriented outputs).
    Shiny.bindAll(document.body);
  });

  return true;
}

//////////////////////////////////////////////////////////////////////////////

export function createRuntime() {
  const quartoOjsGlobal = window._ojs;
  const isShiny = window.Shiny !== undefined;

  // Are we shiny?
  if (isShiny) {
    quartoOjsGlobal.hasShiny = true;
    initOjsShinyRuntime();

    const span = document.createElement("span");
    window._ojs.shinyElementRoot = span;
    document.body.appendChild(span);
  }

  // we use the trick described here to extend observable runtime's standard library
  // https://talk.observablehq.com/t/embedded-width/1063

  // stdlib from our fork, which uses the safe d3-require
  const lib = new Library();
  if (isShiny) {
    extendObservableStdlib(lib);
  }

  function transpose(df) {
    const keys = Object.keys(df);
    return df[keys[0]]
      .map((v, i) => Object.fromEntries(keys.map(key => [key, df[key][i] || undefined])))
      .filter(v => Object.values(v).every(e => e !== undefined));
  }
  lib.transpose = () => transpose;
  
  const mainEl = document.querySelector("main");
  function width() {
    return lib.Generators.observe(function (change) {
      var width = change(mainEl.clientWidth);
      function resized() {
        var w = mainEl.clientWidth;
        if (w !== width) change(width = w);
      }
      window.addEventListener("resize", resized);
      return function () {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.width = width;

  // select all panel elements with ids
  const layoutDivs = Array.from(
    document.querySelectorAll("div.quarto-layout-panel div[id]"),
  );
  function layoutWidth() {
    return lib.Generators.observe(function (change) {
      const ourWidths = Object.fromEntries(
        layoutDivs.map((div) => [div.id, div.clientWidth]),
      );
      change(ourWidths);
      function resized() {
        let changed = false;
        for (const div of layoutDivs) {
          const w = div.clientWidth;
          if (w !== ourWidths[div.id]) {
            ourWidths[div.id] = w;
            changed = true;
          }
        }
        if (changed) {
          change(ourWidths);
        }
      }
      window.addEventListener("resize", resized);
      return function () {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.layoutWidth = layoutWidth;
  let localResolver = {};

  function fileAttachmentPathResolver(n) {
    if (localResolver[n]) {
      return localResolver[n];
    }

    if (n.startsWith("/")) {
      // docToRoot can be empty, in which case naive concatenation creates
      // an absolute path.
      if (quartoOjsGlobal.paths.docToRoot === "") {
        return `.${n}`;
      } else {
        return `${quartoOjsGlobal.paths.docToRoot}${n}`;
      }
    } else {
      return n;
    }
  }
  lib.FileAttachment = () => FileAttachments(fileAttachmentPathResolver);

  const ojsConnector = new OJSConnector({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : QuartoInspector,
    library: lib,
    allowPendingGlobals: isShiny,
  });
  quartoOjsGlobal.ojsConnector = ojsConnector;
  if (isShiny) {
    // When isShiny, OJSConnector is constructed with allowPendingGlobals:true.
    // Our guess is that most shiny-to-ojs exports will have been defined
    // by the time the server function finishes executing (i.e. session init
    // completion); so we call `killPendingGlobals()` to show errors for
    // variables that are still undefined.
    $(document).one("shiny:idle", () => {
      // "shiny:idle" is not late enough; it is raised before the resulting
      // outputs are received from the server.
      $(document).one("shiny:message", () => {
        // "shiny:message" is not late enough; it is raised after the message
        // is received, but before it is processed (i.e. variables are still
        // not actually defined).
        setTimeout(() => {
          ojsConnector.killPendingGlobals();
        }, 0);
      });
    });
  }

  const subfigIdMap = new Map();
  function getSubfigId(elementId) {
    if (!subfigIdMap.has(elementId)) {
      subfigIdMap.set(elementId, 0);
    }
    let nextIx = subfigIdMap.get(elementId);
    nextIx++;
    subfigIdMap.set(elementId, nextIx);
    return `${elementId}-${nextIx}`;
  }

  const sourceNodes = document.querySelectorAll("pre.sourceCode code.sourceCode");
  const decorators = Array.from(sourceNodes)
        .map(n => {
          n = n.parentElement;
          const decorator = new PandocCodeDecorator(n);
          n._decorator = decorator;
          return decorator;
        });
  // handle build-time syntax error
  decorators.forEach(n => {
    if (n._node.parentElement.dataset.syntaxErrorPosition === undefined) {
      return;
    }
    const offset = Number(n._node.parentElement.dataset.syntaxErrorPosition);
    n.decorateSpan(offset, offset+1, ["quarto-ojs-error-pinpoint"]);
  });
  
  const result = {
    setLocalResolver(obj) {
      localResolver = obj;
      ojsConnector.setLocalResolver(obj);
    },
    finishInterpreting() {
      return ojsConnector.finishInterpreting();
    },

    // return the latest value of the named reactive variable in the main module
    async value(name) {
      await this.finishInterpreting();
      const result = await ojsConnector.value(name);
      return result;
      // return this.finishInterpreting()
      //   .then(() => {
      //     return ojsConnector.value(name);
      //   });
    },

    // fixme clarify what's the expected behavior of the 'error' option
    // when evaluation is at client-time
    interpretLenient(src, targetElementId, inline) {
      return result.interpret(src, targetElementId, inline)
        .catch(() => {});
    },
    interpret(src, targetElementId, inline) {
      const getElement = () => {
        let targetElement = document.getElementById(targetElementId);
        if (!targetElement) {
          // this is a subfigure
          targetElement = document.getElementById(getSubfigId(targetElementId));
          if (!targetElement) {
            console.error("Ran out of subfigures for element", targetElementId);
            console.error("This will fail.");
            throw new Error("Ran out of quarto subfigures.");
          }
        }
        return targetElement;
      };

      const makeElement = () => {
        return document.createElement(
          inline ? "span" : "div",
        );
      };

      return ojsConnector.interpret(src, getElement, makeElement)
        .catch((e) => {
          const errorDiv = document.createElement("pre");
          errorDiv.innerText = `${e.name}: ${e.message}`;
          getElement().append(errorDiv);
          return e;
        });
    },
    interpretQuiet(src) {
      return ojsConnector.interpretQuiet(src);
    },
    interpretFromScriptTags() {
      // source definitions
      for (
        const el of document.querySelectorAll(
          "script[type='ojs-module-contents']",
        )
      ) {
        for (const call of JSON.parse(el.text).contents) {
          switch (call.methodName) {
            case "interpret":
              this.interpret(call.source, call.cellName, call.inline);
              break;
            case "interpretLenient":
              this.interpretLenient(call.source, call.cellName, call.inline);
              break;
            case "interpretQuiet":
              this.interpretQuiet(call.source);
              break;
            default:
              throw new Error(
                `Don't know how to call method ${call.methodName}`,
              );
          }
        }
      }

      // static data definitions
      for (
        const el of document.querySelectorAll(
          "script[type='ojs-define']",
        )
      ) {
        for (const { name, value } of JSON.parse(el.text).contents) {
          ojsConnector.define(name)(value);
        }
      }
    },
  };

  return result;
}

// FIXME: "obs" or "ojs"? Inconsistent naming.
window._ojs = {
  ojsConnector: undefined,

  paths: {}, // placeholder for per-quarto-file paths
  // necessary for module resolution

  hasShiny: false, // true if we have the quarto-ojs-shiny runtime

  shinyElementRoot: undefined, // root element for the communication with shiny
  // via DOM
};
window._ojs.runtime = createRuntime();
