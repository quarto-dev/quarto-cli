/*
 * console.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ansi } from "cliffy/ansi/mod.ts";
import { writeAllSync } from "streams/write_all.ts";
import { readAllSync } from "streams/read_all.ts";
import { info } from "log/mod.ts";
import { runningInCI } from "./ci-info.ts";
import { SpinnerOptions } from "./console-types.ts";

// The spinner and progress characters
const kSpinnerChars = ["|", "/", "-", "\\"];
const kSpinerContainerChars = ["(", ")"];
const kSpinerCompleteContainerChars = ["[", "]"];
const kSpinnerCompleteChar = Deno.build.os !== "windows" ? "✓" : ">";
const kProgressIncrementChar = "#";
const kProgressContainerChars = ["[", "]"];
const kProgressBarWidth = 35;

// A progressBar display for the console
// Includes optional prefix message as well as status text and a final state
export function progressBar(total: number, prefixMessage?: string): {
  update: (progress: number, status?: string) => void;
  complete: (finalMsg?: string | boolean) => void;
} {
  const isCi = runningInCI();
  if (isCi && prefixMessage) {
    info(prefixMessage);
  }

  // Core function to display the progressBar bar
  const updateProgress = (progress: number, status?: string) => {
    if (!isCi) {
      const progressBar = `${
        asciiProgressBar((progress / total) * 100, kProgressBarWidth)
      }`;
      const progressText = `\r${
        prefixMessage ? prefixMessage + " " : ""
      }${progressBar}${status ? " " + status : ""}`;

      clearLine();
      info(progressText, { newline: false });
    }
  };

  // Return control functions for progressBar
  return {
    update: updateProgress,
    complete: (finalMsg?: string | boolean) => {
      // Clear the line and display an optional final message
      if (!isCi) {
        clearLine();
      }

      if (typeof (finalMsg) === "string") {
        if (isCi) {
          info(finalMsg);
        } else {
          updateProgress(total, finalMsg);
        }
      } else {
        if (finalMsg !== false && prefixMessage) {
          completeMessage(prefixMessage);
        } else if (finalMsg !== false) {
          updateProgress(total);
        }
      }
    },
  };
}

export async function withSpinner<T>(
  options: SpinnerOptions,
  op: () => Promise<T>,
) {
  const cancel = spinner(options.message);
  try {
    return await op();
  } finally {
    cancel(options.doneMessage);
  }
}

// A spinner in the console. Displays a message with a spinner
// and when canceled can disappear or display a completed message.
export function spinner(
  status: string | (() => string),
  timeInterval = 100,
): (finalMsg?: string | boolean) => void {
  // Used to spin the spinner
  let spin = 0;

  // status fn
  const statusFn = typeof (status) === "string"
    ? () => {
      return status;
    }
    : () => {
      if (!runningInCI()) {
        clearLine();
      }
      return status();
    };

  // Increment the spinner every timeInterval
  const id = setInterval(() => {
    // Display the message
    const char = kSpinnerChars[spin % kSpinnerChars.length];
    const msg = `${spinContainer(char)} ${statusFn()}`;

    // when running in CI only show the first tick
    if (!runningInCI() || spin === 0) {
      info(`\r${msg}`, {
        newline: false,
      });
    }

    // Increment the spin counter
    spin = spin + 1;
  }, timeInterval);

  // Use returned function to cancel the spinner
  return (finalMsg?: string | boolean) => {
    // Clear the spin interval
    clearInterval(id);

    // Clear the line and display an optional final message
    clearLine();
    if (typeof (finalMsg) === "string") {
      completeMessage(finalMsg);
    } else {
      if (finalMsg !== false) {
        completeMessage(statusFn());
      }
    }
  };
}

function spinContainer(body: string) {
  return `${kSpinerContainerChars[0]}${body}${kSpinerContainerChars[1]}`;
}

export function completeMessage(msg: string) {
  info(
    `\r${kSpinerCompleteContainerChars[0]}${kSpinnerCompleteChar}${
      kSpinerCompleteContainerChars[1]
    } ${msg}`,
    {
      newline: true,
    },
  );
}

export function formatLine(values: string[], lengths: number[]) {
  const line: string[] = [];
  values.forEach((value, i) => {
    const len = lengths[i];
    if (value.length === len) {
      line.push(value);
    } else if (value.length > len) {
      line.push(value.substr(0, len));
    } else {
      line.push(value.padEnd(len, " "));
    }
  });
  return line.join("");
}

export function writeFileToStdout(file: string) {
  const df = Deno.openSync(file, { read: true });
  const contents = readAllSync(df);
  writeAllSync(Deno.stdout, contents);
  Deno.close(df.rid);
}

export function clearLine() {
  info(ansi.eraseLine.cursorLeft(), { newline: false });
}

// Creates an ascii progressBar bar of a specified width, displaying a percentage complete
function asciiProgressBar(percent: number, width = 25): string {
  const segsComplete = Math.floor(percent / (100 / width));
  let progressBar = kProgressContainerChars[0];
  for (let i = 0; i < width; i++) {
    progressBar = progressBar +
      (i < segsComplete ? kProgressIncrementChar : " ");
  }
  progressBar = progressBar + kProgressContainerChars[1];
  return progressBar;
}
