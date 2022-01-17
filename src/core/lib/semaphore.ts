/*
* semaphore.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

export class Semaphore {
  value: number;
  // deno-lint-ignore no-explicit-any
  tasks: any[];

  constructor(value: number) {
    this.value = value;
    this.tasks = [];
  }

  release() {
    this.value += 1;
    if (this.tasks.length) {
      const { resolve } = this.tasks.pop();
      resolve();
    }
  }

  async acquire() {
    if (this.value > 0) {
      this.value -= 1;
      return;
    }
    const result = new Promise((resolve, reject) => {
      this.tasks.push({ resolve, reject });
    });

    await result;
    await this.acquire();
  }

  // deno-lint-ignore no-explicit-any
  async runExclusive(fun: () => any) {
    await this.acquire();
    try {
      fun();
    } finally {
      this.release();
    }
  }
}
