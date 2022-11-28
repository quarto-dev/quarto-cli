/// <reference types="./IsolatedWorld.d.ts" />
/**
 * Copyright 2019 Google Inc. All rights reserved.
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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) ||
  function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) {
      throw new TypeError("Private accessor was defined without a setter");
    }
    if (
      typeof state === "function"
        ? receiver !== state || !f
        : !state.has(receiver)
    ) {
      throw new TypeError(
        "Cannot write private member to an object whose class did not declare it",
      );
    }
    return (kind === "a"
      ? f.call(receiver, value)
      : f
      ? f.value = value
      : state.set(receiver, value)),
      value;
  };
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) ||
  function (receiver, state, kind, f) {
    if (kind === "a" && !f) {
      throw new TypeError("Private accessor was defined without a getter");
    }
    if (
      typeof state === "function"
        ? receiver !== state || !f
        : !state.has(receiver)
    ) {
      throw new TypeError(
        "Cannot read private member from an object whose class did not declare it",
      );
    }
    return kind === "m"
      ? f
      : kind === "a"
      ? f.call(receiver)
      : f
      ? f.value
      : state.get(receiver);
  };
var _a,
  _IsolatedWorld_frameManager,
  _IsolatedWorld_client,
  _IsolatedWorld_frame,
  _IsolatedWorld_timeoutSettings,
  _IsolatedWorld_documentPromise,
  _IsolatedWorld_contextPromise,
  _IsolatedWorld_detached,
  _IsolatedWorld_ctxBindings,
  _IsolatedWorld_boundFunctions,
  _IsolatedWorld_waitTasks,
  _IsolatedWorld_bindingIdentifier,
  _IsolatedWorld_settingUpBinding,
  _IsolatedWorld_onBindingCalled,
  _WaitTask_instances,
  _WaitTask_isolatedWorld,
  _WaitTask_polling,
  _WaitTask_timeout,
  _WaitTask_predicateBody,
  _WaitTask_predicateAcceptsContextElement,
  _WaitTask_args,
  _WaitTask_binding,
  _WaitTask_runCount,
  _WaitTask_resolve,
  _WaitTask_reject,
  _WaitTask_timeoutTimer,
  _WaitTask_terminated,
  _WaitTask_root,
  _WaitTask_cleanup;
import { assert } from "../util/assert.js";
import { TimeoutError } from "./Errors.js";
import { LifecycleWatcher } from "./LifecycleWatcher.js";
import { getQueryHandlerAndSelector } from "./QueryHandler.js";
import {
  createJSHandle,
  debugError,
  isNumber,
  isString,
  makePredicateString,
  pageBindingInitString,
} from "./util.js";
import { createDeferredPromise } from "../util/DeferredPromise.js";
/**
 * A unique key for {@link IsolatedWorldChart} to denote the default world.
 * Execution contexts are automatically created in the default world.
 *
 * @internal
 */
export const MAIN_WORLD = Symbol("mainWorld");
/**
 * A unique key for {@link IsolatedWorldChart} to denote the puppeteer world.
 * This world contains all puppeteer-internal bindings/code.
 *
 * @internal
 */
export const PUPPETEER_WORLD = Symbol("puppeteerWorld");
/**
 * @internal
 */
