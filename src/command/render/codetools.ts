/*
* keepsource.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { kCodeTools, kKeepSource } from "../../config/constants.ts";
import { Format, isHtmlOutput } from "../../config/format.ts";
import {
  ExecutionEngine,
  executionEngineCanKeepSource,
  ExecutionTarget,
} from "../../execute/engine.ts";
import { formatHasBootstrap } from "../../format/html/format-html-bootstrap.ts";
import { kMarkdownBlockSeparator } from "./pandoc.ts";

const kHideAllCodeLinkId = "quarto-hide-all-code";
const kShowAllCodeLinkId = "quarto-show-all-code";
const kViewSourceLinkId = "quarto-view-source";
const kCodeToolsSourceButtonId = "quarto-code-tools-source";
const kCodeToolsMenuButtonId = "quarto-code-tools-menu";
const kKeepSourceClass = "quarto-embedded-source-code";
const kKeepSourceSentinel = "quarto-executable-code-5450563D";

interface CodeTools {
  source: boolean | string;
  toggle: boolean;
  caption: string;
}

export function formatHasCodeTools(format: Format) {
  const codeTools = format.render?.[kCodeTools];
  return !!codeTools && isHtmlOutput(format.pandoc, true) &&
    formatHasBootstrap(format);
}

export function resolveKeepSource(
  format: Format,
  engine: ExecutionEngine,
  target: ExecutionTarget,
) {
  // keep source if requested (via keep-source or code-tools), we are targeting html,
  // and engine can keep it (e.g. we wouldn't keep an .ipynb file as source)
  const codeTools = format.render?.[kCodeTools];
  if (
    codeTools === true ||
    (typeof (codeTools) === "object" && codeTools?.source !== false)
  ) {
    format.render[kKeepSource] = true;
  }
  format.render[kKeepSource] = format.render[kKeepSource] &&
    isHtmlOutput(format.pandoc, true) &&
    executionEngineCanKeepSource(engine, target);
}

export function keepSourceBlock(format: Format, source: string) {
  if (format.render[kKeepSource]) {
    // read code
    let code = Deno.readTextFileSync(source).trimLeft();
    if (!code.endsWith("\n")) {
      code = code + "\n";
    }

    // make sure that quarto code blocks get correct highlighting
    code = code.replaceAll(
      /\n```{(\w+)}\s*\n/g,
      "\n" + kKeepSourceSentinel + "\n\n```$1\n",
    );

    const kKeepSourceBackticks = "```````````````";
    return `${kMarkdownBlockSeparator}${kKeepSourceBackticks}` +
      `{.markdown .${kKeepSourceClass}}\n${code}` +
      `${kKeepSourceBackticks}\n`;
  } else {
    return "";
  }
}

export function codeToolsPostprocessor(format: Format) {
  return (doc: Document): Promise<string[]> => {
    // provide code tools in header
    if (formatHasCodeTools(format)) {
      // resolve what sort of code tools we will present
      const codeTools = resolveCodeTools(format, doc);
      if (codeTools.source || codeTools.toggle) {
        const title = doc.querySelector("#title-block-header > h1");
        if (title) {
          const header = (title as Element).parentElement;
          const titleDiv = doc.createElement("div");
          titleDiv.classList.add("quarto-title-block");
          titleDiv.appendChild(title);
          const button = doc.createElement("button");
          button.setAttribute("type", "button");
          button.classList.add("btn").add("code-tools-button");
          const icon = doc.createElement("i");
          icon.classList.add("bi");
          button.appendChild(icon);
          if (codeTools.caption !== "none") {
            button.appendChild(doc.createTextNode(" " + codeTools.caption));
          }
          titleDiv.appendChild(button);
          header!.appendChild(titleDiv);
          if (codeTools.toggle) {
            button.setAttribute("id", kCodeToolsMenuButtonId);
            button.classList.add("dropdown-toggle");
            button.setAttribute("data-bs-toggle", "dropdown");
            button.setAttribute("aria-expanded", "false");
            const ul = doc.createElement("ul");
            ul.classList.add("dropdown-menu").add("dropdown-menu-end");
            ul.setAttribute("aria-labelelledby", kCodeToolsMenuButtonId);
            const addListItem = (id: string, text: string) => {
              const a = doc.createElement("a");
              a.setAttribute("id", id);
              a.classList.add("dropdown-item");
              a.setAttribute("href", "#");
              a.appendChild(doc.createTextNode(text));
              const li = doc.createElement("li");
              li.appendChild(a);
              ul.appendChild(li);
            };
            const addDivider = () => {
              const hr = doc.createElement("hr");
              hr.classList.add("dropdown-divider");
              const li = doc.createElement("li");
              li.appendChild(hr);
              ul.appendChild(li);
            };
            addListItem(kHideAllCodeLinkId, "Hide All Code");
            addListItem(kShowAllCodeLinkId, "Show All Code");
            addDivider();
            addListItem(kViewSourceLinkId, "View Source");
            titleDiv.appendChild(ul);
          } else {
            // no toggle, so just a button to show source code
            button.setAttribute("id", kCodeToolsSourceButtonId);
          }
        }
      }
    }

    // fixup code block delimiters in keep-source
    if (format.render[kKeepSource]) {
      // make sure the div.sourceCode parent of keep source is hidden
      const keepSource = doc.querySelector(".quarto-embedded-source-code");
      if (keepSource) {
        (keepSource as Element).parentElement?.classList.add("hidden");
      }

      // fixup the lines
      const lines = doc.querySelectorAll(
        `.${kKeepSourceClass} > pre > code > span`,
      );
      if (lines.length > 0) {
        const newLines: Element[] = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] as Element;
          if (line.innerText === kKeepSourceSentinel) {
            i += 2;
            const codeBlockLine = lines[i] as Element;
            const codeSpan = codeBlockLine.lastChild as Element;
            codeSpan.innerHTML = codeSpan.innerHTML.replace(
              /```(\w+)/,
              "```{$1}",
            );
            newLines.push(codeBlockLine);
          } else {
            newLines.push(line);
          }
        }
        if (newLines.length !== lines.length) {
          const parent = (lines[0] as Element).parentElement!;
          parent.innerHTML = "";
          newLines.forEach((line) => {
            parent.appendChild(line);
            parent.appendChild(doc.createTextNode("\n"));
          });
        }
      }
    }

    return Promise.resolve([]);
  };
}

function resolveCodeTools(format: Format, doc: Document): CodeTools {
  // determine user prefs
  const kCodeCaption = "Code";
  const codeTools = format?.render[kCodeTools];
  const codeToolsResolved = {
    source: typeof (codeTools) === "boolean"
      ? codeTools
      : codeTools?.source !== undefined
      ? !!codeTools?.source
      : false,
    toggle: typeof (codeTools) === "boolean" ? codeTools
    : codeTools?.toggle !== undefined
      ? !!codeTools?.toggle
      : false,
    caption: typeof (codeTools) === "boolean" ? kCodeCaption
    : codeTools?.caption || kCodeCaption,
  };

  // if we have requested toggle, make sure there are things to toggle
  if (codeToolsResolved.toggle) {
    const codeDetails = doc.querySelector(".cell > details > .sourceCode");
    const codeHidden = doc.querySelector(".cell .sourceCode.hidden");
    codeToolsResolved.toggle = codeToolsResolved.toggle &&
      (!!codeDetails || !!codeHidden);
  }

  // return resolved
  return codeToolsResolved;
}
