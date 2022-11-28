/// <reference types="./util.d.ts" />
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
import { assert } from "../util/assert.js";
import { debug } from "./Debug.js";
import { ElementHandle } from "./ElementHandle.js";
import { isErrorLike } from "../util/ErrorLike.js";
import { TimeoutError } from "./Errors.js";
import { JSHandle } from "./JSHandle.js";
import { base64Decode, concatUint8Array } from "../../vendor/std.ts";
/**
 * @internal
 */
export const debugError = debug("puppeteer:error");
/**
 * @internal
 */
export function getExceptionMessage(exceptionDetails) {
  if (exceptionDetails.exception) {
    return (exceptionDetails.exception.description ||
      exceptionDetails.exception.value);
  }
  let message = exceptionDetails.text;
  if (exceptionDetails.stackTrace) {
    for (const callframe of exceptionDetails.stackTrace.callFrames) {
      const location = callframe.url +
        ":" +
        callframe.lineNumber +
        ":" +
        callframe.columnNumber;
      const functionName = callframe.functionName || "<anonymous>";
      message += `\n    at ${functionName} (${location})`;
    }
  }
  return message;
}
/**
 * @internal
 */
export function valueFromRemoteObject(remoteObject) {
  assert(!remoteObject.objectId, "Cannot extract value when objectId is given");
  if (remoteObject.unserializableValue) {
    if (remoteObject.type === "bigint" && typeof BigInt !== "undefined") {
      return BigInt(remoteObject.unserializableValue.replace("n", ""));
    }
    switch (remoteObject.unserializableValue) {
      case "-0":
        return -0;
      case "NaN":
        return NaN;
      case "Infinity":
        return Infinity;
      case "-Infinity":
        return -Infinity;
      default:
        throw new Error(
          "Unsupported unserializable value: " +
            remoteObject.unserializableValue,
        );
    }
  }
  return remoteObject.value;
}
/**
 * @internal
 */
export async function releaseObject(client, remoteObject) {
  if (!remoteObject.objectId) {
    return;
  }
  await client
    .send("Runtime.releaseObject", { objectId: remoteObject.objectId })
    .catch((error) => {
      // Exceptions might happen in case of a page been navigated or closed.
      // Swallow these since they are harmless and we don't leak anything in this case.
      debugError(error);
    });
}
/**
 * @internal
 */
export function addEventListener(emitter, eventName, handler) {
  emitter.on(eventName, handler);
  return { emitter, eventName, handler };
}
/**
 * @internal
 */
export function removeEventListeners(listeners) {
  for (const listener of listeners) {
    listener.emitter.removeListener(listener.eventName, listener.handler);
  }
  listeners.length = 0;
}
/**
 * @internal
 */
export const isString = (obj) => {
  return typeof obj === "string" || obj instanceof String;
};
/**
 * @internal
 */
export const isNumber = (obj) => {
  return typeof obj === "number" || obj instanceof Number;
};
/**
 * @internal
 */
export async function waitForEvent(
  emitter,
  eventName,
  predicate,
  timeout,
  abortPromise,
) {
  let eventTimeout;
  let resolveCallback;
  let rejectCallback;
  const promise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  const listener = addEventListener(emitter, eventName, async (event) => {
    if (!(await predicate(event))) {
      return;
    }
    resolveCallback(event);
  });
  if (timeout) {
    eventTimeout = setTimeout(() => {
      rejectCallback(
        new TimeoutError("Timeout exceeded while waiting for event"),
      );
    }, timeout);
  }
  function cleanup() {
    removeEventListeners([listener]);
    clearTimeout(eventTimeout);
  }
  const result = await Promise.race([promise, abortPromise]).then((r) => {
    cleanup();
    return r;
  }, (error) => {
    cleanup();
    throw error;
  });
  if (isErrorLike(result)) {
    throw result;
  }
  return result;
}
/**
 * @internal
 */
export function createJSHandle(context, remoteObject) {
  const frame = context.frame();
  if (remoteObject.subtype === "node" && frame) {
    const frameManager = frame._frameManager;
    return new ElementHandle(
      context,
      context._client,
      remoteObject,
      frame,
      frameManager.page(),
      frameManager,
    );
  }
  return new JSHandle(context, context._client, remoteObject);
}
/**
 * @internal
 */
export function evaluationString(fun, ...args) {
  if (isString(fun)) {
    assert(args.length === 0, "Cannot evaluate a string with arguments");
    return fun;
  }
  function serializeArgument(arg) {
    if (Object.is(arg, undefined)) {
      return "undefined";
    }
    return JSON.stringify(arg);
  }
  return `(${fun})(${args.map(serializeArgument).join(",")})`;
}
/**
 * @internal
 */
