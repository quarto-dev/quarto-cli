/// <reference types="./DeferredPromise.d.ts" />
import { TimeoutError } from "../common/Errors.js";
/**
 * Creates an returns a promise along with the resolve/reject functions.
 *
 * If the promise has not been resolved/rejected withing the `timeout` period,
 * the promise gets rejected with a timeout error.
 *
 * @internal
 */
export function createDeferredPromiseWithTimer(timeoutMessage, timeout = 5000) {
  let isResolved = false;
  let isRejected = false;
  let resolver = (_) => {};
  let rejector = (_) => {};
  const taskPromise = new Promise((resolve, reject) => {
    resolver = resolve;
    rejector = reject;
  });
  const timeoutId = setTimeout(() => {
    isRejected = true;
    rejector(new TimeoutError(timeoutMessage));
  }, timeout);
  return Object.assign(taskPromise, {
    resolved: () => {
      return isResolved;
    },
    finished: () => {
      return isResolved || isRejected;
    },
    resolve: (value) => {
      clearTimeout(timeoutId);
      isResolved = true;
      resolver(value);
    },
    reject: (err) => {
      clearTimeout(timeoutId);
      isRejected = true;
      rejector(err);
    },
  });
}
/**
 * Creates an returns a promise along with the resolve/reject functions.
 *
 * @internal
 */
export function createDeferredPromise() {
  let isResolved = false;
  let isRejected = false;
  let resolver = (_) => {};
  let rejector = (_) => {};
  const taskPromise = new Promise((resolve, reject) => {
    resolver = resolve;
    rejector = reject;
  });
  return Object.assign(taskPromise, {
    resolved: () => {
      return isResolved;
    },
    finished: () => {
      return isResolved || isRejected;
    },
    resolve: (value) => {
      isResolved = true;
      resolver(value);
    },
    reject: (err) => {
      isRejected = true;
      rejector(err);
    },
  });
}
//# sourceMappingURL=DeferredPromise.js.map
