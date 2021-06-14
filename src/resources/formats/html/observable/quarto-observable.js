import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
  Library,
  Runtime,
} from "https://cdn.skypack.dev/@observablehq/runtime";
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";

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
  
  const runtime = new Runtime(lib);
  const mainMod = runtime.module();

  const interpreter = new Interpreter({ module: mainMod });

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

          // HACK: the unofficial interpreter always calls viewexpression observers
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

window._ojsRuntime = createRuntime();
