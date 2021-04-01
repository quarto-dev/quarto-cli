/*
* console.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as colors from "fmt/colors.ts";
import { AnsiEscape } from "ansi/mod.ts";

export interface MessageOptions {
  newline?: boolean;
  bold?: boolean;
  dim?: boolean;
  format?: (line: string) => string;
  indent?: number;
}

// The spinner and progress characters
const kSpinnerChars = ["|", "/", "-", "\\"];
const kSpinerContainerChars = ["(", ")"];
const kSpinnerCompleteChar = "✓";
const kProgressIncrementChar = "#";
const kProgressContainerChars = ["[", "]"];
const kProgressBarWidth = 50;

export function message(line: string, options?: MessageOptions) {
  const {
    newline = true,
    bold = false,
    dim = false,
    format = undefined,
    indent = 0,
  } = options ||
    {} as MessageOptions;
  if (indent) {
    const pad = " ".repeat(indent);
    line = line
      .split(/\r?\n/)
      .map((line) => pad + line)
      .join("\n");
  }
  if (bold) {
    line = colors.bold(line);
  }
  if (dim) {
    line = colors.dim(line);
  }
  if (format) {
    line = format(line);
  }
  Deno.stderr.writeSync(
    new TextEncoder().encode(line + (newline ? "\n" : "")),
  );
}

// A progressBar display for the console
// Includes optional prefix message as well as status text and a final state
export function progressBar(total: number, prefixMessage?: string): {
  update: (progress: number, status?: string) => void;
  complete: (finalMsg?: string | boolean) => void;
} {
  // Core function to display the progressBar bar
  const updateProgress = (progress: number, status?: string) => {
    const progressBar = `${
      asciiProgressBar((progress / total) * 100, kProgressBarWidth)
    }`;
    const progressText = `\r${
      prefixMessage ? prefixMessage + " " : ""
    }${progressBar}${status ? " " + status : ""}`;

    clearLine();
    message(progressText, { newline: false });
  };

  // Return control functions for progressBar
  return {
    update: updateProgress,
    complete: (finalMsg?: string | boolean) => {
      // Clear the line and display an optional final message
      clearLine();
      if (typeof (finalMsg) === "string") {
        updateProgress(total, finalMsg);
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

// A spinner in the console. Displays a message with a spinner
// and when canceled can disappear or display a completed message.
export function spinner(
  status: string,
  timeInterval = 100,
): (finalMsg?: string | boolean) => void {
  // Used to spin the spinner
  let spin = 0;

  // Increment the spinner every timeInterval
  const id = setInterval(() => {
    // Display the message
    const char = kSpinnerChars[spin % kSpinnerChars.length];
    const msg = `${spinContainer(char)} ${status}`;
    message(`\r${msg}`, {
      newline: false,
    });

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
        completeMessage(status);
      }
    }
  };
}

function spinContainer(body: string) {
  return `${kSpinerContainerChars[0]}${body}${kSpinerContainerChars[1]}`;
}

function completeMessage(msg: string) {
  message(`\r${spinContainer(kSpinnerCompleteChar)} ${msg}`, {
    newline: true,
  });
}

export function messageFormatData(data: Uint8Array, options?: MessageOptions) {
  const decoder = new TextDecoder("utf8");
  const encoder = new TextEncoder();

  const { newline = true, bold = false, indent = 0 } = options || {};
  let output = decoder.decode(data);
  if (indent) {
    const pad = " ".repeat(indent);
    output = output
      .split(/\r?\n/)
      .map((output) => pad + output)
      .join("\n");
  }
  if (bold) {
    output = colors.bold(output);
  }

  Deno.stderr.writeSync(encoder.encode(output + (newline ? "\n" : "")));
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
  const contents = Deno.readAllSync(df);
  Deno.writeAllSync(Deno.stdout, contents);
  Deno.close(df.rid);
}

function clearLine() {
  AnsiEscape.from(Deno.stderr).eraseLine().cursorLeft();
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
