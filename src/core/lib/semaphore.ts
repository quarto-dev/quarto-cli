/*
* semaphore.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

export class Semaphore
{
  value: number;
  tasks: any[];
  
  constructor(value) {
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

  acquire() {
    if (this.value > 0) {
      this.value -= 1;
      let res;
      const result = new Promise((resolve) => { res = resolve; });
      res();
      return result;
    }
    const result = new Promise((resolve, reject) => {
      this.tasks.push({ resolve, reject });
    });
    
    return result.then(() => {
      return this.acquire();
    });
  }

  async runExclusive(fun: () => any) {
    await this.acquire();
    try {
      fun();
    } finally {
      this.release();
    }
  }
}
