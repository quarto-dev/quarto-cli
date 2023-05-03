/*
 * viewer.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

declare global {
  interface Window {
    quartoDevhost: {
      openInputFile(line: number, column: number, highlight: boolean) : void;
    }
  }
}
export function handleViewerMessages() {

  if (window.parent.postMessage) {
    // wait for message providing confirmation we are in a devhost
    window.addEventListener("message", function (event) {
      if (event.data.type === "devhost-init") {
        window.quartoDevhost = {
          openInputFile: function (line: number, column: number, highlight: boolean) {
            window.parent.postMessage({
              type: "openfile",
              file: "<%- inputFile %>",
              line: line,
              column: column,
              highlight: highlight
            }, event.origin);
          }
        };

      } else if (event.data.type === "goback") {
        window.history.back()
      } else if (event.data.type === "goforward") {
        window.history.forward()
      }
    }, true);

    // notify host of navigation (e.g. for 'pop out' command)
    window.parent.postMessage({
      type: "navigate",
      href: window.location.href,
      file: "<%- inputFile %>"
    }, "*");
  }
}