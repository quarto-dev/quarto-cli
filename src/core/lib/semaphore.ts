/*
* semaphore.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
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

  async runExclusive<T>(fun: () => Promise<T>) {
    await this.acquire();
    try {
      const result = await fun();
      this.release();
      return result;
    } catch (e) {
      this.release();
      throw e;
    }
  }
}
