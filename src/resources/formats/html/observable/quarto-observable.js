import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
  Library,
  Runtime,
} from "https://cdn.skypack.dev/@observablehq/runtime";
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";
import { FileAttachments } from "https://cdn.skypack.dev/@observablehq/stdlib";

function createOJSSourceElement(el, src) {
  let sourceEl = document.createElement("pre");
  sourceEl.setAttribute("class", "ojs-source");
  sourceEl.innerText = src.trim();
  el.appendChild(sourceEl);
  return sourceEl;
}

export function createRuntime() {
  // we're using the trick described here:
  // https://talk.observablehq.com/t/embedded-width/1063
  
  let lib = new Library();
  let mainEl = document.querySelector("main");
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

  // select all panel elements with ids 
  let layoutDivs = Array.from(document.querySelectorAll("div.quarto-layout-panel div[id]"));

  // add a new function to our stdlib (!)
  function layoutWidth() {
    return lib.Generators.observe(function(change) {
      let ourWidths = Object.fromEntries(layoutDivs.map(div => [div.id, div.clientWidth]));
      change(ourWidths);
      function resized() {
        let changed = false;
        for (const div of layoutDivs) {
          let w = div.clientWidth;          
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

  let result = {
    interpretLenient(src, targetElementId, inline) {
      return result.interpretLenient(src, targetElementId, inline, true);
    },
    interpret(src, targetElementId, inline, catchErrors = false) {
      let getElement = () => {
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
      let observer = function(targetElement, cell) {
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
          return new Inspector(element);
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
      let v = m[key];
      main.variable(observer(key)).define(key, [], () => v);
    });
    
    return main;
  };
}

window._ojs = {
  runtime: createRuntime(),
  paths: {}
};


