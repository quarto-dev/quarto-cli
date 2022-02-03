/*
* web-worker-manager.ts
*
* enables RPC-style for web workers
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

// TODO figure out typings. This is meant to be (...args: any[]) => any
// deno-lint-ignore no-explicit-any
export type Callable = any;

// TODO figure out typings. This is meant to be the type returned by new Worker()
// deno-lint-ignore no-explicit-any
export type WebWorker = any;

export function clientStubs(
  calls: string[],
  worker: WebWorker,
): Record<string, Callable> {
  let callId = 0;
  const nextId = () => callId++;
  const result: Record<string, Callable> = {};
  const promises: Record<number, { resolve: Callable; reject: Callable }> = {};
  for (const callName of calls) {
    result[callName] = (...args: any) => {
      const thisId = nextId();
      worker.postMessage({
        callName,
        // The IDE sends some arrays with funky functions in the
        // prototype, so the web worker API tries to clone those and
        // fails. We strip them in a potentially slow way, so we
        // should watch out for performance here.
        args: JSON.parse(JSON.stringify(args)),
        id: thisId,
      });
      return new Promise((resolve, reject) => {
        promises[thisId] = { resolve, reject };
      });
    };
  }
  worker.onmessage = function (e) {
    const { result, exception, id } = e.data;
    if (promises[id] === undefined) {
      throw new Error(`Internal Error: bad call id ${id} in web worker RPC`);
    }
    const { resolve, reject } = promises[id];
    delete promises[id];
    if (result) {
      resolve(result);
    } else if (exception) {
      reject(exception);
    }
  };
  return result;
}

export function workerCallback(calls: Record<string, Callable>): Callable {
  return async function (e) {
    const { callName, args, id } = e.data;
    try {
      const result = await calls[callName](...args);
      postMessage({ result, id });
    } catch (e) {
      postMessage({ exception: e, id });
    }
  };
}
