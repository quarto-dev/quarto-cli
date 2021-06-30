/*global Shiny, $
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

import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import { FileAttachments } from "https://cdn.skypack.dev/@observablehq/stdlib";
import {
  Inspector,
  Library,
  Runtime,
} from "https://cdn.skypack.dev/@observablehq/runtime";
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";
import { button } from "https://cdn.skypack.dev/@observablehq/inputs";

//////////////////////////////////////////////////////////////////////////////
// previously observable-in-a-box.js

export class OJSInABox {
  constructor({
    paths,
    inspectorClass,
    library,
  }) {
    this.library = library || new Library();
    // NB it looks like Runtime makes a local copy of the library object,
    // such that mutating library after this is initializaed doesn't actually
    // work.
    this.runtime = new Runtime(this.library);
    this.mainModule = this.runtime.module();
    this.interpreter = new Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths),
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

  clearImportModuleWait() {
    const array = Array.from(
      document.querySelectorAll(
        ".observable-in-a-box-waiting-for-module-import",
      ),
    );
    for (const node of array) {
      node.classList.remove("observable-in-a-box-waiting-for-module-import");
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
          cell.id?.type === "ViewExpression" &&
          !name.startsWith("viewof ")
        ) {
          element.style.display = "none";
        }

        element.classList.add("observable-in-a-box-waiting-for-module-import");

        return new this.inspectorClass(element);
      };
    };
    const runCell = (cell) => {
      const targetElement = typeof elementGetter === "function"
        ? elementGetter()
        : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      let promise = this.interpreter.module(
        cellSrc,
        undefined,
        observer(targetElement, cell),
      );
      if (cell.body.type === "ImportDeclaration") {
        this.mainModuleHasImports = true;
        this.mainModuleOutstandingImportCount++;
        promise = promise.then((result) => {
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
function es6ImportAsObservable(m) {
  return function (runtime, observer) {
    const main = runtime.module();

    Object.keys(m).forEach((key) => {
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
  return import(`https://api.observablehq.com/${source}.js?v=3`).then((m) => {
    return m.default;
  });
}

function importPathResolver(paths) {
  // NB: only resolve the field values in paths when calling rootPath
  // and relativePath. If we prematurely optimize this by moving the
  // const declarations outside, then we will capture the
  // uninitialized values.

  function rootPath(path) {
    const { runtimeToRoot } = paths;
    if (!runtimeToRoot) {
      return path;
    } else {
      return `${runtimeToRoot}/${path}`;
    }
  }

  function relativePath(path) {
    const { runtimeToDoc } = paths;
    if (!runtimeToDoc) {
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

//////////////////////////////////////////////////////////////////////////////
// previously quarto-observable-shiny.js

const shinyInputVars = new Set();

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
  }

  lib.shinyInput = function () {
    return (name) => {
      shinyInputVars.add(name);
    };
  };

  lib.shinyOutput = function () {
    return function (name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("observablehq-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(
          new NamedVariableOutputBinding(name, change),
        );
      });
    };
  };
}

export class ShinyInspector extends Inspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      window.Shiny.setInputValue(name, value);
    }
    return super.fulfilled(value, name);
  }
}

const { Generators } = new Library();

class ObservableButtonInput /*extends ShinyInput*/ {
  find(_scope) {
    return document.querySelectorAll(".observablehq-inputs-button");
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

export function initObservableShinyRuntime() {
  class BindingAdapter extends Shiny.InputBinding {
    static value_sym = Symbol("value");
    static callback_sym = Symbol("callback");
    static instance_sym = Symbol("instance");
    static values = new WeakMap();

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
        el[BindingAdapter.value_sym] = value;
        el[BindingAdapter.callback_sym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[BindingAdapter.instance_sym] = instance;
    }
    getValue(el) {
      return el[BindingAdapter.value_sym];
    }
    setValue(el, value) {
      el[BindingAdapter.value_sym] = value;
      el[BindingAdapter.instance_sym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[BindingAdapter.callback_sym] = callback;
    }
    unsubscribe(el) {
      el[BindingAdapter.instance_sym].dispose();
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

  Shiny.inputBindings.register(new BindingAdapter(new ObservableButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());

  return true;
}

//////////////////////////////////////////////////////////////////////////////
// previously quarto-observable.js

export function createRuntime() {
  const quartoOjsGlobal = window._ojs;
  const isShiny = window.Shiny !== undefined;

  // Are we shiny?
  if (isShiny) {
    quartoOjsGlobal.hasShiny = true;
    initObservableShinyRuntime();

    const span = document.createElement("span");
    window._ojs.shinyElementRoot = span;
    document.body.appendChild(span);
  }

  // we use the trick described here to extend observable's standard library
  // https://talk.observablehq.com/t/embedded-width/1063

  // our stdlib
  const lib = new Library();
  if (isShiny) {
    extendObservableStdlib(lib);
  }

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

  function fileAttachmentPathResolver(n) {
    if (n.startsWith('/')) {
      return `${quartoOjsGlobal.paths.docToRoot}${n}`;
    } else {
      return n;
    }
  }
  lib.FileAttachment = () => FileAttachments(fileAttachmentPathResolver);

  const obsInABox = new OJSInABox({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : undefined,
    library: lib,
  });
  quartoOjsGlobal.obsInABox = obsInABox;

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

  const result = {
    finishInterpreting() {
      obsInABox.finishInterpreting();
    },

    // FIXME clarify what's the expected behavior of the 'error' option
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

      return obsInABox.interpret(src, getElement, makeElement)
        .catch((e) => {
          const errorDiv = document.createElement("pre");
          errorDiv.innerText = `${e.name}: ${e.message}`;
          getElement().append(errorDiv);
          return e;
        });
    },
  };

  return result;
}

// FIXME: "obs" or "ojs"? Inconsistent naming.
window._ojs = {
  obsInABox: undefined,

  paths: {}, // placeholder for per-quarto-file paths
  // necessary for module resolution

  hasShiny: false, // true if we have the quarto-ojs-shiny runtime

  shinyElementRoot: undefined, // root element for the communication with shiny
  // via DOM
};
window._ojs.runtime = createRuntime();
