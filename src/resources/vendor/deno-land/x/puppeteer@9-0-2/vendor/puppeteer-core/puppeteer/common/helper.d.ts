import { CDPSession } from "./Connection.js";
import { Protocol } from "../../vendor/devtools-protocol/types/protocol.d.ts";
import { CommonEventEmitter } from "./EventEmitter.js";
export declare const debugError: (...args: unknown[]) => void;
declare function getExceptionMessage(
  exceptionDetails: Protocol.Runtime.ExceptionDetails,
): string;
declare function valueFromRemoteObject(
  remoteObject: Protocol.Runtime.RemoteObject,
): any;
declare function releaseObject(
  client: CDPSession,
  remoteObject: Protocol.Runtime.RemoteObject,
): Promise<void>;
/**
 * @public
 */
export interface PuppeteerEventListener {
  emitter: CommonEventEmitter;
  eventName: string | symbol;
  handler: (...args: any[]) => void;
}
declare function addEventListener(
  emitter: CommonEventEmitter,
  eventName: string | symbol,
  handler: (...args: any[]) => void,
): PuppeteerEventListener;
declare function removeEventListeners(
  listeners: Array<{
    emitter: CommonEventEmitter;
    eventName: string | symbol;
    handler: (...args: any[]) => void;
  }>,
): void;
declare function isString(obj: unknown): obj is string;
declare function isNumber(obj: unknown): obj is number;
declare function waitForEvent<T extends any>(
  emitter: CommonEventEmitter,
  eventName: string | symbol,
  predicate: (event: T) => Promise<boolean> | boolean,
  timeout: number,
  abortPromise: Promise<Error>,
): Promise<T>;
declare function evaluationString(
  fun: Function | string,
  ...args: unknown[]
): string;
declare function pageBindingInitString(type: string, name: string): string;
declare function pageBindingDeliverResultString(
  name: string,
  seq: number,
  result: unknown,
): string;
declare function pageBindingDeliverErrorString(
  name: string,
  seq: number,
  message: string,
  stack: string,
): string;
declare function pageBindingDeliverErrorValueString(
  name: string,
  seq: number,
  value: unknown,
): string;
declare function makePredicateString(
  predicate: Function,
  predicateQueryHandler?: Function,
): string;
declare function waitWithTimeout<T extends any>(
  promise: Promise<T>,
  taskName: string,
  timeout: number,
): Promise<T>;
declare function readProtocolStream(
  client: CDPSession,
  handle: string,
  path?: string,
): Promise<Uint8Array>;
export declare const helper: {
  evaluationString: typeof evaluationString;
  pageBindingInitString: typeof pageBindingInitString;
  pageBindingDeliverResultString: typeof pageBindingDeliverResultString;
  pageBindingDeliverErrorString: typeof pageBindingDeliverErrorString;
  pageBindingDeliverErrorValueString: typeof pageBindingDeliverErrorValueString;
  makePredicateString: typeof makePredicateString;
  readProtocolStream: typeof readProtocolStream;
  waitWithTimeout: typeof waitWithTimeout;
  waitForEvent: typeof waitForEvent;
  isString: typeof isString;
  isNumber: typeof isNumber;
  addEventListener: typeof addEventListener;
  removeEventListeners: typeof removeEventListeners;
  valueFromRemoteObject: typeof valueFromRemoteObject;
  getExceptionMessage: typeof getExceptionMessage;
  releaseObject: typeof releaseObject;
};
export {};