export class IsolatedWorld {
  constructor(client, frameManager, frame, timeoutSettings) {
    _IsolatedWorld_frameManager.set(this, void 0);
    _IsolatedWorld_client.set(this, void 0);
    _IsolatedWorld_frame.set(this, void 0);
    _IsolatedWorld_timeoutSettings.set(this, void 0);
    _IsolatedWorld_documentPromise.set(this, null);
    _IsolatedWorld_contextPromise.set(this, createDeferredPromise());
    _IsolatedWorld_detached.set(this, false);
    // Set of bindings that have been registered in the current context.
    _IsolatedWorld_ctxBindings.set(this, new Set());
    // Contains mapping from functions that should be bound to Puppeteer functions.
    _IsolatedWorld_boundFunctions.set(this, new Map());
    _IsolatedWorld_waitTasks.set(this, new Set());
    // If multiple waitFor are set up asynchronously, we need to wait for the
    // first one to set up the binding in the page before running the others.
    _IsolatedWorld_settingUpBinding.set(this, null);
    _IsolatedWorld_onBindingCalled.set(this, async (event) => {
      let payload;
      if (!this.hasContext()) {
        return;
      }
      const context = await this.executionContext();
      try {
        payload = JSON.parse(event.payload);
      } catch {
        // The binding was either called by something in the page or it was
        // called before our wrapper was initialized.
        return;
      }
      const { type, name, seq, args } = payload;
      if (
        type !== "internal" ||
        !__classPrivateFieldGet(this, _IsolatedWorld_ctxBindings, "f").has(
          __classPrivateFieldGet(
            IsolatedWorld,
            _a,
            "f",
            _IsolatedWorld_bindingIdentifier,
          ).call(IsolatedWorld, name, context._contextId),
        )
      ) {
        return;
      }
      if (context._contextId !== event.executionContextId) {
        return;
      }
      try {
        const fn = this._boundFunctions.get(name);
        if (!fn) {
          throw new Error(`Bound function $name is not found`);
        }
        const result = await fn(...args);
        await context.evaluate(deliverResult, name, seq, result);
      } catch (error) {
        // The WaitTask may already have been resolved by timing out, or the
        // exection context may have been destroyed.
        // In both caes, the promises above are rejected with a protocol error.
        // We can safely ignores these, as the WaitTask is re-installed in
        // the next execution context if needed.
        if (error.message.includes("Protocol error")) {
          return;
        }
        debugError(error);
      }
      function deliverResult(name, seq, result) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Code is evaluated in a different context.
        globalThis[name].callbacks.get(seq).resolve(result);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Code is evaluated in a different context.
        globalThis[name].callbacks.delete(seq);
      }
    });
    // Keep own reference to client because it might differ from the FrameManager's
    // client for OOP iframes.
    __classPrivateFieldSet(this, _IsolatedWorld_client, client, "f");
    __classPrivateFieldSet(
      this,
      _IsolatedWorld_frameManager,
      frameManager,
      "f",
    );
    __classPrivateFieldSet(this, _IsolatedWorld_frame, frame, "f");
    __classPrivateFieldSet(
      this,
      _IsolatedWorld_timeoutSettings,
      timeoutSettings,
      "f",
    );
    __classPrivateFieldGet(this, _IsolatedWorld_client, "f").on(
      "Runtime.bindingCalled",
      __classPrivateFieldGet(this, _IsolatedWorld_onBindingCalled, "f"),
    );
  }
  get _waitTasks() {
    return __classPrivateFieldGet(this, _IsolatedWorld_waitTasks, "f");
  }
  get _boundFunctions() {
    return __classPrivateFieldGet(this, _IsolatedWorld_boundFunctions, "f");
  }
  frame() {
    return __classPrivateFieldGet(this, _IsolatedWorld_frame, "f");
  }
  clearContext() {
    __classPrivateFieldSet(this, _IsolatedWorld_documentPromise, null, "f");
    __classPrivateFieldSet(
      this,
      _IsolatedWorld_contextPromise,
      createDeferredPromise(),
      "f",
    );
  }
  setContext(context) {
    assert(
      __classPrivateFieldGet(this, _IsolatedWorld_contextPromise, "f"),
      `ExecutionContext ${context._contextId} has already been set.`,
    );
    __classPrivateFieldGet(this, _IsolatedWorld_ctxBindings, "f").clear();
    __classPrivateFieldGet(this, _IsolatedWorld_contextPromise, "f").resolve(
      context,
    );
    for (const waitTask of this._waitTasks) {
      waitTask.rerun();
    }
  }
  hasContext() {
    return __classPrivateFieldGet(this, _IsolatedWorld_contextPromise, "f")
      .resolved();
  }
  _detach() {
    __classPrivateFieldSet(this, _IsolatedWorld_detached, true, "f");
    __classPrivateFieldGet(this, _IsolatedWorld_client, "f").off(
      "Runtime.bindingCalled",
      __classPrivateFieldGet(this, _IsolatedWorld_onBindingCalled, "f"),
    );
    for (const waitTask of this._waitTasks) {
      waitTask.terminate(
        new Error("waitForFunction failed: frame got detached."),
      );
    }
  }
  executionContext() {
    if (__classPrivateFieldGet(this, _IsolatedWorld_detached, "f")) {
      throw new Error(
        `Execution context is not available in detached frame "${
          __classPrivateFieldGet(this, _IsolatedWorld_frame, "f").url()
        }" (are you trying to evaluate?)`,
      );
    }
    if (
      __classPrivateFieldGet(this, _IsolatedWorld_contextPromise, "f") === null
    ) {
      throw new Error(`Execution content promise is missing`);
    }
    return __classPrivateFieldGet(this, _IsolatedWorld_contextPromise, "f");
  }
  async evaluateHandle(pageFunction, ...args) {
    const context = await this.executionContext();
    return context.evaluateHandle(pageFunction, ...args);
  }
  async evaluate(pageFunction, ...args) {
    const context = await this.executionContext();
    return context.evaluate(pageFunction, ...args);
  }
  async $(selector) {
    const document = await this.document();
    return document.$(selector);
  }
  async $$(selector) {
    const document = await this.document();
    return document.$$(selector);
  }
  async document() {
    if (__classPrivateFieldGet(this, _IsolatedWorld_documentPromise, "f")) {
      return __classPrivateFieldGet(this, _IsolatedWorld_documentPromise, "f");
    }
    __classPrivateFieldSet(
      this,
      _IsolatedWorld_documentPromise,
      this.executionContext().then(async (context) => {
        return await context.evaluateHandle(() => {
          return document;
        });
      }),
      "f",
    );
    return __classPrivateFieldGet(this, _IsolatedWorld_documentPromise, "f");
  }
  async $x(expression) {
    const document = await this.document();
    return document.$x(expression);
  }
  async $eval(selector, pageFunction, ...args) {
    const document = await this.document();
    return document.$eval(selector, pageFunction, ...args);
  }
  async $$eval(selector, pageFunction, ...args) {
    const document = await this.document();
    return document.$$eval(selector, pageFunction, ...args);
  }
  async waitForSelector(selector, options) {
    const { updatedSelector, queryHandler } = getQueryHandlerAndSelector(
      selector,
    );
    assert(queryHandler.waitFor, "Query handler does not support waiting");
    return (await queryHandler.waitFor(this, updatedSelector, options));
  }
  async content() {
    return await this.evaluate(() => {
      let retVal = "";
      if (document.doctype) {
        retVal = new XMLSerializer().serializeToString(document.doctype);
      }
      if (document.documentElement) {
        retVal += document.documentElement.outerHTML;
      }
      return retVal;
    });
  }
  async setContent(html, options = {}) {
    const {
      waitUntil = ["load"],
      timeout = __classPrivateFieldGet(
        this,
        _IsolatedWorld_timeoutSettings,
        "f",
      ).navigationTimeout(),
    } = options;
    // We rely upon the fact that document.open() will reset frame lifecycle with "init"
    // lifecycle event. @see https://crrev.com/608658
    await this.evaluate((html) => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    const watcher = new LifecycleWatcher(
      __classPrivateFieldGet(this, _IsolatedWorld_frameManager, "f"),
      __classPrivateFieldGet(this, _IsolatedWorld_frame, "f"),
      waitUntil,
      timeout,
    );
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise(),
      watcher.lifecyclePromise(),
    ]);
    watcher.dispose();
    if (error) {
      throw error;
    }
  }
  /**
   * Adds a script tag into the current context.
   *
   * @remarks
   * You can pass a URL, filepath or string of contents. Note that when running Puppeteer
   * in a browser environment you cannot pass a filepath and should use either
   * `url` or `content`.
   */
  async addScriptTag(options) {
    const { url = null, path = null, content = null, id = "", type = "" } =
      options;
    if (url !== null) {
      try {
        const context = await this.executionContext();
        return await context.evaluateHandle(addScriptUrl, url, id, type);
      } catch (error) {
        throw new Error(`Loading script from ${url} failed`);
      }
    }
    if (path !== null) {
      let fs;
      try {
        fs = (await import("fs")).promises;
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(
            "Can only pass a filepath to addScriptTag in a Node-like environment.",
          );
        }
        throw error;
      }
      let contents = await fs.readFile(path, "utf8");
      contents += "//# sourceURL=" + path.replace(/\n/g, "");
      const context = await this.executionContext();
      return await context.evaluateHandle(addScriptContent, contents, id, type);
    }
    if (content !== null) {
      const context = await this.executionContext();
      return await context.evaluateHandle(addScriptContent, content, id, type);
    }
    throw new Error(
      "Provide an object with a `url`, `path` or `content` property",
    );
    async function addScriptUrl(url, id, type) {
      const script = document.createElement("script");
      script.src = url;
      if (id) {
        script.id = id;
      }
      if (type) {
        script.type = type;
      }
      const promise = new Promise((res, rej) => {
        script.onload = res;
        script.onerror = rej;
      });
      document.head.appendChild(script);
      await promise;
      return script;
    }
    function addScriptContent(content, id, type = "text/javascript") {
      const script = document.createElement("script");
      script.type = type;
      script.text = content;
      if (id) {
        script.id = id;
      }
      let error = null;
      script.onerror = (e) => {
        return (error = e);
      };
      document.head.appendChild(script);
      if (error) {
        throw error;
      }
      return script;
    }
  }
  /**
   * Adds a style tag into the current context.
   *
   * @remarks
   * You can pass a URL, filepath or string of contents. Note that when running Puppeteer
   * in a browser environment you cannot pass a filepath and should use either
   * `url` or `content`.
   */
  async addStyleTag(options) {
    const { url = null, path = null, content = null } = options;
    if (url !== null) {
      try {
        const context = await this.executionContext();
        return (await context.evaluateHandle(addStyleUrl, url));
      } catch (error) {
        throw new Error(`Loading style from ${url} failed`);
      }
    }
    if (path !== null) {
      let contents = await Deno.readTextFile(path);
      contents += "/*# sourceURL=" + path.replace(/\n/g, "") + "*/";
      const context = await this.executionContext();
      return (await context.evaluateHandle(addStyleContent, contents));
    }
    if (content !== null) {
      const context = await this.executionContext();
      return (await context.evaluateHandle(addStyleContent, content));
    }
    throw new Error(
      "Provide an object with a `url`, `path` or `content` property",
    );
    async function addStyleUrl(url) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      const promise = new Promise((res, rej) => {
        link.onload = res;
        link.onerror = rej;
      });
      document.head.appendChild(link);
      await promise;
      return link;
    }
    async function addStyleContent(content) {
      const style = document.createElement("style");
      style.appendChild(document.createTextNode(content));
      const promise = new Promise((res, rej) => {
        style.onload = res;
        style.onerror = rej;
      });
      document.head.appendChild(style);
      await promise;
      return style;
    }
  }
  async click(selector, options) {
    const handle = await this.$(selector);
    assert(handle, `No element found for selector: ${selector}`);
    await handle.click(options);
    await handle.dispose();
  }
  async focus(selector) {
    const handle = await this.$(selector);
    assert(handle, `No element found for selector: ${selector}`);
    await handle.focus();
    await handle.dispose();
  }
  async hover(selector) {
    const handle = await this.$(selector);
    assert(handle, `No element found for selector: ${selector}`);
    await handle.hover();
    await handle.dispose();
  }
  async select(selector, ...values) {
    const handle = await this.$(selector);
    assert(handle, `No element found for selector: ${selector}`);
    const result = await handle.select(...values);
    await handle.dispose();
    return result;
  }
  async tap(selector) {
    const handle = await this.$(selector);
    assert(handle, `No element found for selector: ${selector}`);
    await handle.tap();
    await handle.dispose();
  }
  async type(selector, text, options) {
    const handle = await this.$(selector);
    assert(handle, `No element found for selector: ${selector}`);
    await handle.type(text, options);
    await handle.dispose();
  }
  async _addBindingToContext(context, name) {
    // Previous operation added the binding so we are done.
    if (
      __classPrivateFieldGet(this, _IsolatedWorld_ctxBindings, "f").has(
        __classPrivateFieldGet(
          IsolatedWorld,
          _a,
          "f",
          _IsolatedWorld_bindingIdentifier,
        ).call(IsolatedWorld, name, context._contextId),
      )
    ) {
      return;
    }
    // Wait for other operation to finish
    if (__classPrivateFieldGet(this, _IsolatedWorld_settingUpBinding, "f")) {
      await __classPrivateFieldGet(this, _IsolatedWorld_settingUpBinding, "f");
      return this._addBindingToContext(context, name);
    }
    const bind = async (name) => {
      const expression = pageBindingInitString("internal", name);
      try {
        // TODO: In theory, it would be enough to call this just once
        await context._client.send("Runtime.addBinding", {
          name,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore The protocol definition is not up to date.
          executionContextName: context._contextName,
        });
        await context.evaluate(expression);
      } catch (error) {
        // We could have tried to evaluate in a context which was already
        // destroyed. This happens, for example, if the page is navigated while
        // we are trying to add the binding
        const ctxDestroyed = error.message.includes(
          "Execution context was destroyed",
        );
        const ctxNotFound = error.message.includes(
          "Cannot find context with specified id",
        );
        if (ctxDestroyed || ctxNotFound) {
          return;
        } else {
          debugError(error);
          return;
        }
      }
      __classPrivateFieldGet(this, _IsolatedWorld_ctxBindings, "f").add(
        __classPrivateFieldGet(
          IsolatedWorld,
          _a,
          "f",
          _IsolatedWorld_bindingIdentifier,
        ).call(IsolatedWorld, name, context._contextId),
      );
    };
    __classPrivateFieldSet(
      this,
      _IsolatedWorld_settingUpBinding,
      bind(name),
      "f",
    );
    await __classPrivateFieldGet(this, _IsolatedWorld_settingUpBinding, "f");
    __classPrivateFieldSet(this, _IsolatedWorld_settingUpBinding, null, "f");
  }
  async _waitForSelectorInPage(queryOne, selector, options, binding) {
    const {
      visible: waitForVisible = false,
      hidden: waitForHidden = false,
      timeout = __classPrivateFieldGet(
        this,
        _IsolatedWorld_timeoutSettings,
        "f",
      ).timeout(),
    } = options;
    const polling = waitForVisible || waitForHidden ? "raf" : "mutation";
    const title = `selector \`${selector}\`${
      waitForHidden ? " to be hidden" : ""
    }`;
    async function predicate(root, selector, waitForVisible, waitForHidden) {
      const node = (await predicateQueryHandler(root, selector));
      return checkWaitForOptions(node, waitForVisible, waitForHidden);
    }
    const waitTaskOptions = {
      isolatedWorld: this,
      predicateBody: makePredicateString(predicate, queryOne),
      predicateAcceptsContextElement: true,
      title,
      polling,
      timeout,
      args: [selector, waitForVisible, waitForHidden],
      binding,
      root: options.root,
    };
    const waitTask = new WaitTask(waitTaskOptions);
    const jsHandle = await waitTask.promise;
    const elementHandle = jsHandle.asElement();
    if (!elementHandle) {
      await jsHandle.dispose();
      return null;
    }
    return elementHandle;
  }
  waitForFunction(pageFunction, options = {}, ...args) {
    const {
      polling = "raf",
      timeout = __classPrivateFieldGet(
        this,
        _IsolatedWorld_timeoutSettings,
        "f",
      ).timeout(),
    } = options;
    const waitTaskOptions = {
      isolatedWorld: this,
      predicateBody: pageFunction,
      predicateAcceptsContextElement: false,
      title: "function",
      polling,
      timeout,
      args,
    };
    const waitTask = new WaitTask(waitTaskOptions);
    return waitTask.promise;
  }
  async title() {
    return this.evaluate(() => {
      return document.title;
    });
  }
  async adoptBackendNode(backendNodeId) {
    const executionContext = await this.executionContext();
    const { object } = await __classPrivateFieldGet(
      this,
      _IsolatedWorld_client,
      "f",
    ).send("DOM.resolveNode", {
      backendNodeId: backendNodeId,
      executionContextId: executionContext._contextId,
    });
    return createJSHandle(executionContext, object);
  }
  async adoptHandle(handle) {
    const executionContext = await this.executionContext();
    assert(
      handle.executionContext() !== executionContext,
      "Cannot adopt handle that already belongs to this execution context",
    );
    const nodeInfo = await __classPrivateFieldGet(
      this,
      _IsolatedWorld_client,
      "f",
    ).send("DOM.describeNode", {
      objectId: handle.remoteObject().objectId,
    });
    return (await this.adoptBackendNode(nodeInfo.node.backendNodeId));
  }
}
_a = IsolatedWorld,
  _IsolatedWorld_frameManager = new WeakMap(),
  _IsolatedWorld_client = new WeakMap(),
  _IsolatedWorld_frame = new WeakMap(),
  _IsolatedWorld_timeoutSettings = new WeakMap(),
  _IsolatedWorld_documentPromise = new WeakMap(),
  _IsolatedWorld_contextPromise = new WeakMap(),
  _IsolatedWorld_detached = new WeakMap(),
  _IsolatedWorld_ctxBindings = new WeakMap(),
  _IsolatedWorld_boundFunctions = new WeakMap(),
  _IsolatedWorld_waitTasks = new WeakMap(),
  _IsolatedWorld_settingUpBinding = new WeakMap(),
  _IsolatedWorld_onBindingCalled = new WeakMap();
