import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
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
  const runtime = new Runtime();
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
      let observer = () => {
        let targetElement = getElement();
        return new Inspector(
          targetElement.appendChild(document.createElement(
            inline
              ? "span"
              : "div",
          )),
        );
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
        return src.slice(cell.start, cell.end);
      }
      let results = parse.cells.map(cellSrc).map((s) =>
        interpreter.module(s, undefined, observer)
      );
      return Promise.all(results);
    },
  };

  return result;
}

window._ojsRuntime = createRuntime();
