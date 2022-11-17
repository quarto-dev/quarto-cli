/*
* retry.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { sleep } from "./wait.ts";

export type RetryOptions = {
  attempts?: number;
  minWait?: number;
  maxWait?: number;
  retry?: (err: Error) => boolean;
};

export async function withRetry<T = void>(
  fn: () => Promise<T>,
  options?: RetryOptions,
) {
  const {
    attempts = 10,
    minWait = 1000,
    maxWait = 4000,
    retry = () => true,
  } = (options || {});
  let attempt = 0;
  while (true) {
    try {
      return fn();
    } catch (err) {
      if ((attempt++ >= attempts) || (retry && !retry(err))) {
        throw err;
      }
      const delay = minWait + Math.floor(Math.random() * (maxWait - minWait));
      await sleep(delay);
    }
  }
}
