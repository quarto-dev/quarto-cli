/*
* progress.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { message } from "./console.ts";

export interface ProgressBarOptions {
  total?: number;
  width?: number;
}

export function progressBar(options: ProgressBarOptions) {
  const { total = 100, width = 50 } = options;

  let line = "";

  return (text: string, complete: number) => {
    // clear last line (in case it was longer than this list)
    if (line) {
      message(`\r${" ".repeat(line.length)}`, { newline: false });
    }

    // compute new line
    const progressBar = `${asciiProgressBar((complete / total) * 100, width)}`;
    line = `\r${progressBar} ${text}`;
    message(line, { newline: false });
  };
}

// Creates an ascii progress bar of a specified width, displaying a percentage complete
export function asciiProgressBar(percent: number, width?: number): string {
  width = width || 25;
  const segsComplete = Math.floor(percent / (100 / width));

  let progressBar = "[";
  for (let i = 0; i < width; i++) {
    progressBar = progressBar + (i < segsComplete ? "#" : " ");
  }
  progressBar = progressBar + "]";
  return progressBar;
}
