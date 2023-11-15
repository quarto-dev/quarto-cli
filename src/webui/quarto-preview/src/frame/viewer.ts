/*
 * viewer.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
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