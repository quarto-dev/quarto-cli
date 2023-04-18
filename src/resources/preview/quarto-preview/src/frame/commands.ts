/*
 * command.ts
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