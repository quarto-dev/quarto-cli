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
    interpret(src, targetElementId, inline) {
      debugger;
      let observer = () => {
        debugger;
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
        return new Inspector(
          targetElement.appendChild(document.createElement(
            inline
              ? "span"
              : "div",
          )),
        );
      };

      let parse = parseModule(src);
      function cellSrc(cell) {
        return src.slice(cell.start, cell.end);
      }
      let results = parse.cells.map(cellSrc).map((s) =>
        interpreter.module(s, undefined, observer)
      );
      return Promise.all(results);
    },
    //   for (const src of src.cells) {
    //   }
    //   console.log(src, parseModule(src));
    //   debugger;
    //   let result = await interpreter.module(src, undefined, observer);
    //   return result;
    // }
  };

  return result;
}

window._ojsRuntime = createRuntime();
