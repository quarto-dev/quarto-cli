/*
* display-data.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as ld from "../../core/lodash.ts";

import {
  kApplicationJavascript,
  kApplicationJupyterWidgetState,
  kApplicationJupyterWidgetView,
  kApplicationPdf,
  kImageJpeg,
  kImagePng,
  kImageSvg,
  kTextHtml,
  kTextLatex,
  kTextMarkdown,
  kTextPlain,
} from "../mime.ts";
import {
  JupyterCell,
  JupyterOutput,
  JupyterOutputDisplayData,
  JupyterToMarkdownOptions,
} from "./types.ts";

export function isDisplayData(
  output: JupyterOutput,
): output is JupyterOutputDisplayData {
  return ["display_data", "execute_result"].includes(output.output_type);
}

export function isCaptionableData(output: JupyterOutput) {
  if (isDisplayData(output)) {
    const displayData = output as JupyterOutputDisplayData;
    return !displayData.noCaption;
  } else {
    return false;
  }
}

export function displayDataMimeType(
  output: JupyterOutputDisplayData,
  options: JupyterToMarkdownOptions,
) {
  const displayPriority = [
    kTextMarkdown,
    kImageSvg,
    kImagePng,
    kImageJpeg,
  ];
  if (options.toHtml) {
    const htmlFormats = [
      kApplicationJupyterWidgetState,
      kApplicationJupyterWidgetView,
      kApplicationJavascript,
      kTextHtml,
    ];
    // if we are targeting markdown w/ html then prioritize the html formats
    // (this is b/c jupyter widgets also provide a text/markdown representation
    // that we don't want to have "win" over the widget)
    if (options.toMarkdown) {
      displayPriority.unshift(...htmlFormats);
      // otherwise put them after markdown
    } else {
      displayPriority.push(...htmlFormats);
    }
    displayPriority.unshift(
      kApplicationJupyterWidgetState,
      kApplicationJupyterWidgetView,
      kApplicationJavascript,
      kTextHtml,
    );
  } else if (options.toLatex) {
    displayPriority.push(
      kTextLatex,
      kApplicationPdf,
    );
  } else if (options.toMarkdown) {
    displayPriority.push(
      kTextHtml,
    );
  }

  // if there is an html table then add html (as we can read this directly
  // into the pandoc AST in our lua filters)
  if (displayDataHasHtmlTable(output) && !displayPriority.includes(kTextHtml)) {
    displayPriority.push(kTextHtml);
  }

  // always add text/plain
  displayPriority.push(
    kTextPlain,
  );

  const availDisplay = Object.keys(output.data);
  for (const display of displayPriority) {
    if (availDisplay.includes(display)) {
      return display;
    }
  }
  return null;
}

export function displayDataWithMarkdownMath(output: JupyterOutputDisplayData) {
  if (Array.isArray(output.data[kTextLatex]) && !output.data[kTextMarkdown]) {
    const latex = output.data[kTextLatex] as string[];
    if (
      latex.length > 0 && latex[0].startsWith("$") &&
      latex[latex.length - 1].endsWith("$")
    ) {
      output = ld.cloneDeep(output);
      output.data[kTextMarkdown] = output.data[kTextLatex];
      return output;
    }
  }
  return output;
}

export function displayDataHasHtmlTable(output: JupyterOutputDisplayData) {
  const html = output.data[kTextHtml] as string[] || undefined;
  if (html) {
    const htmlLower = html.map((line) => line.toLowerCase());
    return htmlLower.some((line) => !!line.match(/<[Tt][Aa][Bb][Ll][Ee]/)) &&
      htmlLower.some((line) => !!line.match(/<\/[Tt][Aa][Bb][Ll][Ee]/));
  } else {
    return false;
  }
}

export function displayDataIsImage(mimeType: string) {
  return [kImagePng, kImageJpeg, kImageSvg, kApplicationPdf].includes(mimeType);
}

export function displayDataIsTextPlain(mimeType: string) {
  return [kTextPlain].includes(mimeType);
}

export function displayDataIsMarkdown(mimeType: string) {
  return [kTextMarkdown].includes(mimeType);
}

export function displayDataIsLatex(mimeType: string) {
  return [kTextLatex].includes(mimeType);
}

export function displayDataIsHtml(mimeType: string) {
  return [kTextHtml].includes(mimeType);
}

export function displayDataIsJson(mimeType: string) {
  return [kApplicationJupyterWidgetState, kApplicationJupyterWidgetView]
    .includes(mimeType);
}

export function displayDataIsJavascript(mimeType: string) {
  return [kApplicationJavascript].includes(mimeType);
}

export function cellHasOnlyMarkdownDisplayData(
  cell: JupyterCell,
  options: JupyterToMarkdownOptions,
) {
  if (cell.outputs) {
    return cell.outputs.every((output) => {
      if (isDisplayData(output)) {
        const mimeType = displayDataMimeType(output, options);
        return mimeType && displayDataIsMarkdown(mimeType);
      } else {
        return false;
      }
    });
  } else {
    return false;
  }
}
