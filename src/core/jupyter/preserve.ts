/*
* preserve.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { kTextHtml, kTextMarkdown } from "../mime.ts";
import { isDisplayData } from "./display-data.ts";
import { JupyterNotebook, JupyterOutputDisplayData } from "./types.ts";

export function removeAndPreserveHtml(
  nb: JupyterNotebook,
): Record<string, string> | undefined {
  const htmlPreserve: { [key: string]: string } = {};

  nb.cells.forEach((cell) => {
    if (cell.cell_type === "code") {
      cell.outputs?.forEach((output) => {
        if (isDisplayData(output)) {
          const displayOutput = output as JupyterOutputDisplayData;
          const html = displayOutput.data[kTextHtml];
          const htmlText = Array.isArray(html) ? html.join("") : html as string;
          if (html && isPreservedHtml(htmlText)) {
            const key = "preserve" +
              globalThis.crypto.randomUUID().replaceAll("-", "");
            htmlPreserve[key] = htmlText;
            displayOutput.data[kTextMarkdown] = [key];
            displayOutput.noCaption = true;
            delete displayOutput.data[kTextHtml];
          }
        }
      });
    }
  });

  if (Object.keys(htmlPreserve).length > 0) {
    return htmlPreserve;
  } else {
    return undefined;
  }
}

export function restorePreservedHtml(
  html: string,
  preserve?: Record<string, string>,
) {
  if (preserve) {
    Object.keys(preserve).forEach((key) => {
      const keyLoc = html.indexOf(key);
      html = html.slice(0, keyLoc) + preserve[key] +
        html.slice(keyLoc + key.length);
    });
  }
  return html;
}

export function isPreservedHtml(_html: string) {
  return false;
}
