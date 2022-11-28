/**
 * @internal
 */
export interface DeferredPromise<T> extends Promise<T> {
  finished: () => boolean;
  resolved: () => boolean;
  resolve: (_: T) => void;
  reject: (_: Error) => void;
}
/**
 * Creates an returns a promise along with the resolve/reject functions.
 *
 * If the promise has not been resolved/rejected withing the `timeout` period,
 * the promise gets rejected with a timeout error.
 *
 * @internal
 */
export declare function createDeferredPromiseWithTimer<T>(
  timeoutMessage: string,
  timeout?: number,
): DeferredPromise<T>;
/**
 * Creates an returns a promise along with the resolve/reject functions.
 *
 * @internal
 */
export declare function createDeferredPromise<T>(): DeferredPromise<T>;
