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

export function handleViewerMessages(inputFile: string | null) {
  if (window.parent.postMessage) {
    // wait for message providing confirmation we are in a devhost
    window.addEventListener("message", function (event) {
      if (event.data.type === "devhost-init") {
        window.quartoDevhost = {
          openInputFile: function (
            line: number,
            column: number,
            highlight: boolean,
          ) {
            if (inputFile === null) {
              console.warn(
                "Missing inputFile when atempting to open input file.",
              );
              return;
            }

            window.parent.postMessage({
              type: "openfile",
              file: inputFile,
              line: line,
              column: column,
              highlight: highlight,
            }, event.origin);
          },
        };
      } else if (event.data.type === "goback") {
        window.history.back();
      } else if (event.data.type === "goforward") {
        window.history.forward();
      }
    }, true);

    if (inputFile === null) {
      console.warn(
        "Missing inputFile when atempting to post message.",
      );
    } else {
      // notify host of navigation (e.g. for 'pop out' command)
      window.parent.postMessage({
        type: "navigate",
        href: window.location.href,
        file: inputFile,
      }, "*");
    }
  }
}