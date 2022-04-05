/*global Shiny, $, DOMParser, MutationObserver, URL
 *
 * quarto-ojs.js
 *
 * Copyright (C) 2021 RStudio, PBC
 *
 */

// FIXME Our integration of observable's stdlib and d3-require is less than ideal.
//
// While https://github.com/d3/d3-require/pull/40 isn't merged into d3-require,
//
// we need to run our own version of d3-require. That means we also
// need to run our own version of observable's stdlib (specifically to
// grab FileAttachments and Library)

import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler@0.6.0-alpha.9";

import {
  Inspector,
  Runtime,
  RuntimeError,
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";

import { FileAttachments, Library } from "./stdlib.js";

import { PandocCodeDecorator } from "./pandoc-code-decorator.js";

import {
  extendObservableStdlib,
  ShinyInspector,
  initOjsShinyRuntime,
} from "./quarto-observable-shiny.js";

import { QuartoInspector } from "./quarto-inspector.js";

import { OJSConnector } from "./ojs-connector.js";

//////////////////////////////////////////////////////////////////////////////
// Quarto-specific code starts here.

// For RStudio IDE integration
/** creates a click handler to point the IDE to a given line and column */
const makeDevhostErrorClickHandler = (line, column) => {
  return function () {
    if (!window.quartoDevhost) {
      return false;
    }
    window.quartoDevhost.openInputFile(line, column, true);
    return false;
  };
};

// we cannot depend on Object.fromEntries because the IDE
// doesn't support it. We minimally polyfill it
if (Object.fromEntries === undefined) {
  Object.fromEntries = function (obj) {
    const result = {};
    for (const [key, value] of obj) {
      result[key] = value;
    }
    return result;
  };
}

/** create a callout block with the given opts, currently to be used
    to signal a runtime error in the observable runtime.
*/
function calloutBlock(opts) {
  const { type, heading, message, onclick } = opts;

  const outerBlock = document.createElement("div");
  outerBlock.classList.add(
    `callout-${type}`,
    "callout",
    "callout-style-default",
    "callout-captioned"
  );
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
  // we assume heading is either a string or a span
  if (typeof heading === "string") {
    headingDiv.innerText = heading;
  } else {
    headingDiv.appendChild(heading);
  }
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

  if (onclick) {
    outerBlock.onclick = onclick;
    outerBlock.style.cursor = "pointer";
  }

  return outerBlock;
}

const kQuartoModuleWaitClass = "ojs-in-a-box-waiting-for-module-import";

class QuartoOJSConnector extends OJSConnector {
  constructor(opts) {
    super(opts);
  }

  ////////////////////////////////////////////////////////////////////////////
  // handle import module waits

  clearImportModuleWait() {
    const array = Array.from(
      document.querySelectorAll(`.${kQuartoModuleWaitClass}`)
    );
    for (const node of array) {
      node.classList.remove(kQuartoModuleWaitClass);
    }
  }

  finishInterpreting() {
    return super.finishInterpreting().then(() => {
      if (this.mainModuleHasImports) {
        this.clearImportModuleWait();
      }
    });
  }

  ////////////////////////////////////////////////////////////////////////////
  // Error tracking/reporting

  locatePreDiv(cellDiv, ojsDiv) {
    // locate the correct pre div with the pandocDecorator
    // of all potential divs, we need to find the one that most
    // immediately precedes `ojsDiv` in the DOM.
    let preDiv;
    for (const candidate of cellDiv.querySelectorAll("pre.sourceCode")) {
      if (
        candidate.compareDocumentPosition(ojsDiv) &
        ojsDiv.DOCUMENT_POSITION_FOLLOWING
      ) {
        preDiv = candidate;
      } else {
        break;
      }
    }
    return preDiv;
  }

  findCellOutputDisplay(ojsDiv) {
    while (ojsDiv && !ojsDiv.classList.contains("cell-output-display")) {
      ojsDiv = ojsDiv.parentElement;
    }
    if (!ojsDiv) {
      throw new Error("Internal error: couldn't find output display div");
    }
    return ojsDiv;
  }

  setPreDivClasses(preDiv, hasErrors) {
    if (!hasErrors) {
      preDiv.classList.remove("numberSource");
      if (preDiv._hidden === true) {
        preDiv.parentElement.classList.add("hidden");
      }
    } else {
      preDiv.classList.add("numberSource");
      if (preDiv.parentElement.classList.contains("hidden")) {
        preDiv._hidden = true;
        preDiv.parentElement.classList.remove("hidden");
      }
    }
  }

  clearErrorPinpoints(cellDiv, ojsDiv) {
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === undefined) {
      return;
    }
    this.setPreDivClasses(preDiv, false);
    let startingOffset = 0;
    if (preDiv.parentElement.dataset.sourceOffset) {
      startingOffset = -Number(preDiv.parentElement.dataset.sourceOffset);
    }
    for (const entryPoint of preDiv._decorator.spanSelection(
      startingOffset,
      Infinity
    )) {
      const { node } = entryPoint;
      node.classList.remove("quarto-ojs-error-pinpoint");
      node.onclick = null;
    }
  }

  decorateOjsDivWithErrorPinpoint(ojsDiv, start, end, line, column) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    if (cellOutputDisplay._errorSpans === undefined) {
      cellOutputDisplay._errorSpans = [];
    }
    cellOutputDisplay._errorSpans.push({
      start,
      end,
      line,
      column,
    });
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
    let foundErrors = false;
    while (div !== null && div.classList.contains("cell-output-display")) {
      for (const errorSpan of div._errorSpans || []) {
        for (const entryPoint of preDiv._decorator.spanSelection(
          errorSpan.start,
          errorSpan.end
        )) {
          const { node } = entryPoint;
          node.classList.add("quarto-ojs-error-pinpoint");
          node.onclick = makeDevhostErrorClickHandler(
            errorSpan.line,
            errorSpan.column
          );
        }
        foundErrors = true;
      }
      div = div.nextElementSibling;
    }
    this.setPreDivClasses(preDiv, foundErrors);
  }

  clearError(ojsDiv) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    cellOutputDisplay._errorSpans = [];
  }

  signalError(cellDiv, ojsDiv, ojsAst) {
    const buildCallout = (ojsDiv) => {
      let onclick;
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
            const missingRef = ojsAst.references.find(
              (n) => n.name === varName
            );
            // TODO when missingRef === undefined, it likely means an unresolved
            // import reference. For now we will leave things as is, but
            // this needs better handling.
            if (missingRef !== undefined) {
              const { line, column } = preDiv._decorator.offsetToLineColumn(
                missingRef.start
              );
              const headingSpan = document.createElement("span");
              const headingTextEl = document.createTextNode(
                `${heading} (line ${line}, column ${column}) `
              );
              headingSpan.appendChild(headingTextEl);
              if (window.quartoDevhost) {
                const clicker = document.createElement("a");
                clicker.href = "#"; // this forces the right CSS to apply
                clicker.innerText = "(source)";
                onclick = makeDevhostErrorClickHandler(line, column);
                headingSpan.appendChild(clicker);
              }
              heading = headingSpan;
              this.decorateOjsDivWithErrorPinpoint(
                ojsDiv,
                missingRef.start,
                missingRef.end,
                line,
                column
              );
            }
          }
        } else if (
          message.match(/^(.+) could not be resolved$/) ||
          message.match(/^(.+) is defined more than once$/)
        ) {
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
          throw new Error(
            `Internal error, could not parse OJS error message "${message}"`
          );
        }
      } else {
        heading = "OJS Error";
        const p = document.createElement("p");
        p.appendChild(document.createTextNode(inspectChild.textContent));
        message = p;
      }
      const callout = calloutBlock({
        type: "important",
        heading,
        message,
        onclick,
      });
      ojsDiv.appendChild(callout);
    };

    buildCallout(ojsDiv);
  }

  interpret(src, elementGetter, elementCreator) {
    const that = this;
    const observer = (targetElement, ojsAst) => {
      return (name) => {
        const element =
          typeof elementCreator === "function"
            ? elementCreator()
            : elementCreator;
        targetElement.appendChild(element);

        // TODO the unofficial interpreter always calls viewexpression observers
        // twice, one with the name, and the next with 'viewof $name'.
        // we check for 'viewof ' here and hide the element we're creating.
        // this behavior appears inconsistent with OHQ's interpreter, so we
        // shouldn't be surprised to see this fail in the future.
        if (
          ojsAst.id &&
          ojsAst.id.type === "ViewExpression" &&
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
        const forceShowDeclarations = !(
          cellDiv && cellDiv.dataset.output !== "all"
        );

        const config = { childList: true };
        const callback = function (mutationsList) {
          // we may fail to find a cell in inline settings; but
          // inline cells won't have inspectors, so in that case
          // we never hide
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;

            if (!forceShowDeclarations) {
              // hide the inner inspect outputs that aren't errors or
              // declarations
              Array.from(mutation.target.childNodes)
                .filter((n) => {
                  return (
                    n.classList.contains("observablehq--inspect") &&
                    !n.parentNode.classList.contains("observablehq--error") &&
                    n.parentNode.parentNode.dataset.nodetype !== "expression"
                  );
                })
                .forEach((n) => n.classList.add("quarto-ojs-hide"));

              // show the inspect outputs that aren't errors and are
              // expressions (they might have been hidden in the past,
              // since errors can clear)
              Array.from(mutation.target.childNodes)
                .filter((n) => {
                  return (
                    n.classList.contains("observablehq--inspect") &&
                    !n.parentNode.classList.contains("observablehq--error") &&
                    n.parentNode.parentNode.dataset.nodetype === "expression"
                  );
                })
                .forEach((n) => n.classList.remove("quarto-ojs-hide"));
            }

            // if the ojsDiv shows an error, display a callout block instead of it.
            if (ojsDiv.classList.contains("observablehq--error")) {
              // we don't use quarto-ojs-hide here because that would confuse
              // the code which depends on that class for its logic.
              ojsDiv.querySelector(".observablehq--inspect").style.display =
                "none";

              if (ojsDiv.querySelectorAll(".callout-important").length === 0) {
                that.signalError(cellDiv, ojsDiv, ojsAst);
              }
            } else {
              that.clearError(ojsDiv);
              if (
                ojsDiv.parentNode.dataset.nodetype !== "expression" &&
                !forceShowDeclarations &&
                Array.from(ojsDiv.childNodes).every((n) =>
                  n.classList.contains("observablehq--inspect")
                )
              ) {
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
            const children = Array.from(
              cellOutputDisplay.querySelectorAll("div.observablehq")
            );
            // after all mutations are handled, we check the full cell for hiding
            if (
              children.every((n) => {
                return n.classList.contains("quarto-ojs-hide");
              })
            ) {
              cellOutputDisplay.classList.add("quarto-ojs-hide");
            } else {
              cellOutputDisplay.classList.remove("quarto-ojs-hide");
            }
          }
        };
        new MutationObserver(callback).observe(element, config);
        // 'element' is the outer div given to observable's runtime to insert their output
        // every quarto cell will have either one or two such divs.
        // The parent of these divs should always be a div corresponding to an ojs "cell"
        // (with ids "ojs-cell-*")

        element.classList.add(kQuartoModuleWaitClass);

        return new this.inspectorClass(element, ojsAst);
      };
    };
    const runCell = (cell) => {
      const targetElement =
        typeof elementGetter === "function" ? elementGetter() : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(
        cellSrc,
        undefined,
        observer(targetElement, cell)
      );
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
}

//////////////////////////////////////////////////////////////////////////////
// previously quarto-observable-shiny.js

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
      .map((v, i) =>
        Object.fromEntries(keys.map((key) => [key, df[key][i] || undefined]))
      )
      .filter((v) => !Object.values(v).every((e) => e === undefined));
  }
  lib.transpose = () => transpose;

  const mainEl = document.querySelector("main");
  function width() {
    return lib.Generators.observe(function (change) {
      var width = change(mainEl.clientWidth);
      function resized() {
        var w = mainEl.clientWidth;
        if (w !== width) change((width = w));
      }
      window.addEventListener("resize", resized);
      return function () {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.width = width;

  // hack for "echo: fenced": remove all "//| echo: fenced" lines the hard way, but keep
  // the right line numbers around.
  Array.from(document.querySelectorAll("span.co"))
    .filter((n) => n.textContent === "//| echo: fenced")
    .forEach((n) => {
      const lineSpan = n.parentElement;
      const lineBreak = lineSpan.nextSibling;
      if (lineBreak) {
        const nextLineSpan = lineBreak.nextSibling;
        if (nextLineSpan) {
          const lineNumber = Number(nextLineSpan.id.split("-")[1]);
          nextLineSpan.style = `counter-reset: source-line ${lineNumber - 1}`;
        }
      }

      // update the source offset variable with the new right amount
      const sourceDiv = lineSpan.parentElement.parentElement.parentElement;
      const oldOffset = Number(sourceDiv.dataset.sourceOffset);
      sourceDiv.dataset.sourceOffset = oldOffset - "//| echo: fenced\n".length;

      lineSpan.remove();
      lineBreak.remove();
    });

  // select all panel elements with ids
  const layoutDivs = Array.from(
    document.querySelectorAll("div.quarto-layout-panel div[id]")
  );
  function layoutWidth() {
    return lib.Generators.observe(function (change) {
      const ourWidths = Object.fromEntries(
        layoutDivs.map((div) => [div.id, div.clientWidth])
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

  const ojsConnector = new QuartoOJSConnector({
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

  const sourceNodes = document.querySelectorAll(
    "pre.sourceCode code.sourceCode"
  );
  const decorators = Array.from(sourceNodes).map((n) => {
    n = n.parentElement;
    const decorator = new PandocCodeDecorator(n);
    n._decorator = decorator;
    return decorator;
  });
  // handle build-time syntax error
  decorators.forEach((n) => {
    if (n._node.parentElement.dataset.syntaxErrorPosition === undefined) {
      return;
    }
    const offset = Number(n._node.parentElement.dataset.syntaxErrorPosition);
    n.decorateSpan(offset, offset + 1, ["quarto-ojs-error-pinpoint"]);
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
    },

    // fixme clarify what's the expected behavior of the 'error' option
    // when evaluation is at client-time
    interpretLenient(src, targetElementId, inline) {
      return result.interpret(src, targetElementId, inline).catch(() => {});
    },
    interpret(src, targetElementId, inline) {
      // we capture the result here so that the error handler doesn't
      // grab a new id accidentally.
      let targetElement;
      const getElement = () => {
        // console.log("getElement called");
        targetElement = document.getElementById(targetElementId);
        let subFigId;
        if (!targetElement) {
          // this is a subfigure
          subFigId = getSubfigId(targetElementId);
          targetElement = document.getElementById(subFigId);
          if (!targetElement) {
            // console.error("Ran out of subfigures for element", targetElementId);
            // console.error("This will fail.");
            throw new Error("Ran out of quarto subfigures.");
          }
        }
        // console.log("getElement will return", targetElement);
        // console.log("state: ", { targetElementId, subFigId });
        return targetElement;
      };

      const makeElement = () => {
        return document.createElement(inline ? "span" : "div");
      };

      return ojsConnector.interpret(src, getElement, makeElement).catch((e) => {
        // to the best of our knowledge, we only get here
        // on import statement failures. So we report those
        // in a callout

        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }

        const ojsDiv = targetElement.querySelector(".observablehq");
        // because this is in an exception handler, we might need
        // to clear some of the garbage that other pieces of code
        // won't have the chance to
        //
        for (const div of ojsDiv.querySelectorAll(".callout")) {
          div.remove();
        }

        const messagePre = document.createElement("pre");
        messagePre.innerText = e.stack;

        const callout = calloutBlock({
          type: "important",
          heading: `${e.name}: ${e.message}`,
          message: messagePre,
        });
        ojsDiv.appendChild(callout);
        ojsConnector.clearError(ojsDiv);
        ojsConnector.clearErrorPinpoints(cellDiv, ojsDiv);

        return e;
      });
    },
    interpretQuiet(src) {
      return ojsConnector.interpretQuiet(src);
    },
    interpretFromScriptTags() {
      // source definitions
      for (const el of document.querySelectorAll(
        "script[type='ojs-module-contents']"
      )) {
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
                `Don't know how to call method ${call.methodName}`
              );
          }
        }
      }

      // static data definitions
      for (const el of document.querySelectorAll("script[type='ojs-define']")) {
        for (const { name, value } of JSON.parse(el.text).contents) {
          ojsConnector.define(name)(value);
        }
      }
    },
  };

  return result;
}

// TODO "obs" or "ojs"? Inconsistent naming.
window._ojs = {
  ojsConnector: undefined,

  paths: {}, // placeholder for per-quarto-file paths
  // necessary for module resolution

  hasShiny: false, // true if we have the quarto-ojs-shiny runtime

  shinyElementRoot: undefined, // root element for the communication with shiny
  // via DOM
};
window._ojs.runtime = createRuntime();
