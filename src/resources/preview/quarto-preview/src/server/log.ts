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

import { createErrorDialog } from "../ui/ErrorDialog";


interface LogEntry {
  readonly msg: string;
  readonly level: number;
  readonly levelName: string;
  readonly loggerName: string;
  readonly msgFormatted: string;
}


export function logHandler() {

  const logEntries = new Array(1000);
  let logEntriesOffset = 0;
  logEntriesOffset = 0;
  function recordLogEntry(entry: LogEntry) {
    logEntries[logEntriesOffset++] = entry;
    logEntriesOffset %= logEntries.length;
  }
  function getLogEntry(i: number) { // backwards, 0 is most recent
      return logEntries[(logEntriesOffset - 1 - i + logEntries.length) % logEntries.length];
  }

  // append for errors that occur within the error window
  let lastError = 0;
  let errorMsg = "";
  const kErrorWindow = 2500;
  const errorDialog = createErrorDialog();
  const renderErrorDialog = (open: boolean) => {
    errorDialog(open, errorMsg);
  };

  function showError(msg: string) {
    if (errorMsg && ((Date.now() - lastError) < kErrorWindow)) {
      errorMsg = errorMsg + "\n" +  msg;
    } else {
      errorMsg = msg
    }
    lastError = Date.now();
    renderErrorDialog(true);
    
    // post message to parent indicating we had an error
    if (window.parent.postMessage) {
      window.parent.postMessage({
        type: "error",
        msg: msg,
      }, "*");
    }
  }

  // see if there is already an error to show
  const renderError = document.getElementById("quarto-render-error");
  if (renderError) {
    showError(renderError.innerHTML.trim());
  }

  return (ev: MessageEvent<string>) : boolean => {
    if (ev.data.startsWith('log:')) {
      const log = JSON.parse(ev.data.substr(4)) as LogEntry;
      recordLogEntry(log);
      if (log.levelName === "ERROR") {
        showError(log.msgFormatted)
      } else {
        // see if there is a knitr error to report
        const kExecutionHalted = "Execution halted";
        if (log.msg.indexOf(kExecutionHalted) !== -1) {
          // scan backwards for beginning of error
          const errorEntries = [getLogEntry(0).msgFormatted];
          for (let i=1; i<logEntries.length; i++) {
            const logEntry = getLogEntry(i);
            if (logEntry) {
              errorEntries.unshift(logEntry.msgFormatted);
              if (logEntry.msg.indexOf("Quitting from lines") !== -1) {
                showError(errorEntries.join(""));
                break;
              } else if (logEntry.msg.indexOf(kExecutionHalted) !== -1) {
                break;
              }
            } else {
              break;
            }
          }
        }
      }
      return true;
    } else {
      return false;
    }
  }
}

