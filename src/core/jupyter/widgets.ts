/*
 * widgets.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

// deno-lint-ignore-file camelcase

import { mergeConfigs } from "../config.ts";
import { lines } from "../lib/text.ts";
import {
  kApplicationJavascript,
  kApplicationJupyterWidgetState,
  kApplicationJupyterWidgetView,
  kTextHtml,
} from "../mime.ts";
import { isDisplayData } from "./display-data.ts";
import {
  JupyterNotebook,
  JupyterOutputDisplayData,
  JupyterWidgetDependencies,
  JupyterWidgetsState,
} from "./types.ts";

export function extractJupyterWidgetDependencies(
  nb: JupyterNotebook,
): JupyterWidgetDependencies {
  // a 'javascript' widget doesn't use the jupyter widgets protocol, but rather just injects
  // text/html or application/javascript directly. futhermore these 'widgets' often assume
  // that require.js and jquery are available. for example, see:
  //   - https://github.com/mwouts/itables
  //   - https://plotly.com/python/
  const jsWidgets = haveOutputType(
    nb,
    [kApplicationJavascript, kTextHtml],
  );

  // jupyter widgets confirm to the jupyter widget embedding protocol:
  // https://ipywidgets.readthedocs.io/en/latest/embedding.html#embeddable-html-snippet
  const jupyterWidgets = haveOutputType(
    nb,
    [kApplicationJupyterWidgetView],
  );

  // see if there are html libraries that need to be hoisted up into the head
  const htmlLibraries: string[] = [];
  nb.cells.forEach((cell) => {
    if (cell.cell_type === "code") {
      cell.outputs = cell.outputs?.filter((output) => {
        if (isDisplayData(output)) {
          const displayOutput = output as JupyterOutputDisplayData;
          const html = displayOutput.data[kTextHtml];
          const htmlText = Array.isArray(html) ? html.join("") : html as string;
          if (html && isWidgetIncludeHtml(htmlText)) {
            htmlLibraries.push(htmlLibrariesText(htmlText));
            return false;
          }
        }
        return true;
      });
    }
  });

  return {
    jsWidgets,
    jupyterWidgets,
    htmlLibraries,
    widgetsState: nb.metadata.widgets
      ?.[kApplicationJupyterWidgetState] as JupyterWidgetsState,
  };
}

export function includesForJupyterWidgetDependencies(
  dependencies: JupyterWidgetDependencies[],
  tempDir: string,
) {
  // combine all of the dependencies
  let haveJavascriptWidgets = false;
  let haveJupyterWidgets = false;
  const htmlLibraries: string[] = [];
  let widgetsState: JupyterWidgetsState | undefined;

  for (const dependency of dependencies) {
    haveJavascriptWidgets = haveJavascriptWidgets || dependency.jsWidgets;
    haveJupyterWidgets = haveJupyterWidgets || dependency.jupyterWidgets;
    for (const htmlLib of dependency.htmlLibraries) {
      if (!htmlLibraries.includes(htmlLib)) {
        htmlLibraries.push(htmlLib);
      }
    }
    if (dependency.widgetsState) {
      if (!widgetsState) {
        widgetsState = dependency.widgetsState;
      } else {
        widgetsState = mergeConfigs(widgetsState, dependency.widgetsState);
      }
    }
  }

  // write required dependencies into head
  const head: string[] = [];
  if (haveJavascriptWidgets || haveJupyterWidgets) {
    head.push(
      '<script src="https://cdn.jsdelivr.net/npm/requirejs@2.3.6/require.min.js" integrity="sha384-c9c+LnTbwQ3aujuU7ULEPVvgLs+Fn6fJUvIGTsuu1ZcCf11fiEubah0ttpca4ntM sha384-6V1/AdqZRWk1KAlWbKBlGhN7VG4iE/yAZcO6NZPMF8od0vukrvr0tg4qY6NSrItx" crossorigin="anonymous"></script>',
    );
    head.push(
      '<script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js" integrity="sha384-ZvpUoO/+PpLXR1lu4jmpXWu80pZlYUAfxl5NsBMWOEPSjUn/6Z/hRTt8+pR6L4N2" crossorigin="anonymous" data-relocate-top="true"></script>',
    );
    head.push(
      "<script type=\"application/javascript\">define('jquery', [],function() {return window.jQuery;})</script>",
    );
  }

  // html libraries (e.g. plotly)
  head.push(...htmlLibraries);

  // jupyter widget runtime
  if (haveJupyterWidgets) {
    head.push(
      '<script src="https://cdn.jsdelivr.net/npm/@jupyter-widgets/html-manager@*/dist/embed-amd.js" crossorigin="anonymous"></script>',
    );
  }

  // write jupyter widget state after body if it exists
  const afterBody: string[] = [];

  if (haveJupyterWidgets && widgetsState) {
    const stateStr = JSON.stringify(widgetsState);
    // https://github.com/quarto-dev/quarto-cli/issues/8433
    if (stateStr.includes("</script>")) {
      afterBody.push(`<script>
      (() => {
        const scriptTag = document.createElement("script");
        const base64State = "${btoa(encodeURIComponent(stateStr))}";
        scriptTag.type = "${kApplicationJupyterWidgetState}";
        scriptTag.textContent = decodeURIComponent(atob(base64State));
        document.body.appendChild(scriptTag);
      })();
      </script>`);
    } else {
      afterBody.push(`<script type=${kApplicationJupyterWidgetState}>`);
      afterBody.push(JSON.stringify(widgetsState));
      afterBody.push("</script>");
    }
  }

  // create pandoc includes for our head and afterBody
  const widgetTempFile = (lines: string[]) => {
    const tempFile = Deno.makeTempFileSync(
      { dir: tempDir, prefix: "jupyter-widgets-", suffix: ".html" },
    );
    Deno.writeTextFileSync(tempFile, lines.join("\n") + "\n");
    return tempFile;
  };

  const result = {
    inHeader: "",
    afterBody: "",
  };
  if (head.length > 0) {
    result.inHeader = widgetTempFile(head);
  }
  if (afterBody.length > 0) {
    result.afterBody = widgetTempFile(afterBody);
  }
  return result;
}

