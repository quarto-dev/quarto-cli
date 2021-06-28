/*
* observable-in-a-box.js
*
* Copyright (C) 2021 RStudio, PBC
*
* a minimal wrapper around ObservableHQ's runtime, aimed at making
* language interop (a bit) simpler, and isolating our interaction with
* their features (a bit).
*
* We extend the semantics of ObservableJS (a bit) to support some
* extra necessities. These are, for now:
*
* - importing regular ES6 modules and converting them to OJS modules
*   so plain ES6 modules can be used alongside observable.
*
*/

import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
  Library,
  Runtime,
} from "https://cdn.skypack.dev/@observablehq/runtime";
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";

export class OJSInABox {
  
  constructor({
    paths,
    inspectorClass,
    library,
  }) {
    paths = paths || {
      runtimeToRoot: "",
      runtimeToDoc: ""
    };

    this.library = library || new Library();
    // NB it looks like Runtime makes a local copy of the library object,
    // such that mutating library after this is initializaed doesn't actually
    // work.
    this.runtime = new Runtime(this.library);
    this.mainModule = this.runtime.module();
    this.interpreter = new Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths)
    });
    this.inspectorClass = inspectorClass || Inspector;

    // state to handle flash of unevaluated js because of async module imports
    this.mainModuleHasImports = false;
    this.mainModuleOutstandingImportCount = 0;
    this.chunkPromises = [];
  }

  define(name, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    let change;
    const obs = this.library.Generators.observe(change_ => {
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
      fulfilled: x => k(x, name)
    }).define([name], val => val);
  }

  clearImportModuleWait() {
    const array = Array.from(document.querySelectorAll('.observable-in-a-box-waiting-for-module-import'));
    for (const node of array) {
      node.classList.remove('observable-in-a-box-waiting-for-module-import');
    }
  }
  
  finishInterpreting() {
    Promise.all(this.chunkPromises)
      .then(() => {
        if (!this.mainModuleHasImports) {
          this.clearImportModuleWait();
        }
      });
  }
  
  interpret(src, elementGetter, elementCreator) {
    const observer = (targetElement, cell) => {
      return (name) => {
        const element = typeof elementCreator === "function" ?
              elementCreator() : elementCreator;
        targetElement.appendChild(element);

        // FIXME the unofficial interpreter always calls viewexpression observers
        // twice, one with the name, and the next with 'viewof $name'.
        // we check for 'viewof ' here and hide the element we're creating.
        // this behavior appears inconsistent with OHQ's interpreter, so we
        // shouldn't be surprised to see this fail in the future.
        if (cell.id?.type === 'ViewExpression' &&
            !name.startsWith('viewof ')) {
          element.style.display = "none";
        }

        element.classList.add('observable-in-a-box-waiting-for-module-import');

        return new this.inspectorClass(element);
      };
    };
    const runCell = (cell) => {
      const targetElement = typeof elementGetter === "function" ?
            elementGetter() : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      let promise = this.interpreter.module(cellSrc, undefined, observer(targetElement, cell));
      if (cell.body.type === "ImportDeclaration") {
        this.mainModuleHasImports = true;
        this.mainModuleOutstandingImportCount++;
        promise = promise.then(result => {
          this.mainModuleOutstandingImportCount--;
          if (this.mainModuleOutstandingImportCount === 0) {
            this.clearImportModuleWait();
          }
          return result;
        });
      }
      return promise;
    };

    let parse;
    try {
      parse = parseModule(src);
    } catch (error) {
      return Promise.reject(error);
    }

    const chunkPromise = Promise.all(parse.cells.map(runCell));
    this.chunkPromises.push(chunkPromise);
    return chunkPromise;
  }
}

// here we need to convert from an ES6 module to an ObservableHQ module
// in, well, a best-effort kind of way.
function es6ImportAsObservable(m)
{
  return function(runtime, observer) {
    const main = runtime.module();

    Object.keys(m).forEach(key => {
      const v = m[key];
      main.variable(observer(key)).define(key, [], () => v);
    });
    
    return main;
  };
}


// this is Observable's import resolution
function defaultResolveImportPath(path) {
  const extractPath = (path) => {
    let source = path;
    let m;
    if ((m = /\.js(\?|$)/i.exec(source)))
      source = source.slice(0, m.index);
    if ((m = /^[0-9a-f]{16}$/i.test(source)))
      source = `d/${source}`;
    if ((m = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source)))
      source = source.slice(m[0].length);
    return source;
  };
  const source = extractPath(path);
  return import(`https://api.observablehq.com/${source}.js?v=3`).then((m) => {
    return m.default;
  });
}

function importPathResolver(paths) {
  const {
    runtimeToRoot,
    runtimeToDoc
  } = paths;

  function rootPath(path) {
    if (runtimeToRoot === "") {
      return path;
    } else {
      return `${runtimeToRoot}/${path}`;
    }
  }

  function relativePath(path) {
    if (runtimeToDoc === "") {
      return path;
    } else {
      return `${runtimeToDoc}/${path}`;
    }
  }
  
  return (path) => {
    if (path.startsWith("/")) {
      return import(rootPath(path)).then((m) => {
        return es6ImportAsObservable(m);
      });
    } else if (path.startsWith(".")) {
      return import(relativePath(path)).then((m) => {
        return es6ImportAsObservable(m);
      });
    } else {
      return defaultResolveImportPath(path);
    }
  };
}
