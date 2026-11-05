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

import { FileAttachments, Library } from "external-observablehq-stdlib";

import { PandocCodeDecorator } from "./pandoc-code-decorator.js";

import {
  extendObservableStdlib,
  ShinyInspector,
  initOjsShinyRuntime,
} from "./quarto-observable-shiny.js";

import { QuartoInspector } from "./quarto-inspector.js";

import { OJSConnector } from "./ojs-connector.js";

import { createQuartoJsxShim } from "./quarto-jsx.js";

import { autosizeOJSPlot } from "./ojs-code-transform.js";

import { base64ToStr } from "./b64.js";

import mime from "mime";

//////////////////////////////////////////////////////////////////////////////

function displayOJSWarning(warning) {
  const cells = [];
  for (const content of document.querySelectorAll(
    'script[type="ojs-module-contents"]'
  )) {
    for (const cellJson of JSON.parse(base64ToStr(content.text)).contents) {
      let cell =
        document.getElementById(cellJson.cellName) ||
        document.getElementById(`${cellJson.cellName}-1`);
      if (!cell) {
        // give up
        continue;
      }
      cells.push(cell);
    }
  }

  cells.forEach((cell) => {
    cell.innerHTML = "";

    const message = warning();

    cell.appendChild(
      calloutBlock({
        heading: "Error",
        type: "error",
        message,
      })
    );
  });
}

function displayQtWebEngineError() {
  displayOJSWarning(() => {
    const message = document.createElement("div");
    message.appendChild(
      document.createTextNode(
        "This document uses OJS, which requires JavaScript features not present in this version of QtWebEngine. If you're using RStudio IDE, please upgrade to a "
      )
    );
    const link = document.createElement("a");
    link.appendChild(document.createTextNode("2022.12 build"));
    link.href = "https://dailies.rstudio.com/rstudio/elsbeth-geranium/";
    message.appendChild(link);
    message.appendChild(document.createTextNode("."));
    return message;
  });
}

