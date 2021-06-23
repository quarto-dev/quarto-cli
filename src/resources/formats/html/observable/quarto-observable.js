import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
  Library,
  Runtime,
} from "https://cdn.skypack.dev/@observablehq/runtime";
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";
import { FileAttachments } from "https://cdn.skypack.dev/@observablehq/stdlib";

import {
  ShinyInspector,
  extendObservableStdlib,
  initObservableShinyRuntime
} from "./quarto-observable-shiny.js";

// we use the trick described here to extend observable's standard library
// https://talk.observablehq.com/t/embedded-width/1063
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
  
  const lib = new Library();
  const mainEl = document.querySelector("main");
  function width() {
    return lib.Generators.observe(function(change) {
      var width = change(mainEl.clientWidth);
      function resized() {
        var w = mainEl.clientWidth;
        if (w !== width) change(width = w);
      }
      window.addEventListener("resize", resized);
      return function() {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.width = width;

  if (isShiny) {
    extendObservableStdlib(lib);
  }
  
  // select all panel elements with ids 
  const layoutDivs = Array.from(document.querySelectorAll("div.quarto-layout-panel div[id]"));

  // add a new function to our stdlib (!)
  function layoutWidth() {
    return lib.Generators.observe(function(change) {
      const ourWidths = Object.fromEntries(layoutDivs.map(div => [div.id, div.clientWidth]));
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
      return function() {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.layoutWidth = layoutWidth;

  // we think this is good enough for now, but there
  // might be better things to be done with (say) project-wide
  // resources.
  function fileAttachmentPathResolver(n) {
    return n;
  }

  // We support ES6 modules by checking the path for ES6-style module
  // imports
  function importPathResolver(path) {
    if (path.startsWith("/")) {
      return import(`${window._ojs.paths.runtimeToRoot}/${path}`).then((m) => {
        return es6ImportAsObservable(m);
      });
    } else if (path.startsWith(".")) {
      return import(`${window._ojs.paths.runtimeToDoc}/${path}`).then((m) => {
        return es6ImportAsObservable(m);
      });
    } else {
      return defaultResolveImportPath(path);
    }
  }

  lib.FileAttachment = () => FileAttachments(fileAttachmentPathResolver);
  
  const runtime = new Runtime(lib);

  const mainMod = runtime.module();
  window._ojs.mainModule = mainMod;
  window._ojs.observableRuntime = runtime;

  const interpreter = new Interpreter({
    module: mainMod,
    resolveImportPath: importPathResolver
  });

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
    interpretLenient(src, targetElementId, inline) {
      return result.interpret(src, targetElementId, inline, true);
    },
    interpret(src, targetElementId, inline, catchErrors = false) {
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
      const observer = function(targetElement, cell) {
        return (name) => {
          const element = document.createElement(
            inline
              ? "span"
              : "div"
          );
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
          if (isShiny) {
            return new ShinyInspector(element);
          } else {
            return new Inspector(element);
          }
        };
      };

      // FIXME error handling is clearly not going to work well right
      // now. at the very least we need to handle more than just
      // syntax errors, and we need to make sure subfigures are
      // handled correctly.
      let parse;
      if (catchErrors) {
        try {
          parse = parseModule(src);
        } catch (e) {
          let errorDiv = document.createElement("pre");
          errorDiv.innerText = `${e.name}: ${e.message}`;
          getElement().append(errorDiv);
        }
      } else {
        parse = parseModule(src);
      }
      function cellSrc(cell) {
        let targetElement = getElement();
        let cellSrc = src.slice(cell.start, cell.end);
        return interpreter.module(cellSrc, undefined, observer(targetElement, cell));
      }
      return Promise.all(parse.cells.map(cellSrc));
    },
  };

  return result;
}

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

window._ojs = {
  observableRuntime: undefined, // the Runtime object from observableHQ
  runtime: undefined,           // the result from `createRuntime` above

  paths: {},                    // placeholder for per-quarto-file paths
                                // necessary for module resolution

  mainModule: undefined,        // observablehq's module object for the page's
                                // main module

  hasShiny: false,              // true if we have the quarto-ojs-shiny runtime
  
  shinyElementRoot: undefined,  // root element for the communication with shiny
                                // via DOM
};
window._ojs.runtime = createRuntime();

