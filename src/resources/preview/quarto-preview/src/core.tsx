
import React from "react";
import { createRoot } from 'react-dom/client';

import AnsiUp from 'ansi_up';
import MicroModal from 'micromodal'; 

import './core.css'

interface LogEntry {
  readonly msg: string;
  readonly level: number;
  readonly levelName: string;
  readonly loggerName: string;
  readonly msgFormatted: string;
}

export function initializeDevserverCore() {

  // create error dialog (initially hidden)
  const errorDialogEl = document.createElement("div");
  document.body.appendChild(errorDialogEl);
  const root = createRoot(errorDialogEl);
  root.render(<ErrorDialog />);

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
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let path = window.location.pathname;
  if (!/\/$/.test(path)) path += "/";
  const devServerSocket = new WebSocket(protocol + "//" + window.location.host + path);
  let reloadPage = true;
  addEventListener("beforeunload", () => {
    // don't reload page in case of navigation events
    reloadPage = false;
  })
  devServerSocket.onopen = () => {
    console.log('Socket connection open. Listening for events.');
    // if the socket closes for any reason (e.g. this occurs in electron apps
    // when the computer suspends) then reload to reestablish the connection 
    devServerSocket.onclose = () => {
      if (reloadPage) {
        console.log('Socket connection closed. Reloading.');
        window.location.reload();
      }
    }
  };
  // append for errors that occur within the error window
  let lastError = 0;
  const kErrorWindow = 2500;
  function showError(msg: string) {
    const ansiUp = new AnsiUp()
    const html = ansiUp.ansi_to_html(msg.trim());
    const display = document.getElementById("quarto-log-error-display")!;
    if (display.innerHTML && ((Date.now() - lastError) < kErrorWindow)) {
      display.innerHTML = display.innerHTML + "<br/>" +  html;
    } else {
      display.innerHTML = html
    }
    lastError = Date.now()
    
    MicroModal.show('quarto-log-error-modal', {
      awaitCloseAnimation: true,
      onClose: () => { display.innerHTML = ""; }
    });

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
  const normalizeTarget = (target: string) => {
    return target.replace(/\/index\.html/, "/")
  };
  devServerSocket.onmessage = (msg) => {
    if (msg.data.startsWith('reload')) {
      let target = normalizeTarget(msg.data.replace(/^reload/, ""));
      // prepend proxy path to target if we have one
      if (target) {
        const pathPrefix = 
          window.location.pathname.match(/^.*?\/p\/\w+\//) ||
          window.location.pathname.match(/^.*?\/user\/[\w\d]+\/proxy\/\d+\//);
        if (pathPrefix) {
          target = pathPrefix + target.slice(1);
        }
      }
      if (target && (target !== normalizeTarget(window.location.pathname))) {
        window.location.replace(target);
      } else {
        window.location.reload();
      }
    } else if (msg.data.startsWith('log:')) {
      const log = JSON.parse(msg.data.substr(4)) as LogEntry;
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
    }
  };

  return () => {
    try {
      devServerSocket.close();
    } catch(error) {
      console.error(error);
    }
  }
}



function ErrorDialog() {
  return (
    <div className="modal__dialog micromodal-slide" id="quarto-log-error-modal" aria-hidden="true">
      <div className="modal__overlay" tabIndex={2} data-micromodal-close="1">
        <div className="modal__container" role="dialog" aria-modal="true" aria-labelledby="quarto-log-error-modal-title">
          <header className="modal__header">
            <h2 className="modal__title" id="quarto-log-error-modal-title">
              <i className="bi bi-exclamation-circle"></i>Error
            </h2>
            <button className="modal__close" aria-label="Close modal" data-micromodal-close></button>
          </header>
          <div className="modal__content" id="quarto-log-error-modal-content">
            <pre tabIndex={1} id="quarto-log-error-display"></pre>
          </div>
          <footer className="modal__footer">
          </footer>
        </div>
      </div>
    </div>
  );
}