_IsolatedWorld_bindingIdentifier = {
  value: (name, contextId) => {
    return `${name}_${contextId}`;
  },
};
const noop = () => {};
/**
 * @internal
 */
export class WaitTask {
  constructor(options) {
    _WaitTask_instances.add(this);
    _WaitTask_isolatedWorld.set(this, void 0);
    _WaitTask_polling.set(this, void 0);
    _WaitTask_timeout.set(this, void 0);
    _WaitTask_predicateBody.set(this, void 0);
    _WaitTask_predicateAcceptsContextElement.set(this, void 0);
    _WaitTask_args.set(this, void 0);
    _WaitTask_binding.set(this, void 0);
    _WaitTask_runCount.set(this, 0);
    _WaitTask_resolve.set(this, noop);
    _WaitTask_reject.set(this, noop);
    _WaitTask_timeoutTimer.set(this, void 0);
    _WaitTask_terminated.set(this, false);
    _WaitTask_root.set(this, null);
    if (isString(options.polling)) {
      assert(
        options.polling === "raf" || options.polling === "mutation",
        "Unknown polling option: " + options.polling,
      );
    } else if (isNumber(options.polling)) {
      assert(
        options.polling > 0,
        "Cannot poll with non-positive interval: " + options.polling,
      );
    } else {
      throw new Error("Unknown polling options: " + options.polling);
    }
    function getPredicateBody(predicateBody) {
      if (isString(predicateBody)) {
        return `return (${predicateBody});`;
      }
      return `return (${predicateBody})(...args);`;
    }
    __classPrivateFieldSet(
      this,
      _WaitTask_isolatedWorld,
      options.isolatedWorld,
      "f",
    );
    __classPrivateFieldSet(this, _WaitTask_polling, options.polling, "f");
    __classPrivateFieldSet(this, _WaitTask_timeout, options.timeout, "f");
    __classPrivateFieldSet(this, _WaitTask_root, options.root || null, "f");
    __classPrivateFieldSet(
      this,
      _WaitTask_predicateBody,
      getPredicateBody(options.predicateBody),
      "f",
    );
    __classPrivateFieldSet(
      this,
      _WaitTask_predicateAcceptsContextElement,
      options.predicateAcceptsContextElement,
      "f",
    );
    __classPrivateFieldSet(this, _WaitTask_args, options.args, "f");
    __classPrivateFieldSet(this, _WaitTask_binding, options.binding, "f");
    __classPrivateFieldSet(this, _WaitTask_runCount, 0, "f");
    __classPrivateFieldGet(this, _WaitTask_isolatedWorld, "f")._waitTasks.add(
      this,
    );
    if (__classPrivateFieldGet(this, _WaitTask_binding, "f")) {
      __classPrivateFieldGet(this, _WaitTask_isolatedWorld, "f")._boundFunctions
        .set(
          __classPrivateFieldGet(this, _WaitTask_binding, "f").name,
          __classPrivateFieldGet(this, _WaitTask_binding, "f").pptrFunction,
        );
    }
    this.promise = new Promise((resolve, reject) => {
      __classPrivateFieldSet(this, _WaitTask_resolve, resolve, "f");
      __classPrivateFieldSet(this, _WaitTask_reject, reject, "f");
    });
    // Since page navigation requires us to re-install the pageScript, we should track
    // timeout on our end.
    if (options.timeout) {
      const timeoutError = new TimeoutError(
        `waiting for ${options.title} failed: timeout ${options.timeout}ms exceeded`,
      );
      __classPrivateFieldSet(
        this,
        _WaitTask_timeoutTimer,
        setTimeout(() => {
          return this.terminate(timeoutError);
        }, options.timeout),
        "f",
      );
    }
    this.rerun();
  }
  terminate(error) {
    __classPrivateFieldSet(this, _WaitTask_terminated, true, "f");
    __classPrivateFieldGet(this, _WaitTask_reject, "f").call(this, error);
    __classPrivateFieldGet(this, _WaitTask_instances, "m", _WaitTask_cleanup)
      .call(this);
  }
  async rerun() {
    var _b;
    const runCount = __classPrivateFieldSet(
      this,
      _WaitTask_runCount,
      (_b = __classPrivateFieldGet(this, _WaitTask_runCount, "f"), ++_b),
      "f",
    );
    let success = null;
    let error = null;
    const context = await __classPrivateFieldGet(
      this,
      _WaitTask_isolatedWorld,
      "f",
    ).executionContext();
    if (
      __classPrivateFieldGet(this, _WaitTask_terminated, "f") ||
      runCount !== __classPrivateFieldGet(this, _WaitTask_runCount, "f")
    ) {
      return;
    }
    if (__classPrivateFieldGet(this, _WaitTask_binding, "f")) {
      await __classPrivateFieldGet(this, _WaitTask_isolatedWorld, "f")
        ._addBindingToContext(
          context,
          __classPrivateFieldGet(this, _WaitTask_binding, "f").name,
        );
    }
    if (
      __classPrivateFieldGet(this, _WaitTask_terminated, "f") ||
      runCount !== __classPrivateFieldGet(this, _WaitTask_runCount, "f")
    ) {
      return;
    }
    try {
      success = await context.evaluateHandle(
        waitForPredicatePageFunction,
        __classPrivateFieldGet(this, _WaitTask_root, "f") || null,
        __classPrivateFieldGet(this, _WaitTask_predicateBody, "f"),
        __classPrivateFieldGet(
          this,
          _WaitTask_predicateAcceptsContextElement,
          "f",
        ),
        __classPrivateFieldGet(this, _WaitTask_polling, "f"),
        __classPrivateFieldGet(this, _WaitTask_timeout, "f"),
        ...__classPrivateFieldGet(this, _WaitTask_args, "f"),
      );
    } catch (error_) {
      error = error_;
    }
    if (
      __classPrivateFieldGet(this, _WaitTask_terminated, "f") ||
      runCount !== __classPrivateFieldGet(this, _WaitTask_runCount, "f")
    ) {
      if (success) {
        await success.dispose();
      }
      return;
    }
    // Ignore timeouts in pageScript - we track timeouts ourselves.
    // If the frame's execution context has already changed, `frame.evaluate` will
    // throw an error - ignore this predicate run altogether.
    if (
      !error &&
      (await __classPrivateFieldGet(this, _WaitTask_isolatedWorld, "f")
        .evaluate((s) => {
          return !s;
        }, success)
        .catch(() => {
          return true;
        }))
    ) {
      if (!success) {
        throw new Error("Assertion: result handle is not available");
      }
      await success.dispose();
      return;
    }
    if (error) {
      if (error.message.includes("TypeError: binding is not a function")) {
        return this.rerun();
      }
      // When frame is detached the task should have been terminated by the IsolatedWorld.
      // This can fail if we were adding this task while the frame was detached,
      // so we terminate here instead.
      if (
        error.message.includes(
          "Execution context is not available in detached frame",
        )
      ) {
        this.terminate(
          new Error("waitForFunction failed: frame got detached."),
        );
        return;
      }
      // When the page is navigated, the promise is rejected.
      // We will try again in the new execution context.
      if (error.message.includes("Execution context was destroyed")) {
        return;
      }
      // We could have tried to evaluate in a context which was already
      // destroyed.
      if (error.message.includes("Cannot find context with specified id")) {
        return;
      }
      __classPrivateFieldGet(this, _WaitTask_reject, "f").call(this, error);
    } else {
      if (!success) {
        throw new Error("Assertion: result handle is not available");
      }
      __classPrivateFieldGet(this, _WaitTask_resolve, "f").call(this, success);
    }
    __classPrivateFieldGet(this, _WaitTask_instances, "m", _WaitTask_cleanup)
      .call(this);
  }
}
_WaitTask_isolatedWorld = new WeakMap(),
  _WaitTask_polling = new WeakMap(),
  _WaitTask_timeout = new WeakMap(),
  _WaitTask_predicateBody = new WeakMap(),
  _WaitTask_predicateAcceptsContextElement = new WeakMap(),
  _WaitTask_args = new WeakMap(),
  _WaitTask_binding = new WeakMap(),
  _WaitTask_runCount = new WeakMap(),
  _WaitTask_resolve = new WeakMap(),
  _WaitTask_reject = new WeakMap(),
  _WaitTask_timeoutTimer = new WeakMap(),
  _WaitTask_terminated = new WeakMap(),
  _WaitTask_root = new WeakMap(),
  _WaitTask_instances = new WeakSet(),
  _WaitTask_cleanup = function _WaitTask_cleanup() {
    __classPrivateFieldGet(this, _WaitTask_timeoutTimer, "f") !== undefined &&
      clearTimeout(__classPrivateFieldGet(this, _WaitTask_timeoutTimer, "f"));
    __classPrivateFieldGet(this, _WaitTask_isolatedWorld, "f")._waitTasks
      .delete(this);
  };
