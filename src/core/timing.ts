/*
* timing.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

export class Timer
{
  mark: number;

  constructor() {
    this.mark = 0;
    this.reset();
  }

  reset() {
    this.mark = performance.now();
  }
 
  elapsed() {
    return performance.now() - this.mark;
  }

  report(msg: string) {
    console.log(`${msg}: ${(this.elapsed() / 1000)}s`);
  }
};
