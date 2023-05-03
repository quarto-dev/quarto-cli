/*
 * progress.tsx
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

import React from "react"
import { createRoot } from "react-dom/client";
import { ANSIOutput, ANSIOutputLine } from "../core/ansi-output";
import { Progress } from "../ui/Progress";

interface LogEntry {
  readonly msg: string;
  readonly level: number;
  readonly levelName: string;
  readonly loggerName: string;
  readonly msgFormatted: string;
}

export function progressHandler(darkMode: boolean) {
  
  return (stopServer: VoidFunction) => {
     // track state used to render progress
    const state = {
      rendering: false,
      dialog: false,
      error: false,
      output: new ANSIOutput(),
      lines: new Array<ANSIOutputLine>()
    };
  
    // create progress ui and provide function to render it from current state
    const progressEl = document.createElement("div");
    document.body.appendChild(progressEl);
    const progressRoot = createRoot(progressEl);
    const renderProgress = () => {
      progressRoot.render(<Progress 
        rendering={state.rendering}
        dialog={state.dialog}
        error={state.error}
        lines={state.lines}
        onCancel={stopServer}
        darkMode={darkMode}
      />);
    };

    // start rendering
    const renderStart = (lastRenderTime?: number) => {
      // core state for new render
      state.rendering = true;
      state.error = false;
      state.output = new ANSIOutput()
      state.lines = [];

      // show dialog now if we expect a slow render, otherwise wait 2 seconds
      const kRenderProgressThreshold = 2000;
      if (lastRenderTime === undefined || lastRenderTime > kRenderProgressThreshold) {
        state.dialog = true;
      } else {
        setTimeout(() => {
           if (state.rendering) {
            state.dialog = true;
            renderProgress();
          }
        }, kRenderProgressThreshold);
      }

      // update ui (could just be the progress bar if there is no dialog)
      renderProgress();
    }

    // stop rendering
    const renderStop = (success: boolean) => {
      state.rendering = false;
      state.dialog = !success;
      state.error = !success;
      renderProgress();

      // additional side effect: let vscode frame know we had 
      // an error so it can halt its progress treatment
      if (!success) {
        // post message to parent indicating we had an error
        if (window.parent.postMessage) {
          window.parent.postMessage({
            type: "error"
          }, "*");
        }
      }
    }

    // render output
    const renderOutput = (output: LogEntry | string) => {
      output = typeof(output) === "string" ? output : output.msgFormatted;

      const logOutput = (loggingOutput: string) => {
        loggingOutput = loggingOutput.replaceAll('\n', '[LF]');
        loggingOutput = loggingOutput.replaceAll('\r', '[CR]');
        loggingOutput = loggingOutput.replaceAll('\x9B', 'CSI');
        loggingOutput = loggingOutput.replaceAll('\x1b', 'ESC');
        loggingOutput = loggingOutput.replaceAll('\x9B', 'CSI');
        console.log(loggingOutput);
      }
      //logOutput(output);

      state.output.processOutput(output);
      state.lines = [...state.output.outputLines];
      renderProgress();
    }

    // see if there is already an error to show
    const renderError = document.getElementById("quarto-render-error");
    if (renderError) {
      renderStart();
      renderOutput(renderError.innerHTML.trim());
      renderStop(false);
    } else {
      renderProgress();
    }

    return (ev: MessageEvent<string>) : boolean => {
      if (ev.data.startsWith('render:'))  {
        const [_,action,data] = ev.data.split(":");
        if (action === "start") {
          renderStart(parseInt(data));
        } else if (action === "stop") {
          renderStop(data === "true");
        }
        return true;
      } else if (ev.data.startsWith('log:')) {
        const log = JSON.parse(ev.data.substr(4)) as LogEntry;
        renderOutput(log);
        return true;
      } else {
        return false;
      }
    }
  }
}