async function waitForPredicatePageFunction(
  root,
  predicateBody,
  predicateAcceptsContextElement,
  polling,
  timeout,
  ...args
) {
  root = root || document;
  const predicate = new Function("...args", predicateBody);
  let timedOut = false;
  if (timeout) {
    setTimeout(() => {
      return (timedOut = true);
    }, timeout);
  }
  switch (polling) {
    case "raf":
      return await pollRaf();
    case "mutation":
      return await pollMutation();
    default:
      return await pollInterval(polling);
  }
  async function pollMutation() {
    const success = predicateAcceptsContextElement
      ? await predicate(root, ...args)
      : await predicate(...args);
    if (success) {
      return Promise.resolve(success);
    }
    let fulfill = (_) => {};
    const result = new Promise((x) => {
      return (fulfill = x);
    });
    const observer = new MutationObserver(async () => {
      if (timedOut) {
        observer.disconnect();
        fulfill();
      }
      const success = predicateAcceptsContextElement
        ? await predicate(root, ...args)
        : await predicate(...args);
      if (success) {
        observer.disconnect();
        fulfill(success);
      }
    });
    if (!root) {
      throw new Error("Root element is not found.");
    }
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return result;
  }
  async function pollRaf() {
    let fulfill = (_) => {};
    const result = new Promise((x) => {
      return (fulfill = x);
    });
    await onRaf();
    return result;
    async function onRaf() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicateAcceptsContextElement
        ? await predicate(root, ...args)
        : await predicate(...args);
      if (success) {
        fulfill(success);
      } else {
        requestAnimationFrame(onRaf);
      }
    }
  }
  async function pollInterval(pollInterval) {
    let fulfill = (_) => {};
    const result = new Promise((x) => {
      return (fulfill = x);
    });
    await onTimeout();
    return result;
    async function onTimeout() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicateAcceptsContextElement
        ? await predicate(root, ...args)
        : await predicate(...args);
      if (success) {
        fulfill(success);
      } else {
        setTimeout(onTimeout, pollInterval);
      }
    }
  }
}
//# sourceMappingURL=IsolatedWorld.js.map