function haveOutputType(nb: JupyterNotebook, mimeTypes: string[]) {
  return nb.cells.some((cell) => {
    if (cell.cell_type === "code" && cell.outputs) {
      return cell.outputs.some((output) => {
        if (isDisplayData(output)) {
          const outputTypes = Object.keys(
            (output as JupyterOutputDisplayData).data,
          );
          return outputTypes.some((type) => mimeTypes.includes(type));
        } else {
          return false;
        }
      });
    } else {
      return false;
    }
  });
}

function isWidgetIncludeHtml(html: string) {
  return isPlotlyLibrary(html);
}

function isPlotlyLibrary(html: string) {
  // Plotly before version 6 used require.js to load the library
  const hasRequireScript = (
    html: string,
  ) => (/^\s*<script type="text\/javascript">/.test(html) &&
    (/require\.undef\(["']plotly["']\)/.test(html) ||
      /define\('plotly'/.test(html)));
  // Plotly 6+ uses the new module syntax
  const hasModuleScript = (html: string) =>
    /\s*<script type=\"module\">import .*plotly.*<\/script>/.test(html);
  // notebook mode non connected embed plotly.js scripts like this:
  //  * plotly.js v3.0.1
  //  * Copyright 2012-2025, Plotly, Inc.
  //  * All rights reserved.
  //  * Licensed under the MIT license
  const hasEmbedScript = (
    html: string,
  ) => (/\* plotly\.js v\d+\.\d+\.\d+\s*\n\s*\* Copyright \d{4}-\d{4}, Plotly, Inc\.\s*\n\s*\* All rights reserved\.\s*\n\s*\* Licensed under the MIT license/
    .test(html));
  return hasRequireScript(html) ||
    // also handle new module syntax from plotly.py 6+
    hasModuleScript(html) ||
    // detect plotly by its copyright header
    hasEmbedScript(html);
}

function htmlLibrariesText(htmlText: string) {
  // strip leading space off of the content so it isn't seen as code by e.g. hugo
  const htmlLines = lines(htmlText);
  const leadingSpace = htmlLines.reduce<number>(
    (leading: number, line: string) => {
      const spaces = line.search(/\S/);
      if (spaces !== -1) {
        return Math.min(leading, spaces);
      } else {
        return leading;
      }
    },
    Number.MAX_SAFE_INTEGER,
  );
  if (leadingSpace !== Number.MAX_SAFE_INTEGER) {
    return htmlLines.map((line) => {
      if (line.trim().length === 0) {
        return "";
      } else {
        return line.replace(" ".repeat(leadingSpace), "");
      }
    }).join("\n");
  } else {
    return htmlText;
  }
}