function displayFileProtocolError() {
  displayOJSWarning(() => {
    const message = document.createElement("div");
    message.appendChild(
      document.createTextNode(
        "This document uses OJS, which requires JavaScript features disabled when running in file://... URLs. In order for these features to work, run this document in a web server."
      )
    );
    return message;
  });
}

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
      return null;
    }
    return ojsDiv;
  }

  setPreDivClasses(preDiv, hasErrors) {
    if (!hasErrors) {
      preDiv.classList.remove("numberSource");
      if (preDiv._hidden === true) {
        const parent = preDiv.parentElement;
        parent.classList.add("hidden");
        // when code-tools is active (that is, when pre is inside a details tag), we also need to hide the details tag.
        if (parent.parentElement.tagName === "DETAILS") {
          parent.parentElement.classList.add("hidden");
        }
      }
    } else {
      preDiv.classList.add("numberSource");
      const parent = preDiv.parentElement;
      if (parent.classList.contains("hidden")) {
        preDiv._hidden = true; // signal that we used to be hidden so that when errors go away, we're hidden again.
        parent.classList.remove("hidden");

        // when code-tools is active (that is, when pre is inside a details tag), we also need to unhide the details tag.
        if (parent.parentElement.tagName === "DETAILS") {
          parent.parentElement.classList.remove("hidden");
          // open the code-tools by default when error happens.
          parent.parentElement.setAttribute("open", "open");
        }
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
    // if ojs element is inline, there's no div.
    if (!cellOutputDisplay) {
      return;
    }
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
    if (!cellDiv) {
      // no div in inline spans
      return;
    }
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
    let parent = preDiv.parentElement;
    if (parent.parentElement.tagName === "DETAILS") {
      // we're in a code-tools setting, need to go one further up
      parent = parent.parentElement;
    }
    let div = parent.nextElementSibling;
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
    // if ojs element is inline, there's no div.
    if (cellOutputDisplay) cellOutputDisplay._errorSpans = [];
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
        } else {
          const p = document.createElement("p");
          p.appendChild(document.createTextNode(message));
          message = p;
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
    // deno-lint-ignore no-this-alias
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
        const forceShowDeclarations =
          !cellDiv || cellDiv.dataset.output === "all";

        const config = { childList: true };
        const callback = function (mutationsList) {
          // we may fail to find a cell in inline settings; but
          // inline cells won't have inspectors, so in that case
          // we never hide
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;

            if (!forceShowDeclarations) {
              const childNodes = Array.from(mutation.target.childNodes);
              for (const n of childNodes) {
                // hide the inner inspect outputs that aren't errors or
                // declarations
                if (
                  n.classList.contains("observablehq--inspect") &&
                  !n.parentNode.classList.contains("observablehq--error") &&
                  n.parentNode.parentNode.dataset.nodetype !== "expression"
                ) {
                  n.classList.add("quarto-ojs-hide");
                }
                // show the inspect outputs that aren't errors and are
                // expressions (they might have been hidden in the past,
                // since errors can clear)
                if (
                  n.classList.contains("observablehq--inspect") &&
                  !n.parentNode.classList.contains("observablehq--error") &&
                  n.parentNode.parentNode.dataset.nodetype === "expression"
                ) {
                  n.classList.remove("quarto-ojs-hide");
                }
              }
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

            for (const added of mutation.addedNodes) {
              // https://github.com/quarto-dev/quarto-cli/issues/7426
              // ObservableHQ.Plot fixup:
              // remove "background: white" from style declaration
              if (
                added.tagName === "svg" &&
                Array.from(added.classList).some((x) =>
                  x.match(/plot-[0-9a-f]+/)
                )
              ) {
                // this overrides the style CSS inside.
                added.style.background = "none";
              }

              if (
                added.tagName === "FORM" &&
                Array.from(added.classList).some(
                  (x) => x.endsWith("table") && x.startsWith("oi-")
                )
              ) {
                // add quarto-specific classes to OJS-generated tables
                added.classList.add("quarto-ojs-table-fixup");

                // in dashboard, change styles so that autosizing works
                if (window._ojs.isDashboard) {
                  const table = added.querySelector("table");
                  if (table) {
                    table.style.width = "100%";
                  }
                  added.style.maxHeight = null;
                  added.style.margin = "0 0 0 0";
                  added.style.padding = "0 0 0 0";

                  // find parentElement with class cell-output-display or cell
                  let parent = added.parentElement;
                  while (
                    parent &&
                    !parent.classList.contains("cell-output-display") &&
                    !parent.classList.contains("cell")
                  ) {
                    parent = parent.parentElement;
                  }
                  if (
                    parent !== null &&
                    added.clientHeight > parent.clientHeight
                  ) {
                    added.style.maxHeight = `${parent.clientHeight}px`;
                  }
                }
              }

              // add quarto-specific classes to OJS-generated buttons
              const addedButtons = added.querySelectorAll("button");
              for (const button of Array.from(addedButtons)) {
                button.classList.add("btn");
                button.classList.add("btn-quarto");
              }

              // hide import statements even if output === "all"
              //// Hide imports that aren't javascript code
              //
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

  // Are we QtWebEngine? bail
  if (window.navigator.userAgent.includes("QtWebEngine")) {
    displayQtWebEngineError();
    return;
  }

  // Are we file://? bail
  if (window.location.protocol === "file:") {
    displayFileProtocolError();
    return;
  }

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
        Object.fromEntries(
          keys.map((key) => {
            const v = df[key][i];
            const result = v === null ? undefined : v;
            return [key, result];
          })
        )
      )
      .filter((v) => !Object.values(v).every((e) => e === undefined));
  }
  lib.transpose = () => transpose;

  // TODO this should be user-configurable, so that we can actually
  // make it work in arbitrary layouts.
  // There's probably a slick reactive trick to make the element
  // user settable.
  //
  // Right now we support quarto's standard HTML formats

  const mainEl =
    document.querySelector("main") || // html
    document.querySelector("div.reveal") || // reveal
    document.querySelector("body"); // fall-through

  function cards() {
    if (mainEl === null) {
      return lib.Generators.observe((change) => {
        change(undefined);
      });
    }
    return lib.Generators.observe(function (change) {
      let previous = undefined;
      function resized() {
        let changed = false;
        const result = {};
        let cellIndex = 0;
        const handle = (card) => {
          const cardInfo = {
            card,
            width: card.clientWidth,
            height: card.clientHeight,
          };
          result[cellIndex] = cardInfo;
          if (
            previous === undefined ||
            previous[cellIndex].width !== cardInfo.width ||
            previous[cellIndex].height !== cardInfo.height
          ) {
            changed = true;
          }
          cellIndex++;

          // there can be an id in the card itself, allow that as a key
          if (card.id) {
            result[card.id] = cardInfo;
          }
        };
        for (const card of document.querySelectorAll("div.card")) {
          for (const cell of card.querySelectorAll("div.cell-output-display")) {
            handle(cell);
          }
          for (const cell of card.querySelectorAll("div.quarto-layout-cell")) {
            handle(cell);
          }
        }
        for (const card of document.querySelectorAll("div")) {
          if (!card.id.startsWith("ojs-cell-")) {
            continue;
          }
          let cardInfoCard;
          // many possible cases:

          if (card.parentElement.classList.contains("cell-output-display")) {
            // single cell: card parent is cell-output-display
            cardInfoCard = card.parentElement;
          } else if (
            card.parentElement.classList.contains("quarto-layout-cell")
          ) {
            // subcell of layout
            cardInfoCard = card.parentElement;
          } else if (
            card.parentElement.parentElement.classList.contains(
              "cell-output-display"
            )
          ) {
            // subcell of cell-output-display
            cardInfoCard = card.parentElement.parentElement;
          } else {
            continue;
          }
          const cardInfo = {
            card: cardInfoCard,
            width: card.clientWidth,
            height: card.clientHeight,
          };
          result[card.id] = cardInfo;
          if (
            previous === undefined ||
            previous[card.id].width !== cardInfo.width ||
            previous[card.id].height !== cardInfo.height
          ) {
            changed = true;
          }
          if (card.parentElement.id !== "") {
            result[card.parentElement.id] = cardInfo;
          }
        }

        if (changed) {
          previous = result;
          change(result);
        }
      }
      resized();
      window.addEventListener("resize", resized);
      return function () {
        window.removeEventListener("resize", resized);
      };
    });
  }

  function width() {
    if (mainEl === null) {
      return lib.Generators.observe((change) => {
        change(undefined);
      });
    }
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
  lib.cards = cards;

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

  // select all elements to track:
  //   panel elements with ids, and divs with ids and .ojs-track-layout

  const layoutDivs = [
    ...Array.from(document.querySelectorAll("div.quarto-layout-panel div[id]")),
    ...Array.from(document.querySelectorAll("div.ojs-track-layout[id]")),
  ];

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

    let name;

    // we need to remove the hash from the current path
    // for this to work in revealjs
    const currentPath = window.location.href
      .split("#")[0]
      .replace(/[^/]*$/, "");

    if (n.startsWith("/")) {
      // docToRoot can be empty, in which case naive concatenation creates
      // an absolute path.
      if (quartoOjsGlobal.paths.docToRoot === "") {
        name = `${currentPath}.${n}`;
      } else {
        name = `${currentPath}${quartoOjsGlobal.paths.docToRoot}${n}`;
      }
    } else if (n.startsWith("http")) {
      name = n;
    } else {
      name = `${currentPath}${n}`;
    }

    const mimeType = mime.getType(name);

    return {
      url: name,
      mimeType: mimeType,
    };
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
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
        }

        const ojsDiv = targetElement.querySelector(".observablehq");
        if (!ojsDiv) {
          // we failed to find an observablehq div inside the targetElement.
          // This is an internal error and we have no way to report it
          // except throwing the original exception.
          throw e;
        }
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
        for (const call of JSON.parse(base64ToStr(el.text)).contents) {
          let source = window._ojs.isDashboard
            ? autosizeOJSPlot(call.source, call.cellName)
            : call.source;
          switch (call.methodName) {
            case "interpret":
              this.interpret(source, call.cellName, call.inline);
              break;
            case "interpretLenient":
              this.interpretLenient(source, call.cellName, call.inline);
              break;
            case "interpretQuiet":
              this.interpretQuiet(source);
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

export default function initializeRuntime() {
  // TODO "obs" or "ojs"? Inconsistent naming.
  window._ojs = {
    ojsConnector: undefined,

    paths: {}, // placeholder for per-quarto-file paths
    // necessary for module resolution

    hasShiny: false, // true if we have the quarto-ojs-shiny runtime

    isDashboard: document.body.classList.contains("quarto-dashboard"), // true if we are a dashboard format

    shinyElementRoot: undefined, // root element for the communication with shiny
    // via DOM
  };
  window._ojs.runtime = createRuntime();
  window._ojs.jsx = createQuartoJsxShim();
}
