import {
  Inspector,
  Library,
  Runtime,
} from "https://cdn.skypack.dev/@observablehq/runtime";

import { FileAttachments } from "https://cdn.skypack.dev/@observablehq/stdlib";

import {
  ShinyInspector,
  extendObservableStdlib,
  initObservableShinyRuntime
} from "./quarto-observable-shiny.js";

import { OJSInABox } from "./observable-in-a-box.js";

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
  const layoutDivs = Array.from(document.querySelectorAll("div.quarto-layout-panel div[id]"));
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

  // this path resolution is fairly naive, but we think this is good
  // enough for now. There might be better things to be done with
  // (say) project-wide resources.
  function fileAttachmentPathResolver(n) {
    return n;
  }
  lib.FileAttachment = () => FileAttachments(fileAttachmentPathResolver);

  const obsInABox = new OJSInABox({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : undefined,
    library: lib
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
          inline
            ? "span"
            : "div"
        );
      };
      
      return obsInABox.interpret(src, getElement, makeElement)
        .catch(e => {
          let errorDiv = document.createElement("pre");
          errorDiv.innerText = `${e.name}: ${e.message}`;
          getElement().append(errorDiv);
          return e;
        });
    }
  };

  return result;
}

window._ojs = {
  obsInABox: undefined,
  
  paths: {},                    // placeholder for per-quarto-file paths
                                // necessary for module resolution

  hasShiny: false,              // true if we have the quarto-ojs-shiny runtime
  
  shinyElementRoot: undefined,  // root element for the communication with shiny
                                // via DOM
};
window._ojs.runtime = createRuntime();

