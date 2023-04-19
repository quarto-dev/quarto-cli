/*
 * log.ts
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

import { ANSIOutput } from "../core/ansi-output";
import { createErrorDialog } from "../ui/ErrorDialog";


interface LogEntry {
  readonly msg: string;
  readonly level: number;
  readonly levelName: string;
  readonly loggerName: string;
  readonly msgFormatted: string;
}


export function logHandler() {

  // append for errors that occur within the error window
  let ansiOutput = new ANSIOutput();
  const errorDialog = createErrorDialog();
  const renderErrorDialog = (open: boolean) => {
    errorDialog(open, ansiOutput.outputLines);
  };

  function showError() {
    // show dialog
    renderErrorDialog(true);
    
    // post message to parent indicating we had an error
    if (window.parent.postMessage) {
      window.parent.postMessage({
        type: "error"
      }, "*");
    }
  }

  // see if there is already an error to show
  const renderError = document.getElementById("quarto-render-error");
  if (renderError) {
    ansiOutput.processOutput(renderError.innerHTML.trim());
    showError();
  }

  return (ev: MessageEvent<string>) : boolean => {
    if (ev.data.startsWith('render:'))  {
      const [_,action,data] = ev.data.split(":");

      if (action === "stop" && data === "false") {
        // show error dialog if we concluded with an error
        showError();
      } else if (action === "start") {
         // reset ansi output
        ansiOutput = new ANSIOutput();
      }

     

      // allow progress handler to see this as well
      return false;

    } else if (ev.data.startsWith('log:')) {
      const log = JSON.parse(ev.data.substr(4)) as LogEntry;
      ansiOutput.processOutput(log.msgFormatted);
      if (log.levelName === "ERROR") {
        showError();
      }
      return true;
    } else {
      return false;
    }
  }
}

