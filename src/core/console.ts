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

// A progress display for the console
// Includes optional prefix message as well as status text and a final state
export function progress(total: number, prefixMessage?: string): {
  update: (progress: number, status?: string) => void;
  complete: () => void;
} {
  // Core function to display the progress bar
  const progress = (progress: number, status?: string) => {
    const progressBar = `${asciiProgressBar((progress / total) * 100, 50)}`;
    const progressText = `\r${
      prefixMessage ? prefixMessage + " " : ""
    }${progressBar}${" " + status || ""}`;

    clearLine();
    message(progressText, { newline: false });
  };

  // Display empty progress
  progress(0, "");

  // Return control functions for progress
  return {
    update: progress,
    complete: (clear?: boolean) => {
      clearLine();
      if (!clear && prefixMessage) {
        message(`\r(✓) ${prefixMessage}`, { newline: true });
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
      message(`\r${spinContainer(kSpinnerCompleteChar)} ${finalMsg}`, {
        newline: true,
      });
    } else {
      if (finalMsg !== false) {
        message(`\r${spinContainer(kSpinnerCompleteChar)} ${status}`, {
          newline: true,
        });
      }
    }
  };
}

// The spinner characters
const kSpinnerChars = ["|", "/", "-", "\\"];
const kSpinnerCompleteChar = "✓";
function spinContainer(body: string) {
  return `(${body})`;
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

// Creates an ascii progress bar of a specified width, displaying a percentage complete
function asciiProgressBar(percent: number, width = 25): string {
  const segsComplete = Math.floor(percent / (100 / width));
  let progressBar = "[";
  for (let i = 0; i < width; i++) {
    progressBar = progressBar + (i < segsComplete ? "#" : " ");
  }
  progressBar = progressBar + "]";
  return progressBar;
}
