/*
* preserve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { generate as generateUuid } from "uuid/v4.ts";

import { kTextHtml, kTextMarkdown } from "../mime.ts";
import { isDisplayData } from "./display_data.ts";
import { JupyterNotebook, JupyterOutputDisplayData } from "./jupyter.ts";

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
          if (html) {
            const key = generateUuid();
            htmlPreserve[key] = htmlText;
            displayOutput.data[kTextMarkdown] = [
              "```{=html}\n" + key + "\n```\n",
            ];
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
  preserved: Record<string, string>,
) {
  Object.keys(preserved).forEach((key) => {
    const keyLoc = html.indexOf(key);
    html = html.slice(0, keyLoc) + preserved[key] +
      html.slice(keyLoc + key.length);
  });
  return html;
}
