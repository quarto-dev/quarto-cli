/*global Shiny, $, DOMParser, MutationObserver, URL
*
* ojs-connector.js
*
* Copyright (C) 2021 RStudio, PBC
*
*/

import {
  Interpreter
} from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler@0.6.0-alpha.9";

import {
  Inspector,
  Runtime,
  RuntimeError,
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";

// we vendor this for now since they dropped parseModule
import {
  parseModule
} from "./observablehq-parser.js";

import {
  FileAttachments, Library
} from "./stdlib.js";

//////////////////////////////////////////////////////////////////////////////

class EmptyInspector {
  pending() {
  }
  fulfilled(_value, _name) {
  }
  rejected(_error, _name) {
    // TODO we should probably communicate this upstream somehow.
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

  /* TODO This should be the implementation we use, once/if observable
  starts reporting notebook license on their metadata.

  const metadata = await fetch(metadataURL, { mode: 'no-cors' });
  const nbJson = metadata.json();
  if (["isc", "mit", "bsd-3-clause", "apache-2.0"].indexOf(nbJson.license) === -1) {
    throw new Error(`Notebook doesn't have a permissive open-source license`);
  } */

  const m = await import(moduleURL);
  return m.default;
}

/*
  importPathResolver encodes the rules for ojsconnector to resolve
  import statements. 

  This code doesn't depend have any dependencies on quarto, but some
  of the decisions here are influence by the needs of the quarto
  system.

  We use the same name from observable's runtime so the intended
  functionality is clear.  However, note that their name is slightly
  misleading. importPathResolver not only resolves import paths but
  performs module imports as well. This is useful for us because it
  allows us to extend the meaning of ojs's import statement, but it
  makes the name confusing.

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

  return async (path) => {
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
      try {
        const m = await import(importPath);
        return es6ImportAsObservableModule(m);
      } catch (e) {
        // record the error on the browser console to make debugging
        // slightly more convenient.
        console.error(e);
        throw e;
      }
    } else if (moduleType === "ojs") {
      return importOjsFromURL(fetchPath);
    } else if (moduleType === "qmd") {
      const htmlPath = `${fetchPath.slice(0, -4)}.html`;
      const response = await fetch(htmlPath);
      const text = await response.text();
      return createOjsModuleFromHTMLSrc(text);
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
      this.pendingGlobals[name] = info;
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
      // TODO do something about destruction
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

  finishInterpreting() {
    return Promise.all(this.chunkPromises);
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
};
