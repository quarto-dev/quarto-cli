/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Protocol } from "../../vendor/devtools-protocol/types/protocol.d.ts";
import { CDPSession } from "./Connection.js";
import { ElementHandle } from "./ElementHandle.js";
import { CommonEventEmitter } from "./EventEmitter.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { JSHandle } from "./JSHandle.js";
/**
 * @internal
 */
export declare const debugError: (...args: unknown[]) => void;
/**
 * @internal
 */
export declare function getExceptionMessage(
  exceptionDetails: Protocol.Runtime.ExceptionDetails,
): string;
/**
 * @internal
 */
export declare function valueFromRemoteObject(
  remoteObject: Protocol.Runtime.RemoteObject,
): any;
/**
 * @internal
 */
export declare function releaseObject(
  client: CDPSession,
  remoteObject: Protocol.Runtime.RemoteObject,
): Promise<void>;
/**
 * @internal
 */
export interface PuppeteerEventListener {
  emitter: CommonEventEmitter;
  eventName: string | symbol;
  handler: (...args: any[]) => void;
}
/**
 * @internal
 */
export declare function addEventListener(
  emitter: CommonEventEmitter,
  eventName: string | symbol,
  handler: (...args: any[]) => void,
): PuppeteerEventListener;
/**
 * @internal
 */
export declare function removeEventListeners(
  listeners: Array<{
    emitter: CommonEventEmitter;
    eventName: string | symbol;
    handler: (...args: any[]) => void;
  }>,
): void;
/**
 * @internal
 */
export declare const isString: (obj: unknown) => obj is string;
/**
 * @internal
 */
export declare const isNumber: (obj: unknown) => obj is number;
/**
 * @internal
 */
export declare function waitForEvent<T>(
  emitter: CommonEventEmitter,
  eventName: string | symbol,
  predicate: (event: T) => Promise<boolean> | boolean,
  timeout: number,
  abortPromise: Promise<Error>,
): Promise<T>;
/**
 * @internal
 */
export declare function createJSHandle(
  context: ExecutionContext,
  remoteObject: Protocol.Runtime.RemoteObject,
): JSHandle | ElementHandle<any>;
/**
 * @internal
 */
export declare function evaluationString(
  fun: Function | string,
  ...args: unknown[]
): string;
/**
 * @internal
 */
export declare function pageBindingInitString(
  type: string,
  name: string,
): string;
/**
 * @internal
 */
export declare function pageBindingDeliverResultString(
  name: string,
  seq: number,
  result: unknown,
): string;
/**
 * @internal
 */
export declare function pageBindingDeliverErrorString(
  name: string,
  seq: number,
  message: string,
  stack?: string,
): string;
/**
 * @internal
 */
export declare function pageBindingDeliverErrorValueString(
  name: string,
  seq: number,
  value: unknown,
): string;
/**
 * @internal
 */
export declare function makePredicateString(
  predicate: Function,
  predicateQueryHandler: Function,
): string;
/**
 * @internal
 */
export declare function waitWithTimeout<T>(
  promise: Promise<T>,
  taskName: string,
  timeout: number,
): Promise<T>;
/**
 * @internal
 */
export declare function getReadableStreamAsUint8Array(
  readable: ReadableStream,
  path?: string,
): Promise<Uint8Array | null>;
/**
 * @internal
 */
export declare function getReadableStreamFromProtocolStream(
  client: CDPSession,
  handle: string,
): Promise<ReadableStream>;