export function pageBindingInitString(type, name) {
  function addPageBinding(type, bindingName) {
    /* Cast window to any here as we're about to add properties to it
         * via win[bindingName] which TypeScript doesn't like.
         */
    const win = window;
    const binding = win[bindingName];
    win[bindingName] = (...args) => {
      const me = window[bindingName];
      let callbacks = me.callbacks;
      if (!callbacks) {
        callbacks = new Map();
        me.callbacks = callbacks;
      }
      const seq = (me.lastSeq || 0) + 1;
      me.lastSeq = seq;
      const promise = new Promise((resolve, reject) => {
        return callbacks.set(seq, { resolve, reject });
      });
      binding(JSON.stringify({ type, name: bindingName, seq, args }));
      return promise;
    };
  }
  return evaluationString(addPageBinding, type, name);
}
/**
 * @internal
 */
export function pageBindingDeliverResultString(name, seq, result) {
  function deliverResult(name, seq, result) {
    window[name].callbacks.get(seq).resolve(result);
    window[name].callbacks.delete(seq);
  }
  return evaluationString(deliverResult, name, seq, result);
}
/**
 * @internal
 */
export function pageBindingDeliverErrorString(name, seq, message, stack) {
  function deliverError(name, seq, message, stack) {
    const error = new Error(message);
    error.stack = stack;
    window[name].callbacks.get(seq).reject(error);
    window[name].callbacks.delete(seq);
  }
  return evaluationString(deliverError, name, seq, message, stack);
}
/**
 * @internal
 */
export function pageBindingDeliverErrorValueString(name, seq, value) {
  function deliverErrorValue(name, seq, value) {
    window[name].callbacks.get(seq).reject(value);
    window[name].callbacks.delete(seq);
  }
  return evaluationString(deliverErrorValue, name, seq, value);
}
/**
 * @internal
 */
export function makePredicateString(predicate, predicateQueryHandler) {
  function checkWaitForOptions(node, waitForVisible, waitForHidden) {
    if (!node) {
      return waitForHidden;
    }
    if (!waitForVisible && !waitForHidden) {
      return node;
    }
    const element = node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node;
    const style = window.getComputedStyle(element);
    const isVisible = style && style.visibility !== "hidden" &&
      hasVisibleBoundingBox();
    const success = waitForVisible === isVisible ||
      waitForHidden === !isVisible;
    return success ? node : null;
    function hasVisibleBoundingBox() {
      const rect = element.getBoundingClientRect();
      return !!(rect.top || rect.bottom || rect.width || rect.height);
    }
  }
  return `
    (() => {
      const predicateQueryHandler = ${predicateQueryHandler};
      const checkWaitForOptions = ${checkWaitForOptions};
      return (${predicate})(...args)
    })() `;
}
/**
 * @internal
 */
export async function waitWithTimeout(promise, taskName, timeout) {
  let reject;
  const timeoutError = new TimeoutError(
    `waiting for ${taskName} failed: timeout ${timeout}ms exceeded`,
  );
  const timeoutPromise = new Promise((_res, rej) => {
    return (reject = rej);
  });
  let timeoutTimer = null;
  if (timeout) {
    timeoutTimer = setTimeout(() => {
      return reject(timeoutError);
    }, timeout);
  }
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
  }
}
/**
 * @internal
 */
export async function getReadableStreamAsUint8Array(readableStream, path) {
  if (path) {
    const file = await Deno.open(path, { create: true, write: true });
    await readableStream.pipeTo(file.writable);
    return null;
  }

  const chunks = [];
  const reader = readableStream.getReader();
  for await (const chunk of reader) {
    chunks.push(chunk);
  }
  await reader.cancel();
  return concatUint8Array(chunks);
}
/**
 * @internal
 */
export async function getReadableStreamFromProtocolStream(client, handle) {
  let closed = false;
  return new ReadableStream({
    async pull(controller) {
      const response = await client.send("IO.read", { handle, size: 65536 });
      const data = response.base64Encoded
        ? base64Decode(response.data)
        : new TextEncoder().encode(response.data);
      controller.enqueue(data);
      if (response.eof && !closed) {
        closed = true;
        await client.send("IO.close", { handle });
        controller.close();
      }
    },
    async cancel() {
      if (!closed) {
        closed = true;
        await client.send("IO.close", { handle });
      }
    },
  });
}
//# sourceMappingURL=util.js.map
