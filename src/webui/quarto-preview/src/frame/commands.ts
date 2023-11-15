/*
 * command.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */


export function handleCommands() {
    // forward keydown events so shortcuts can work in vscode, see:
  // https://github.com/microsoft/vscode/issues/65452#issuecomment-586485815
  if (window.parent.postMessage) {
    window.document.addEventListener('keydown', e => {
      const event = {
        type: "keydown",
        data: {
          altKey: e.altKey,
          code: e.code,
          ctrlKey: e.ctrlKey,
          isComposing: e.isComposing,
          key: e.key,
          location: e.location,
          metaKey: e.metaKey,
          repeat: e.repeat,
          shiftKey: e.shiftKey
        }
      };
      window.parent.postMessage(event, '*');
    });
  }
  // listen for execCommand messages
  window.addEventListener("message", function (event) {
    if (event.data.type === "devhost-exec-command") {
      window.document.execCommand(event.data.data);
    } 
  }, true);
}