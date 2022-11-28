/// <reference types="./Page.d.ts" />
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
var _Page_instances,
  _Page_closed,
  _Page_client,
  _Page_target,
  _Page_keyboard,
  _Page_mouse,
  _Page_timeoutSettings,
  _Page_touchscreen,
  _Page_accessibility,
  _Page_frameManager,
  _Page_emulationManager,
  _Page_tracing,
  _Page_pageBindings,
  _Page_coverage,
  _Page_javascriptEnabled,
  _Page_viewport,
  _Page_screenshotTaskQueue,
  _Page_workers,
  _Page_fileChooserPromises,
  _Page_disconnectPromise,
  _Page_userDragInterceptionEnabled,
  _Page_handlerMap,
  _Page_onDetachedFromTarget,
  _Page_onAttachedToTarget,
  _Page_initialize,
  _Page_onFileChooser,
  _Page_onTargetCrashed,
  _Page_onLogEntryAdded,
  _Page_emitMetrics,
  _Page_buildMetricsObject,
  _Page_handleException,
  _Page_onConsoleAPI,
  _Page_onBindingCalled,
  _Page_addConsoleMessage,
  _Page_onDialog,
  _Page_resetDefaultBackgroundColor,
  _Page_setTransparentBackgroundColor,
  _Page_sessionClosePromise,
  _Page_go,
  _Page_screenshotTask;
import { Accessibility } from "./Accessibility.js";
import { assert } from "../util/assert.js";
import { CDPSessionEmittedEvents } from "./Connection.js";
import { ConsoleMessage } from "./ConsoleMessage.js";
import { Coverage } from "./Coverage.js";
import { Dialog } from "./Dialog.js";
import { MAIN_WORLD } from "./IsolatedWorld.js";
import { EmulationManager } from "./EmulationManager.js";
import { EventEmitter } from "./EventEmitter.js";
import { FileChooser } from "./FileChooser.js";
import { FrameManager, FrameManagerEmittedEvents } from "./FrameManager.js";
import { Keyboard, Mouse, Touchscreen } from "./Input.js";
import { NetworkManagerEmittedEvents } from "./NetworkManager.js";
import { _paperFormats } from "./PDFOptions.js";
import { TimeoutSettings } from "./TimeoutSettings.js";
import { Tracing } from "./Tracing.js";
import {
  createJSHandle,
  debugError,
  evaluationString,
  getExceptionMessage,
  getReadableStreamAsUint8Array,
  getReadableStreamFromProtocolStream,
  isNumber,
  isString,
  pageBindingDeliverErrorString,
  pageBindingDeliverErrorValueString,
  pageBindingDeliverResultString,
  pageBindingInitString,
  releaseObject,
  valueFromRemoteObject,
  waitForEvent,
  waitWithTimeout,
} from "./util.js";
import { isErrorLike } from "../util/ErrorLike.js";
import { createDeferredPromiseWithTimer } from "../util/DeferredPromise.js";
import { WebWorker } from "./WebWorker.js";
import { base64Decode } from "../../vendor/std.ts";
/**
 * Page provides methods to interact with a single tab or
 * {@link https://developer.chrome.com/extensions/background_pages | extension background page}
 * in Chromium.
 *
 * :::note
 *
 * One Browser instance might have multiple Page instances.
 *
 * :::
 *
 * @example
 * This example creates a page, navigates it to a URL, and then saves a screenshot:
 *
 * ```ts
 * const puppeteer = require('puppeteer');
 *
 * (async () => {
 *   const browser = await puppeteer.launch();
 *   const page = await browser.newPage();
 *   await page.goto('https://example.com');
 *   await page.screenshot({path: 'screenshot.png'});
 *   await browser.close();
 * })();
 * ```
 *
 * The Page class extends from Puppeteer's {@link EventEmitter} class and will
 * emit various events which are documented in the {@link PageEmittedEvents} enum.
 *
 * @example
 * This example logs a message for a single page `load` event:
 *
 * ```ts
 * page.once('load', () => console.log('Page loaded!'));
 * ```
 *
 * To unsubscribe from events use the {@link Page.off} method:
 *
 * ```ts
 * function logRequest(interceptedRequest) {
 *   console.log('A request was made:', interceptedRequest.url());
 * }
 * page.on('request', logRequest);
 * // Sometime later...
 * page.off('request', logRequest);
 * ```
 *
 * @public
 */
export class Page extends EventEmitter {
  /**
   * @internal
   */
  constructor(client, target, ignoreHTTPSErrors, screenshotTaskQueue) {
    super();
    _Page_instances.add(this);
    _Page_closed.set(this, false);
    _Page_client.set(this, void 0);
    _Page_target.set(this, void 0);
    _Page_keyboard.set(this, void 0);
    _Page_mouse.set(this, void 0);
    _Page_timeoutSettings.set(this, new TimeoutSettings());
    _Page_touchscreen.set(this, void 0);
    _Page_accessibility.set(this, void 0);
    _Page_frameManager.set(this, void 0);
    _Page_emulationManager.set(this, void 0);
    _Page_tracing.set(this, void 0);
    _Page_pageBindings.set(this, new Map());
    _Page_coverage.set(this, void 0);
    _Page_javascriptEnabled.set(this, true);
    _Page_viewport.set(this, void 0);
    _Page_screenshotTaskQueue.set(this, void 0);
    _Page_workers.set(this, new Map());
    _Page_fileChooserPromises.set(this, new Set());
    _Page_disconnectPromise.set(this, void 0);
    _Page_userDragInterceptionEnabled.set(this, false);
    _Page_handlerMap.set(this, new WeakMap());
    _Page_onDetachedFromTarget.set(this, (target) => {
      var _a;
      const sessionId = (_a = target._session()) === null || _a === void 0
        ? void 0
        : _a.id();
      __classPrivateFieldGet(this, _Page_frameManager, "f")
        .onDetachedFromTarget(target);
      const worker = __classPrivateFieldGet(this, _Page_workers, "f").get(
        sessionId,
      );
      if (!worker) {
        return;
      }
      __classPrivateFieldGet(this, _Page_workers, "f").delete(sessionId);
      this.emit(
        "workerdestroyed", /* PageEmittedEvents.WorkerDestroyed */
        worker,
      );
    });
    _Page_onAttachedToTarget.set(this, async (createdTarget) => {
      __classPrivateFieldGet(this, _Page_frameManager, "f").onAttachedToTarget(
        createdTarget,
      );
      if (createdTarget._getTargetInfo().type === "worker") {
        const session = createdTarget._session();
        assert(session);
        const worker = new WebWorker(
          session,
          createdTarget.url(),
          __classPrivateFieldGet(
            this,
            _Page_instances,
            "m",
            _Page_addConsoleMessage,
          ).bind(this),
          __classPrivateFieldGet(
            this,
            _Page_instances,
            "m",
            _Page_handleException,
          ).bind(this),
        );
        __classPrivateFieldGet(this, _Page_workers, "f").set(
          session.id(),
          worker,
        );
        this.emit(
          "workercreated", /* PageEmittedEvents.WorkerCreated */
          worker,
        );
      }
      if (createdTarget._session()) {
        __classPrivateFieldGet(this, _Page_target, "f")
          ._targetManager()
          .addTargetInterceptor(
            createdTarget._session(),
            __classPrivateFieldGet(this, _Page_onAttachedToTarget, "f"),
          );
      }
    });
    __classPrivateFieldSet(this, _Page_client, client, "f");
    __classPrivateFieldSet(this, _Page_target, target, "f");
    __classPrivateFieldSet(this, _Page_keyboard, new Keyboard(client), "f");
    __classPrivateFieldSet(
      this,
      _Page_mouse,
      new Mouse(client, __classPrivateFieldGet(this, _Page_keyboard, "f")),
      "f",
    );
    __classPrivateFieldSet(
      this,
      _Page_touchscreen,
      new Touchscreen(
        client,
        __classPrivateFieldGet(this, _Page_keyboard, "f"),
      ),
      "f",
    );
    __classPrivateFieldSet(
      this,
      _Page_accessibility,
      new Accessibility(client),
      "f",
    );
    __classPrivateFieldSet(
      this,
      _Page_frameManager,
      new FrameManager(
        client,
        this,
        ignoreHTTPSErrors,
        __classPrivateFieldGet(this, _Page_timeoutSettings, "f"),
      ),
      "f",
    );
    __classPrivateFieldSet(
      this,
      _Page_emulationManager,
      new EmulationManager(client),
      "f",
    );
    __classPrivateFieldSet(this, _Page_tracing, new Tracing(client), "f");
    __classPrivateFieldSet(this, _Page_coverage, new Coverage(client), "f");
    __classPrivateFieldSet(
      this,
      _Page_screenshotTaskQueue,
      screenshotTaskQueue,
      "f",
    );
    __classPrivateFieldSet(this, _Page_viewport, null, "f");
    __classPrivateFieldGet(this, _Page_target, "f")
      ._targetManager()
      .addTargetInterceptor(
        __classPrivateFieldGet(this, _Page_client, "f"),
        __classPrivateFieldGet(this, _Page_onAttachedToTarget, "f"),
      );
    __classPrivateFieldGet(this, _Page_target, "f")
      ._targetManager()
      .on(
        "targetGone", /* TargetManagerEmittedEvents.TargetGone */
        __classPrivateFieldGet(this, _Page_onDetachedFromTarget, "f"),
      );
    __classPrivateFieldGet(this, _Page_frameManager, "f").on(
      FrameManagerEmittedEvents.FrameAttached,
      (event) => {
        return this.emit(
          "frameattached", /* PageEmittedEvents.FrameAttached */
          event,
        );
      },
    );
    __classPrivateFieldGet(this, _Page_frameManager, "f").on(
      FrameManagerEmittedEvents.FrameDetached,
      (event) => {
        return this.emit(
          "framedetached", /* PageEmittedEvents.FrameDetached */
          event,
        );
      },
    );
    __classPrivateFieldGet(this, _Page_frameManager, "f").on(
      FrameManagerEmittedEvents.FrameNavigated,
      (event) => {
        return this.emit(
          "framenavigated", /* PageEmittedEvents.FrameNavigated */
          event,
        );
      },
    );
    const networkManager =
      __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager;
    networkManager.on(NetworkManagerEmittedEvents.Request, (event) => {
      return this.emit("request", /* PageEmittedEvents.Request */ event);
    });
    networkManager.on(
      NetworkManagerEmittedEvents.RequestServedFromCache,
      (event) => {
        return this.emit(
          "requestservedfromcache", /* PageEmittedEvents.RequestServedFromCache */
          event,
        );
      },
    );
    networkManager.on(NetworkManagerEmittedEvents.Response, (event) => {
      return this.emit("response", /* PageEmittedEvents.Response */ event);
    });
    networkManager.on(NetworkManagerEmittedEvents.RequestFailed, (event) => {
      return this.emit(
        "requestfailed", /* PageEmittedEvents.RequestFailed */
        event,
      );
    });
    networkManager.on(NetworkManagerEmittedEvents.RequestFinished, (event) => {
      return this.emit(
        "requestfinished", /* PageEmittedEvents.RequestFinished */
        event,
      );
    });
    client.on("Page.domContentEventFired", () => {
      return this.emit(
        "domcontentloaded", /* PageEmittedEvents.DOMContentLoaded */
      );
    });
    client.on("Page.loadEventFired", () => {
      return this.emit("load" /* PageEmittedEvents.Load */);
    });
    client.on("Runtime.consoleAPICalled", (event) => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_onConsoleAPI,
      ).call(this, event);
    });
    client.on("Runtime.bindingCalled", (event) => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_onBindingCalled,
      ).call(this, event);
    });
    client.on("Page.javascriptDialogOpening", (event) => {
      return __classPrivateFieldGet(this, _Page_instances, "m", _Page_onDialog)
        .call(this, event);
    });
    client.on("Runtime.exceptionThrown", (exception) => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_handleException,
      ).call(this, exception.exceptionDetails);
    });
    client.on("Inspector.targetCrashed", () => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_onTargetCrashed,
      ).call(this);
    });
    client.on("Performance.metrics", (event) => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_emitMetrics,
      ).call(this, event);
    });
    client.on("Log.entryAdded", (event) => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_onLogEntryAdded,
      ).call(this, event);
    });
    client.on("Page.fileChooserOpened", (event) => {
      return __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_onFileChooser,
      ).call(this, event);
    });
    __classPrivateFieldGet(this, _Page_target, "f")._isClosedPromise.then(
      () => {
        __classPrivateFieldGet(this, _Page_target, "f")
          ._targetManager()
          .removeTargetInterceptor(
            __classPrivateFieldGet(this, _Page_client, "f"),
            __classPrivateFieldGet(this, _Page_onAttachedToTarget, "f"),
          );
        __classPrivateFieldGet(this, _Page_target, "f")
          ._targetManager()
          .off(
            "targetGone", /* TargetManagerEmittedEvents.TargetGone */
            __classPrivateFieldGet(this, _Page_onDetachedFromTarget, "f"),
          );
        this.emit("close" /* PageEmittedEvents.Close */);
        __classPrivateFieldSet(this, _Page_closed, true, "f");
      },
    );
  }
  /**
   * @internal
   */
  static async _create(
    client,
    target,
    ignoreHTTPSErrors,
    defaultViewport,
    screenshotTaskQueue,
  ) {
    const page = new Page(
      client,
      target,
      ignoreHTTPSErrors,
      screenshotTaskQueue,
    );
    await __classPrivateFieldGet(page, _Page_instances, "m", _Page_initialize)
      .call(page);
    if (defaultViewport) {
      await page.setViewport(defaultViewport);
    }
    return page;
  }
  /**
   * @returns `true` if drag events are being intercepted, `false` otherwise.
   */
  isDragInterceptionEnabled() {
    return __classPrivateFieldGet(this, _Page_userDragInterceptionEnabled, "f");
  }
  /**
   * @returns `true` if the page has JavaScript enabled, `false` otherwise.
   */
  isJavaScriptEnabled() {
    return __classPrivateFieldGet(this, _Page_javascriptEnabled, "f");
  }
  /**
   * Listen to page events.
   *
   * :::note
   *
   * This method exists to define event typings and handle proper wireup of
   * cooperative request interception. Actual event listening and dispatching is
   * delegated to {@link EventEmitter}.
   *
   * :::
   */
  on(eventName, handler) {
    if (eventName === "request") {
      const wrap =
        __classPrivateFieldGet(this, _Page_handlerMap, "f").get(handler) ||
        ((event) => {
          event.enqueueInterceptAction(() => {
            return handler(event);
          });
        });
      __classPrivateFieldGet(this, _Page_handlerMap, "f").set(handler, wrap);
      return super.on(eventName, wrap);
    }
    return super.on(eventName, handler);
  }
  once(eventName, handler) {
    // Note: this method only exists to define the types; we delegate the impl
    // to EventEmitter.
    return super.once(eventName, handler);
  }
  off(eventName, handler) {
    if (eventName === "request") {
      handler =
        __classPrivateFieldGet(this, _Page_handlerMap, "f").get(handler) ||
        handler;
    }
    return super.off(eventName, handler);
  }
  /**
   * This method is typically coupled with an action that triggers file
   * choosing.
   *
   * :::caution
   *
   * This must be called before the file chooser is launched. It will not return
   * a currently active file chooser.
   *
   * :::
   *
   * @remarks
   * In non-headless Chromium, this method results in the native file picker
   * dialog `not showing up` for the user.
   *
   * @example
   * The following example clicks a button that issues a file chooser
   * and then responds with `/tmp/myfile.pdf` as if a user has selected this file.
   *
   * ```ts
   * const [fileChooser] = await Promise.all([
   *   page.waitForFileChooser(),
   *   page.click('#upload-file-button'),
   *   // some button that triggers file selection
   * ]);
   * await fileChooser.accept(['/tmp/myfile.pdf']);
   * ```
   */
  async waitForFileChooser(options = {}) {
    if (!__classPrivateFieldGet(this, _Page_fileChooserPromises, "f").size) {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Page.setInterceptFileChooserDialog",
        {
          enabled: true,
        },
      );
    }
    const {
      timeout = __classPrivateFieldGet(this, _Page_timeoutSettings, "f")
        .timeout(),
    } = options;
    const promise = createDeferredPromiseWithTimer(
      `Waiting for \`FileChooser\` failed: ${timeout}ms exceeded`,
    );
    __classPrivateFieldGet(this, _Page_fileChooserPromises, "f").add(promise);
    return promise.catch((error) => {
      __classPrivateFieldGet(this, _Page_fileChooserPromises, "f").delete(
        promise,
      );
      throw error;
    });
  }
  /**
   * Sets the page's geolocation.
   *
   * @remarks
   * Consider using {@link BrowserContext.overridePermissions} to grant
   * permissions for the page to read its geolocation.
   *
   * @example
   *
   * ```ts
   * await page.setGeolocation({latitude: 59.95, longitude: 30.31667});
   * ```
   */
  async setGeolocation(options) {
    const { longitude, latitude, accuracy = 0 } = options;
    if (longitude < -180 || longitude > 180) {
      throw new Error(
        `Invalid longitude "${longitude}": precondition -180 <= LONGITUDE <= 180 failed.`,
      );
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error(
        `Invalid latitude "${latitude}": precondition -90 <= LATITUDE <= 90 failed.`,
      );
    }
    if (accuracy < 0) {
      throw new Error(
        `Invalid accuracy "${accuracy}": precondition 0 <= ACCURACY failed.`,
      );
    }
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Emulation.setGeolocationOverride",
      {
        longitude,
        latitude,
        accuracy,
      },
    );
  }
  /**
   * @returns A target this page was created from.
   */
  target() {
    return __classPrivateFieldGet(this, _Page_target, "f");
  }
  /**
   * @internal
   */
  _client() {
    return __classPrivateFieldGet(this, _Page_client, "f");
  }
  /**
   * Get the browser the page belongs to.
   */
  browser() {
    return __classPrivateFieldGet(this, _Page_target, "f").browser();
  }
  /**
   * Get the browser context that the page belongs to.
   */
  browserContext() {
    return __classPrivateFieldGet(this, _Page_target, "f").browserContext();
  }
  /**
   * @returns The page's main frame.
   *
   * @remarks
   * Page is guaranteed to have a main frame which persists during navigations.
   */
  mainFrame() {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").mainFrame();
  }
  get keyboard() {
    return __classPrivateFieldGet(this, _Page_keyboard, "f");
  }
  get touchscreen() {
    return __classPrivateFieldGet(this, _Page_touchscreen, "f");
  }
  get coverage() {
    return __classPrivateFieldGet(this, _Page_coverage, "f");
  }
  get tracing() {
    return __classPrivateFieldGet(this, _Page_tracing, "f");
  }
  get accessibility() {
    return __classPrivateFieldGet(this, _Page_accessibility, "f");
  }
  /**
   * @returns An array of all frames attached to the page.
   */
  frames() {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").frames();
  }
  /**
   * @returns all of the dedicated {@link
   * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API |
   * WebWorkers} associated with the page.
   *
   * @remarks
   * This does not contain ServiceWorkers
   */
  workers() {
    return Array.from(
      __classPrivateFieldGet(this, _Page_workers, "f").values(),
    );
  }
  /**
   * Activating request interception enables {@link HTTPRequest.abort},
   * {@link HTTPRequest.continue} and {@link HTTPRequest.respond} methods. This
   * provides the capability to modify network requests that are made by a page.
   *
   * Once request interception is enabled, every request will stall unless it's
   * continued, responded or aborted; or completed using the browser cache.
   *
   * Enabling request interception disables page caching.
   *
   * See the
   * {@link https://pptr.dev/next/guides/request-interception|Request interception guide}
   * for more details.
   *
   * @example
   * An example of a naïve request interceptor that aborts all image requests:
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   await page.setRequestInterception(true);
   *   page.on('request', interceptedRequest => {
   *     if (
   *       interceptedRequest.url().endsWith('.png') ||
   *       interceptedRequest.url().endsWith('.jpg')
   *     )
   *       interceptedRequest.abort();
   *     else interceptedRequest.continue();
   *   });
   *   await page.goto('https://example.com');
   *   await browser.close();
   * })();
   * ```
   *
   * @param value - Whether to enable request interception.
   */
  async setRequestInterception(value) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .setRequestInterception(value);
  }
  /**
   * @param enabled - Whether to enable drag interception.
   *
   * @remarks
   * Activating drag interception enables the `Input.drag`,
   * methods This provides the capability to capture drag events emitted
   * on the page, which can then be used to simulate drag-and-drop.
   */
  async setDragInterception(enabled) {
    __classPrivateFieldSet(
      this,
      _Page_userDragInterceptionEnabled,
      enabled,
      "f",
    );
    return __classPrivateFieldGet(this, _Page_client, "f").send(
      "Input.setInterceptDrags",
      { enabled },
    );
  }
  /**
   * @param enabled - When `true`, enables offline mode for the page.
   * @remarks
   * NOTE: while this method sets the network connection to offline, it does
   * not change the parameters used in [page.emulateNetworkConditions(networkConditions)]
   * (#pageemulatenetworkconditionsnetworkconditions)
   */
  setOfflineMode(enabled) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .setOfflineMode(enabled);
  }
  /**
   * @param networkConditions - Passing `null` disables network condition emulation.
   * @example
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * const slow3G = puppeteer.networkConditions['Slow 3G'];
   *
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   await page.emulateNetworkConditions(slow3G);
   *   await page.goto('https://www.google.com');
   *   // other actions...
   *   await browser.close();
   * })();
   * ```
   *
   * @remarks
   * NOTE: This does not affect WebSockets and WebRTC PeerConnections (see
   * https://crbug.com/563644). To set the page offline, you can use
   * [page.setOfflineMode(enabled)](#pagesetofflinemodeenabled).
   */
  emulateNetworkConditions(networkConditions) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .emulateNetworkConditions(networkConditions);
  }
  /**
   * This setting will change the default maximum navigation time for the
   * following methods and related shortcuts:
   *
   * - {@link Page.goBack | page.goBack(options)}
   *
   * - {@link Page.goForward | page.goForward(options)}
   *
   * - {@link Page.goto | page.goto(url,options)}
   *
   * - {@link Page.reload | page.reload(options)}
   *
   * - {@link Page.setContent | page.setContent(html,options)}
   *
   * - {@link Page.waitForNavigation | page.waitForNavigation(options)}
   *   @param timeout - Maximum navigation time in milliseconds.
   */
  setDefaultNavigationTimeout(timeout) {
    __classPrivateFieldGet(this, _Page_timeoutSettings, "f")
      .setDefaultNavigationTimeout(timeout);
  }
  /**
   * @param timeout - Maximum time in milliseconds.
   */
  setDefaultTimeout(timeout) {
    __classPrivateFieldGet(this, _Page_timeoutSettings, "f").setDefaultTimeout(
      timeout,
    );
  }
  /**
   * Runs `document.querySelector` within the page. If no element matches the
   * selector, the return value resolves to `null`.
   *
   * @param selector - A `selector` to query page for
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector}
   * to query page for.
   */
  async $(selector) {
    return this.mainFrame().$(selector);
  }
  /**
   * The method runs `document.querySelectorAll` within the page. If no elements
   * match the selector, the return value resolves to `[]`.
   * @remarks
   * Shortcut for {@link Frame.$$ | Page.mainFrame().$$(selector) }.
   * @param selector - A `selector` to query page for
   */
  async $$(selector) {
    return this.mainFrame().$$(selector);
  }
  /**
   * @remarks
   *
   * The only difference between {@link Page.evaluate | page.evaluate} and
   * `page.evaluateHandle` is that `evaluateHandle` will return the value
   * wrapped in an in-page object.
   *
   * If the function passed to `page.evaluteHandle` returns a Promise, the
   * function will wait for the promise to resolve and return its value.
   *
   * You can pass a string instead of a function (although functions are
   * recommended as they are easier to debug and use with TypeScript):
   *
   * @example
   *
   * ```ts
   * const aHandle = await page.evaluateHandle('document');
   * ```
   *
   * @example
   * {@link JSHandle} instances can be passed as arguments to the `pageFunction`:
   *
   * ```ts
   * const aHandle = await page.evaluateHandle(() => document.body);
   * const resultHandle = await page.evaluateHandle(
   *   body => body.innerHTML,
   *   aHandle
   * );
   * console.log(await resultHandle.jsonValue());
   * await resultHandle.dispose();
   * ```
   *
   * Most of the time this function returns a {@link JSHandle},
   * but if `pageFunction` returns a reference to an element,
   * you instead get an {@link ElementHandle} back:
   *
   * @example
   *
   * ```ts
   * const button = await page.evaluateHandle(() =>
   *   document.querySelector('button')
   * );
   * // can call `click` because `button` is an `ElementHandle`
   * await button.click();
   * ```
   *
   * The TypeScript definitions assume that `evaluateHandle` returns
   * a `JSHandle`, but if you know it's going to return an
   * `ElementHandle`, pass it as the generic argument:
   *
   * ```ts
   * const button = await page.evaluateHandle<ElementHandle>(...);
   * ```
   *
   * @param pageFunction - a function that is run within the page
   * @param args - arguments to be passed to the pageFunction
   */
  async evaluateHandle(pageFunction, ...args) {
    const context = await this.mainFrame().executionContext();
    return context.evaluateHandle(pageFunction, ...args);
  }
  /**
   * This method iterates the JavaScript heap and finds all objects with the
   * given prototype.
   *
   * @remarks
   * Shortcut for
   * {@link ExecutionContext.queryObjects |
   * page.mainFrame().executionContext().queryObjects(prototypeHandle)}.
   *
   * @example
   *
   * ```ts
   * // Create a Map object
   * await page.evaluate(() => (window.map = new Map()));
   * // Get a handle to the Map object prototype
   * const mapPrototype = await page.evaluateHandle(() => Map.prototype);
   * // Query all map instances into an array
   * const mapInstances = await page.queryObjects(mapPrototype);
   * // Count amount of map objects in heap
   * const count = await page.evaluate(maps => maps.length, mapInstances);
   * await mapInstances.dispose();
   * await mapPrototype.dispose();
   * ```
   *
   * @param prototypeHandle - a handle to the object prototype.
   * @returns Promise which resolves to a handle to an array of objects with
   * this prototype.
   */
  async queryObjects(prototypeHandle) {
    const context = await this.mainFrame().executionContext();
    return context.queryObjects(prototypeHandle);
  }
  /**
   * This method runs `document.querySelector` within the page and passes the
   * result as the first argument to the `pageFunction`.
   *
   * @remarks
   *
   * If no element is found matching `selector`, the method will throw an error.
   *
   * If `pageFunction` returns a promise `$eval` will wait for the promise to
   * resolve and then return its value.
   *
   * @example
   *
   * ```ts
   * const searchValue = await page.$eval('#search', el => el.value);
   * const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
   * const html = await page.$eval('.main-container', el => el.outerHTML);
   * ```
   *
   * If you are using TypeScript, you may have to provide an explicit type to the
   * first argument of the `pageFunction`.
   * By default it is typed as `Element`, but you may need to provide a more
   * specific sub-type:
   *
   * @example
   *
   * ```ts
   * // if you don't provide HTMLInputElement here, TS will error
   * // as `value` is not on `Element`
   * const searchValue = await page.$eval(
   *   '#search',
   *   (el: HTMLInputElement) => el.value
   * );
   * ```
   *
   * The compiler should be able to infer the return type
   * from the `pageFunction` you provide. If it is unable to, you can use the generic
   * type to tell the compiler what return type you expect from `$eval`:
   *
   * @example
   *
   * ```ts
   * // The compiler can infer the return type in this case, but if it can't
   * // or if you want to be more explicit, provide it as the generic type.
   * const searchValue = await page.$eval<string>(
   *   '#search',
   *   (el: HTMLInputElement) => el.value
   * );
   * ```
   *
   * @param selector - the
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector}
   * to query for
   * @param pageFunction - the function to be evaluated in the page context.
   * Will be passed the result of `document.querySelector(selector)` as its
   * first argument.
   * @param args - any additional arguments to pass through to `pageFunction`.
   *
   * @returns The result of calling `pageFunction`. If it returns an element it
   * is wrapped in an {@link ElementHandle}, else the raw value itself is
   * returned.
   */
  async $eval(selector, pageFunction, ...args) {
    return this.mainFrame().$eval(selector, pageFunction, ...args);
  }
  /**
   * This method runs `Array.from(document.querySelectorAll(selector))` within
   * the page and passes the result as the first argument to the `pageFunction`.
   *
   * @remarks
   * If `pageFunction` returns a promise `$$eval` will wait for the promise to
   * resolve and then return its value.
   *
   * @example
   *
   * ```ts
   * // get the amount of divs on the page
   * const divCount = await page.$$eval('div', divs => divs.length);
   *
   * // get the text content of all the `.options` elements:
   * const options = await page.$$eval('div > span.options', options => {
   *   return options.map(option => option.textContent);
   * });
   * ```
   *
   * If you are using TypeScript, you may have to provide an explicit type to the
   * first argument of the `pageFunction`.
   * By default it is typed as `Element[]`, but you may need to provide a more
   * specific sub-type:
   *
   * @example
   *
   * ```ts
   * // if you don't provide HTMLInputElement here, TS will error
   * // as `value` is not on `Element`
   * await page.$$eval('input', (elements: HTMLInputElement[]) => {
   *   return elements.map(e => e.value);
   * });
   * ```
   *
   * The compiler should be able to infer the return type
   * from the `pageFunction` you provide. If it is unable to, you can use the generic
   * type to tell the compiler what return type you expect from `$$eval`:
   *
   * @example
   *
   * ```ts
   * // The compiler can infer the return type in this case, but if it can't
   * // or if you want to be more explicit, provide it as the generic type.
   * const allInputValues = await page.$$eval<string[]>(
   *   'input',
   *   (elements: HTMLInputElement[]) => elements.map(e => e.textContent)
   * );
   * ```
   *
   * @param selector - the
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector}
   * to query for
   * @param pageFunction - the function to be evaluated in the page context.
   * Will be passed the result of
   * `Array.from(document.querySelectorAll(selector))` as its first argument.
   * @param args - any additional arguments to pass through to `pageFunction`.
   *
   * @returns The result of calling `pageFunction`. If it returns an element it
   * is wrapped in an {@link ElementHandle}, else the raw value itself is
   * returned.
   */
  async $$eval(selector, pageFunction, ...args) {
    return this.mainFrame().$$eval(selector, pageFunction, ...args);
  }
  /**
   * The method evaluates the XPath expression relative to the page document as
   * its context node. If there are no such elements, the method resolves to an
   * empty array.
   *
   * @remarks
   * Shortcut for {@link Frame.$x | Page.mainFrame().$x(expression) }.
   *
   * @param expression - Expression to evaluate
   */
  async $x(expression) {
    return this.mainFrame().$x(expression);
  }
  /**
   * If no URLs are specified, this method returns cookies for the current page
   * URL. If URLs are specified, only cookies for those URLs are returned.
   */
  async cookies(...urls) {
    const originalCookies =
      (await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Network.getCookies",
        {
          urls: urls.length ? urls : [this.url()],
        },
      )).cookies;
    const unsupportedCookieAttributes = ["priority"];
    const filterUnsupportedAttributes = (cookie) => {
      for (const attr of unsupportedCookieAttributes) {
        delete cookie[attr];
      }
      return cookie;
    };
    return originalCookies.map(filterUnsupportedAttributes);
  }
  async deleteCookie(...cookies) {
    const pageURL = this.url();
    for (const cookie of cookies) {
      const item = Object.assign({}, cookie);
      if (!cookie.url && pageURL.startsWith("http")) {
        item.url = pageURL;
      }
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Network.deleteCookies",
        item,
      );
    }
  }
  /**
   * @example
   *
   * ```ts
   * await page.setCookie(cookieObject1, cookieObject2);
   * ```
   */
  async setCookie(...cookies) {
    const pageURL = this.url();
    const startsWithHTTP = pageURL.startsWith("http");
    const items = cookies.map((cookie) => {
      const item = Object.assign({}, cookie);
      if (!item.url && startsWithHTTP) {
        item.url = pageURL;
      }
      assert(
        item.url !== "about:blank",
        `Blank page can not have cookie "${item.name}"`,
      );
      assert(
        !String.prototype.startsWith.call(item.url || "", "data:"),
        `Data URL page can not have cookie "${item.name}"`,
      );
      return item;
    });
    await this.deleteCookie(...items);
    if (items.length) {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Network.setCookies",
        { cookies: items },
      );
    }
  }
  /**
   * Adds a `<script>` tag into the page with the desired URL or content.
   *
   * @remarks
   * Shortcut for
   * {@link Frame.addScriptTag | page.mainFrame().addScriptTag(options)}.
   *
   * @returns Promise which resolves to the added tag when the script's onload
   * fires or when the script content was injected into frame.
   */
  async addScriptTag(options) {
    return this.mainFrame().addScriptTag(options);
  }
  /**
   * Adds a `<link rel="stylesheet">` tag into the page with the desired URL or a
   * `<style type="text/css">` tag with the content.
   * @returns Promise which resolves to the added tag when the stylesheet's
   * onload fires or when the CSS content was injected into frame.
   */
  async addStyleTag(options) {
    return this.mainFrame().addStyleTag(options);
  }
  /**
   * The method adds a function called `name` on the page's `window` object.
   * When called, the function executes `puppeteerFunction` in node.js and
   * returns a `Promise` which resolves to the return value of
   * `puppeteerFunction`.
   *
   * If the puppeteerFunction returns a `Promise`, it will be awaited.
   *
   * :::note
   *
   * Functions installed via `page.exposeFunction` survive navigations.
   *
   * :::note
   *
   * @example
   * An example of adding an `md5` function into the page:
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * const crypto = require('crypto');
   *
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   page.on('console', msg => console.log(msg.text()));
   *   await page.exposeFunction('md5', text =>
   *     crypto.createHash('md5').update(text).digest('hex')
   *   );
   *   await page.evaluate(async () => {
   *     // use window.md5 to compute hashes
   *     const myString = 'PUPPETEER';
   *     const myHash = await window.md5(myString);
   *     console.log(`md5 of ${myString} is ${myHash}`);
   *   });
   *   await browser.close();
   * })();
   * ```
   *
   * @example
   * An example of adding a `window.readfile` function into the page:
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * const fs = require('fs');
   *
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   page.on('console', msg => console.log(msg.text()));
   *   await page.exposeFunction('readfile', async filePath => {
   *     return new Promise((resolve, reject) => {
   *       fs.readFile(filePath, 'utf8', (err, text) => {
   *         if (err) reject(err);
   *         else resolve(text);
   *       });
   *     });
   *   });
   *   await page.evaluate(async () => {
   *     // use window.readfile to read contents of a file
   *     const content = await window.readfile('/etc/hosts');
   *     console.log(content);
   *   });
   *   await browser.close();
   * })();
   * ```
   *
   * @param name - Name of the function on the window object
   * @param pptrFunction - Callback function which will be called in Puppeteer's
   * context.
   */
  async exposeFunction(name, pptrFunction) {
    if (__classPrivateFieldGet(this, _Page_pageBindings, "f").has(name)) {
      throw new Error(
        `Failed to add page binding with name ${name}: window['${name}'] already exists!`,
      );
    }
    let exposedFunction;
    switch (typeof pptrFunction) {
      case "function":
        exposedFunction = pptrFunction;
        break;
      default:
        exposedFunction = pptrFunction.default;
        break;
    }
    __classPrivateFieldGet(this, _Page_pageBindings, "f").set(
      name,
      exposedFunction,
    );
    const expression = pageBindingInitString("exposedFun", name);
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Runtime.addBinding",
      { name: name },
    );
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: expression,
      },
    );
    await Promise.all(
      this.frames().map((frame) => {
        return frame.evaluate(expression).catch(debugError);
      }),
    );
  }
  /**
   * Provide credentials for `HTTP authentication`.
   *
   * @remarks
   * To disable authentication, pass `null`.
   */
  async authenticate(credentials) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .authenticate(credentials);
  }
  /**
   * The extra HTTP headers will be sent with every request the page initiates.
   *
   * :::tip
   *
   * All HTTP header names are lowercased. (HTTP headers are
   * case-insensitive, so this shouldn’t impact your server code.)
   *
   * :::
   *
   * :::note
   *
   * page.setExtraHTTPHeaders does not guarantee the order of headers in
   * the outgoing requests.
   *
   * :::
   *
   * @param headers - An object containing additional HTTP headers to be sent
   * with every request. All header values must be strings.
   */
  async setExtraHTTPHeaders(headers) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .setExtraHTTPHeaders(headers);
  }
  /**
   * @param userAgent - Specific user agent to use in this page
   * @param userAgentData - Specific user agent client hint data to use in this
   * page
   * @returns Promise which resolves when the user agent is set.
   */
  async setUserAgent(userAgent, userAgentMetadata) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .setUserAgent(userAgent, userAgentMetadata);
  }
  /**
   * @returns Object containing metrics as key/value pairs.
   *
   * - `Timestamp` : The timestamp when the metrics sample was taken.
   *
   * - `Documents` : Number of documents in the page.
   *
   * - `Frames` : Number of frames in the page.
   *
   * - `JSEventListeners` : Number of events in the page.
   *
   * - `Nodes` : Number of DOM nodes in the page.
   *
   * - `LayoutCount` : Total number of full or partial page layout.
   *
   * - `RecalcStyleCount` : Total number of page style recalculations.
   *
   * - `LayoutDuration` : Combined durations of all page layouts.
   *
   * - `RecalcStyleDuration` : Combined duration of all page style
   *   recalculations.
   *
   * - `ScriptDuration` : Combined duration of JavaScript execution.
   *
   * - `TaskDuration` : Combined duration of all tasks performed by the browser.
   *
   * - `JSHeapUsedSize` : Used JavaScript heap size.
   *
   * - `JSHeapTotalSize` : Total JavaScript heap size.
   *
   * @remarks
   * All timestamps are in monotonic time: monotonically increasing time
   * in seconds since an arbitrary point in the past.
   */
  async metrics() {
    const response = await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Performance.getMetrics",
    );
    return __classPrivateFieldGet(
      this,
      _Page_instances,
      "m",
      _Page_buildMetricsObject,
    ).call(this, response.metrics);
  }
  /**
   * @returns
   * @remarks Shortcut for
   * {@link Frame.url | page.mainFrame().url()}.
   */
  url() {
    return this.mainFrame().url();
  }
  async content() {
    return await __classPrivateFieldGet(this, _Page_frameManager, "f")
      .mainFrame().content();
  }
  /**
   * @param html - HTML markup to assign to the page.
   * @param options - Parameters that has some properties.
   * @remarks
   * The parameter `options` might have the following options.
   *
   * - `timeout` : Maximum time in milliseconds for resources to load, defaults
   *   to 30 seconds, pass `0` to disable timeout. The default value can be
   *   changed by using the {@link Page.setDefaultNavigationTimeout} or
   *   {@link Page.setDefaultTimeout} methods.
   *
   * - `waitUntil`: When to consider setting markup succeeded, defaults to
   *   `load`. Given an array of event strings, setting content is considered
   *   to be successful after all events have been fired. Events can be
   *   either:<br/>
   * - `load` : consider setting content to be finished when the `load` event
   *   is fired.<br/>
   * - `domcontentloaded` : consider setting content to be finished when the
   *   `DOMContentLoaded` event is fired.<br/>
   * - `networkidle0` : consider setting content to be finished when there are
   *   no more than 0 network connections for at least `500` ms.<br/>
   * - `networkidle2` : consider setting content to be finished when there are
   *   no more than 2 network connections for at least `500` ms.
   */
  async setContent(html, options = {}) {
    await __classPrivateFieldGet(this, _Page_frameManager, "f").mainFrame()
      .setContent(html, options);
  }
  /**
   * @param url - URL to navigate page to. The URL should include scheme, e.g.
   * `https://`
   * @param options - Navigation Parameter
   * @returns Promise which resolves to the main resource response. In case of
   * multiple redirects, the navigation will resolve with the response of the
   * last redirect.
   * @remarks
   * The argument `options` might have the following properties:
   *
   * - `timeout` : Maximum navigation time in milliseconds, defaults to 30
   *   seconds, pass 0 to disable timeout. The default value can be changed by
   *   using the {@link Page.setDefaultNavigationTimeout} or
   *   {@link Page.setDefaultTimeout} methods.
   *
   * - `waitUntil`:When to consider navigation succeeded, defaults to `load`.
   *   Given an array of event strings, navigation is considered to be
   *   successful after all events have been fired. Events can be either:<br/>
   * - `load` : consider navigation to be finished when the load event is
   *   fired.<br/>
   * - `domcontentloaded` : consider navigation to be finished when the
   *   DOMContentLoaded event is fired.<br/>
   * - `networkidle0` : consider navigation to be finished when there are no
   *   more than 0 network connections for at least `500` ms.<br/>
   * - `networkidle2` : consider navigation to be finished when there are no
   *   more than 2 network connections for at least `500` ms.
   *
   * - `referer` : Referer header value. If provided it will take preference
   *   over the referer header value set by
   *   {@link Page.setExtraHTTPHeaders |page.setExtraHTTPHeaders()}.
   *
   * `page.goto` will throw an error if:
   *
   * - there's an SSL error (e.g. in case of self-signed certificates).
   * - target URL is invalid.
   * - the timeout is exceeded during navigation.
   * - the remote server does not respond or is unreachable.
   * - the main resource failed to load.
   *
   * `page.goto` will not throw an error when any valid HTTP status code is
   * returned by the remote server, including 404 "Not Found" and 500
   * "Internal Server Error". The status code for such responses can be
   * retrieved by calling response.status().
   *
   * NOTE: `page.goto` either throws an error or returns a main resource
   * response. The only exceptions are navigation to about:blank or navigation
   * to the same URL with a different hash, which would succeed and return null.
   *
   * NOTE: Headless mode doesn't support navigation to a PDF document. See the
   * {@link https://bugs.chromium.org/p/chromium/issues/detail?id=761295 |
   * upstream issue}.
   *
   * Shortcut for {@link Frame.goto | page.mainFrame().goto(url, options)}.
   */
  async goto(url, options = {}) {
    return await __classPrivateFieldGet(this, _Page_frameManager, "f")
      .mainFrame().goto(url, options);
  }
  /**
   * @param options - Navigation parameters which might have the following
   * properties:
   * @returns Promise which resolves to the main resource response. In case of
   * multiple redirects, the navigation will resolve with the response of the
   * last redirect.
   * @remarks
   * The argument `options` might have the following properties:
   *
   * - `timeout` : Maximum navigation time in milliseconds, defaults to 30
   *   seconds, pass 0 to disable timeout. The default value can be changed by
   *   using the {@link Page.setDefaultNavigationTimeout} or
   *   {@link Page.setDefaultTimeout} methods.
   *
   * - `waitUntil`: When to consider navigation succeeded, defaults to `load`.
   *   Given an array of event strings, navigation is considered to be
   *   successful after all events have been fired. Events can be either:<br/>
   * - `load` : consider navigation to be finished when the load event is
   *   fired.<br/>
   * - `domcontentloaded` : consider navigation to be finished when the
   *   DOMContentLoaded event is fired.<br/>
   * - `networkidle0` : consider navigation to be finished when there are no
   *   more than 0 network connections for at least `500` ms.<br/>
   * - `networkidle2` : consider navigation to be finished when there are no
   *   more than 2 network connections for at least `500` ms.
   */
  async reload(options) {
    const result = await Promise.all([
      this.waitForNavigation(options),
      __classPrivateFieldGet(this, _Page_client, "f").send("Page.reload"),
    ]);
    return result[0];
  }
  /**
   * Waits for the page to navigate to a new URL or to reload. It is useful when
   * you run code that will indirectly cause the page to navigate.
   *
   * @example
   *
   * ```ts
   * const [response] = await Promise.all([
   *   page.waitForNavigation(), // The promise resolves after navigation has finished
   *   page.click('a.my-link'), // Clicking the link will indirectly cause a navigation
   * ]);
   * ```
   *
   * @remarks
   * Usage of the
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/History_API | History API}
   * to change the URL is considered a navigation.
   *
   * @param options - Navigation parameters which might have the following
   * properties:
   * @returns A `Promise` which resolves to the main resource response.
   *
   * - In case of multiple redirects, the navigation will resolve with the
   *   response of the last redirect.
   * - In case of navigation to a different anchor or navigation due to History
   *   API usage, the navigation will resolve with `null`.
   */
  async waitForNavigation(options = {}) {
    return await __classPrivateFieldGet(this, _Page_frameManager, "f")
      .mainFrame().waitForNavigation(options);
  }
  /**
   * @param urlOrPredicate - A URL or predicate to wait for
   * @param options - Optional waiting parameters
   * @returns Promise which resolves to the matched response
   * @example
   *
   * ```ts
   * const firstResponse = await page.waitForResponse(
   *   'https://example.com/resource'
   * );
   * const finalResponse = await page.waitForResponse(
   *   response =>
   *     response.url() === 'https://example.com' && response.status() === 200
   * );
   * const finalResponse = await page.waitForResponse(async response => {
   *   return (await response.text()).includes('<html>');
   * });
   * return finalResponse.ok();
   * ```
   *
   * @remarks
   * Optional Waiting Parameters have:
   *
   * - `timeout`: Maximum wait time in milliseconds, defaults to `30` seconds, pass
   *   `0` to disable the timeout. The default value can be changed by using the
   *   {@link Page.setDefaultTimeout} method.
   */
  async waitForRequest(urlOrPredicate, options = {}) {
    const {
      timeout = __classPrivateFieldGet(this, _Page_timeoutSettings, "f")
        .timeout(),
    } = options;
    return waitForEvent(
      __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager,
      NetworkManagerEmittedEvents.Request,
      (request) => {
        if (isString(urlOrPredicate)) {
          return urlOrPredicate === request.url();
        }
        if (typeof urlOrPredicate === "function") {
          return !!urlOrPredicate(request);
        }
        return false;
      },
      timeout,
      __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_sessionClosePromise,
      ).call(this),
    );
  }
  /**
   * @param urlOrPredicate - A URL or predicate to wait for.
   * @param options - Optional waiting parameters
   * @returns Promise which resolves to the matched response.
   * @example
   *
   * ```ts
   * const firstResponse = await page.waitForResponse(
   *   'https://example.com/resource'
   * );
   * const finalResponse = await page.waitForResponse(
   *   response =>
   *     response.url() === 'https://example.com' && response.status() === 200
   * );
   * const finalResponse = await page.waitForResponse(async response => {
   *   return (await response.text()).includes('<html>');
   * });
   * return finalResponse.ok();
   * ```
   *
   * @remarks
   * Optional Parameter have:
   *
   * - `timeout`: Maximum wait time in milliseconds, defaults to `30` seconds,
   *   pass `0` to disable the timeout. The default value can be changed by using
   *   the {@link Page.setDefaultTimeout} method.
   */
  async waitForResponse(urlOrPredicate, options = {}) {
    const {
      timeout = __classPrivateFieldGet(this, _Page_timeoutSettings, "f")
        .timeout(),
    } = options;
    return waitForEvent(
      __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager,
      NetworkManagerEmittedEvents.Response,
      async (response) => {
        if (isString(urlOrPredicate)) {
          return urlOrPredicate === response.url();
        }
        if (typeof urlOrPredicate === "function") {
          return !!(await urlOrPredicate(response));
        }
        return false;
      },
      timeout,
      __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_sessionClosePromise,
      ).call(this),
    );
  }
  /**
   * @param options - Optional waiting parameters
   * @returns Promise which resolves when network is idle
   */
  async waitForNetworkIdle(options = {}) {
    const {
      idleTime = 500,
      timeout = __classPrivateFieldGet(this, _Page_timeoutSettings, "f")
        .timeout(),
    } = options;
    const networkManager =
      __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager;
    let idleResolveCallback;
    const idlePromise = new Promise((resolve) => {
      idleResolveCallback = resolve;
    });
    let abortRejectCallback;
    const abortPromise = new Promise((_, reject) => {
      abortRejectCallback = reject;
    });
    let idleTimer;
    const onIdle = () => {
      return idleResolveCallback();
    };
    const cleanup = () => {
      idleTimer && clearTimeout(idleTimer);
      abortRejectCallback(new Error("abort"));
    };
    const evaluate = () => {
      idleTimer && clearTimeout(idleTimer);
      if (networkManager.numRequestsInProgress() === 0) {
        idleTimer = setTimeout(onIdle, idleTime);
      }
    };
    evaluate();
    const eventHandler = () => {
      evaluate();
      return false;
    };
    const listenToEvent = (event) => {
      return waitForEvent(
        networkManager,
        event,
        eventHandler,
        timeout,
        abortPromise,
      );
    };
    const eventPromises = [
      listenToEvent(NetworkManagerEmittedEvents.Request),
      listenToEvent(NetworkManagerEmittedEvents.Response),
    ];
    await Promise.race([
      idlePromise,
      ...eventPromises,
      __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_sessionClosePromise,
      ).call(this),
    ]).then((r) => {
      cleanup();
      return r;
    }, (error) => {
      cleanup();
      throw error;
    });
  }
  /**
   * @param urlOrPredicate - A URL or predicate to wait for.
   * @param options - Optional waiting parameters
   * @returns Promise which resolves to the matched frame.
   * @example
   *
   * ```ts
   * const frame = await page.waitForFrame(async frame => {
   *   return frame.name() === 'Test';
   * });
   * ```
   *
   * @remarks
   * Optional Parameter have:
   *
   * - `timeout`: Maximum wait time in milliseconds, defaults to `30` seconds,
   *   pass `0` to disable the timeout. The default value can be changed by using
   *   the {@link Page.setDefaultTimeout} method.
   */
  async waitForFrame(urlOrPredicate, options = {}) {
    const {
      timeout = __classPrivateFieldGet(this, _Page_timeoutSettings, "f")
        .timeout(),
    } = options;
    let predicate;
    if (isString(urlOrPredicate)) {
      predicate = (frame) => {
        return Promise.resolve(urlOrPredicate === frame.url());
      };
    } else {
      predicate = (frame) => {
        const value = urlOrPredicate(frame);
        if (typeof value === "boolean") {
          return Promise.resolve(value);
        }
        return value;
      };
    }
    const eventRace = Promise.race([
      waitForEvent(
        __classPrivateFieldGet(this, _Page_frameManager, "f"),
        FrameManagerEmittedEvents.FrameAttached,
        predicate,
        timeout,
        __classPrivateFieldGet(
          this,
          _Page_instances,
          "m",
          _Page_sessionClosePromise,
        ).call(this),
      ),
      waitForEvent(
        __classPrivateFieldGet(this, _Page_frameManager, "f"),
        FrameManagerEmittedEvents.FrameNavigated,
        predicate,
        timeout,
        __classPrivateFieldGet(
          this,
          _Page_instances,
          "m",
          _Page_sessionClosePromise,
        ).call(this),
      ),
      ...this.frames().map(async (frame) => {
        if (await predicate(frame)) {
          return frame;
        }
        return await eventRace;
      }),
    ]);
    return eventRace;
  }
  /**
   * This method navigate to the previous page in history.
   * @param options - Navigation parameters
   * @returns Promise which resolves to the main resource response. In case of
   * multiple redirects, the navigation will resolve with the response of the
   * last redirect. If can not go back, resolves to `null`.
   * @remarks
   * The argument `options` might have the following properties:
   *
   * - `timeout` : Maximum navigation time in milliseconds, defaults to 30
   *   seconds, pass 0 to disable timeout. The default value can be changed by
   *   using the {@link Page.setDefaultNavigationTimeout} or
   *   {@link Page.setDefaultTimeout} methods.
   *
   * - `waitUntil` : When to consider navigation succeeded, defaults to `load`.
   *   Given an array of event strings, navigation is considered to be
   *   successful after all events have been fired. Events can be either:<br/>
   * - `load` : consider navigation to be finished when the load event is
   *   fired.<br/>
   * - `domcontentloaded` : consider navigation to be finished when the
   *   DOMContentLoaded event is fired.<br/>
   * - `networkidle0` : consider navigation to be finished when there are no
   *   more than 0 network connections for at least `500` ms.<br/>
   * - `networkidle2` : consider navigation to be finished when there are no
   *   more than 2 network connections for at least `500` ms.
   */
  async goBack(options = {}) {
    return __classPrivateFieldGet(this, _Page_instances, "m", _Page_go).call(
      this,
      -1,
      options,
    );
  }
  /**
   * This method navigate to the next page in history.
   * @param options - Navigation Parameter
   * @returns Promise which resolves to the main resource response. In case of
   * multiple redirects, the navigation will resolve with the response of the
   * last redirect. If can not go forward, resolves to `null`.
   * @remarks
   * The argument `options` might have the following properties:
   *
   * - `timeout` : Maximum navigation time in milliseconds, defaults to 30
   *   seconds, pass 0 to disable timeout. The default value can be changed by
   *   using the {@link Page.setDefaultNavigationTimeout} or
   *   {@link Page.setDefaultTimeout} methods.
   *
   * - `waitUntil`: When to consider navigation succeeded, defaults to `load`.
   *   Given an array of event strings, navigation is considered to be
   *   successful after all events have been fired. Events can be either:<br/>
   * - `load` : consider navigation to be finished when the load event is
   *   fired.<br/>
   * - `domcontentloaded` : consider navigation to be finished when the
   *   DOMContentLoaded event is fired.<br/>
   * - `networkidle0` : consider navigation to be finished when there are no
   *   more than 0 network connections for at least `500` ms.<br/>
   * - `networkidle2` : consider navigation to be finished when there are no
   *   more than 2 network connections for at least `500` ms.
   */
  async goForward(options = {}) {
    return __classPrivateFieldGet(this, _Page_instances, "m", _Page_go).call(
      this,
      +1,
      options,
    );
  }
  /**
   * Brings page to front (activates tab).
   */
  async bringToFront() {
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Page.bringToFront",
    );
  }
  /**
   * Emulates given device metrics and user agent.
   *
   * @remarks
   * This method is a shortcut for calling two methods:
   * {@link Page.setUserAgent} and {@link Page.setViewport} To aid emulation,
   * Puppeteer provides a list of device descriptors that can be obtained via
   * {@link devices}. `page.emulate` will resize the page. A lot of websites
   * don't expect phones to change size, so you should emulate before navigating
   * to the page.
   * @example
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * const iPhone = puppeteer.devices['iPhone 6'];
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   await page.emulate(iPhone);
   *   await page.goto('https://www.google.com');
   *   // other actions...
   *   await browser.close();
   * })();
   * ```
   *
   * @remarks List of all available devices is available in the source code:
   * {@link https://github.com/puppeteer/puppeteer/blob/main/src/common/DeviceDescriptors.ts | src/common/DeviceDescriptors.ts}.
   */
  async emulate(options) {
    await Promise.all([
      this.setViewport(options.viewport),
      this.setUserAgent(options.userAgent),
    ]);
  }
  /**
   * @param enabled - Whether or not to enable JavaScript on the page.
   * @returns
   * @remarks
   * NOTE: changing this value won't affect scripts that have already been run.
   * It will take full effect on the next navigation.
   */
  async setJavaScriptEnabled(enabled) {
    if (
      __classPrivateFieldGet(this, _Page_javascriptEnabled, "f") === enabled
    ) {
      return;
    }
    __classPrivateFieldSet(this, _Page_javascriptEnabled, enabled, "f");
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Emulation.setScriptExecutionDisabled",
      {
        value: !enabled,
      },
    );
  }
  /**
   * Toggles bypassing page's Content-Security-Policy.
   * @param enabled - sets bypassing of page's Content-Security-Policy.
   * @remarks
   * NOTE: CSP bypassing happens at the moment of CSP initialization rather than
   * evaluation. Usually, this means that `page.setBypassCSP` should be called
   * before navigating to the domain.
   */
  async setBypassCSP(enabled) {
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Page.setBypassCSP",
      { enabled },
    );
  }
  /**
   * @param type - Changes the CSS media type of the page. The only allowed
   * values are `screen`, `print` and `null`. Passing `null` disables CSS media
   * emulation.
   * @example
   *
   * ```ts
   * await page.evaluate(() => matchMedia('screen').matches);
   * // → true
   * await page.evaluate(() => matchMedia('print').matches);
   * // → false
   *
   * await page.emulateMediaType('print');
   * await page.evaluate(() => matchMedia('screen').matches);
   * // → false
   * await page.evaluate(() => matchMedia('print').matches);
   * // → true
   *
   * await page.emulateMediaType(null);
   * await page.evaluate(() => matchMedia('screen').matches);
   * // → true
   * await page.evaluate(() => matchMedia('print').matches);
   * // → false
   * ```
   */
  async emulateMediaType(type) {
    assert(
      type === "screen" ||
        type === "print" ||
        (type !== null && type !== void 0 ? type : undefined) === undefined,
      "Unsupported media type: " + type,
    );
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Emulation.setEmulatedMedia",
      {
        media: type || "",
      },
    );
  }
  /**
   * Enables CPU throttling to emulate slow CPUs.
   * @param factor - slowdown factor (1 is no throttle, 2 is 2x slowdown, etc).
   */
  async emulateCPUThrottling(factor) {
    assert(
      factor === null || factor >= 1,
      "Throttling rate should be greater or equal to 1",
    );
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Emulation.setCPUThrottlingRate",
      {
        rate: factor !== null ? factor : 1,
      },
    );
  }
  /**
   * @param features - `<?Array<Object>>` Given an array of media feature
   * objects, emulates CSS media features on the page. Each media feature object
   * must have the following properties:
   * @example
   *
   * ```ts
   * await page.emulateMediaFeatures([
   *   {name: 'prefers-color-scheme', value: 'dark'},
   * ]);
   * await page.evaluate(
   *   () => matchMedia('(prefers-color-scheme: dark)').matches
   * );
   * // → true
   * await page.evaluate(
   *   () => matchMedia('(prefers-color-scheme: light)').matches
   * );
   * // → false
   *
   * await page.emulateMediaFeatures([
   *   {name: 'prefers-reduced-motion', value: 'reduce'},
   * ]);
   * await page.evaluate(
   *   () => matchMedia('(prefers-reduced-motion: reduce)').matches
   * );
   * // → true
   * await page.evaluate(
   *   () => matchMedia('(prefers-reduced-motion: no-preference)').matches
   * );
   * // → false
   *
   * await page.emulateMediaFeatures([
   *   {name: 'prefers-color-scheme', value: 'dark'},
   *   {name: 'prefers-reduced-motion', value: 'reduce'},
   * ]);
   * await page.evaluate(
   *   () => matchMedia('(prefers-color-scheme: dark)').matches
   * );
   * // → true
   * await page.evaluate(
   *   () => matchMedia('(prefers-color-scheme: light)').matches
   * );
   * // → false
   * await page.evaluate(
   *   () => matchMedia('(prefers-reduced-motion: reduce)').matches
   * );
   * // → true
   * await page.evaluate(
   *   () => matchMedia('(prefers-reduced-motion: no-preference)').matches
   * );
   * // → false
   *
   * await page.emulateMediaFeatures([{name: 'color-gamut', value: 'p3'}]);
   * await page.evaluate(() => matchMedia('(color-gamut: srgb)').matches);
   * // → true
   * await page.evaluate(() => matchMedia('(color-gamut: p3)').matches);
   * // → true
   * await page.evaluate(() => matchMedia('(color-gamut: rec2020)').matches);
   * // → false
   * ```
   */
  async emulateMediaFeatures(features) {
    if (!features) {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setEmulatedMedia",
        {},
      );
    }
    if (Array.isArray(features)) {
      for (const mediaFeature of features) {
        const name = mediaFeature.name;
        assert(
          /^(?:prefers-(?:color-scheme|reduced-motion)|color-gamut)$/.test(
            name,
          ),
          "Unsupported media feature: " + name,
        );
      }
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setEmulatedMedia",
        {
          features: features,
        },
      );
    }
  }
  /**
   * @param timezoneId - Changes the timezone of the page. See
   * {@link https://source.chromium.org/chromium/chromium/deps/icu.git/+/faee8bc70570192d82d2978a71e2a615788597d1:source/data/misc/metaZones.txt | ICU’s metaZones.txt}
   * for a list of supported timezone IDs. Passing
   * `null` disables timezone emulation.
   */
  async emulateTimezone(timezoneId) {
    try {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setTimezoneOverride",
        {
          timezoneId: timezoneId || "",
        },
      );
    } catch (error) {
      if (isErrorLike(error) && error.message.includes("Invalid timezone")) {
        throw new Error(`Invalid timezone ID: ${timezoneId}`);
      }
      throw error;
    }
  }
  /**
   * Emulates the idle state.
   * If no arguments set, clears idle state emulation.
   *
   * @example
   *
   * ```ts
   * // set idle emulation
   * await page.emulateIdleState({isUserActive: true, isScreenUnlocked: false});
   *
   * // do some checks here
   * ...
   *
   * // clear idle emulation
   * await page.emulateIdleState();
   * ```
   *
   * @param overrides - Mock idle state. If not set, clears idle overrides
   */
  async emulateIdleState(overrides) {
    if (overrides) {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setIdleOverride",
        {
          isUserActive: overrides.isUserActive,
          isScreenUnlocked: overrides.isScreenUnlocked,
        },
      );
    } else {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.clearIdleOverride",
      );
    }
  }
  /**
   * Simulates the given vision deficiency on the page.
   *
   * @example
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   *
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   await page.goto('https://v8.dev/blog/10-years');
   *
   *   await page.emulateVisionDeficiency('achromatopsia');
   *   await page.screenshot({path: 'achromatopsia.png'});
   *
   *   await page.emulateVisionDeficiency('deuteranopia');
   *   await page.screenshot({path: 'deuteranopia.png'});
   *
   *   await page.emulateVisionDeficiency('blurredVision');
   *   await page.screenshot({path: 'blurred-vision.png'});
   *
   *   await browser.close();
   * })();
   * ```
   *
   * @param type - the type of deficiency to simulate, or `'none'` to reset.
   */
  async emulateVisionDeficiency(type) {
    const visionDeficiencies = new Set([
      "none",
      "achromatopsia",
      "blurredVision",
      "deuteranopia",
      "protanopia",
      "tritanopia",
    ]);
    try {
      assert(
        !type || visionDeficiencies.has(type),
        `Unsupported vision deficiency: ${type}`,
      );
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setEmulatedVisionDeficiency",
        {
          type: type || "none",
        },
      );
    } catch (error) {
      throw error;
    }
  }
  /**
   * `page.setViewport` will resize the page. A lot of websites don't expect
   * phones to change size, so you should set the viewport before navigating to
   * the page.
   *
   * In the case of multiple pages in a single browser, each page can have its
   * own viewport size.
   * @example
   *
   * ```ts
   * const page = await browser.newPage();
   * await page.setViewport({
   *   width: 640,
   *   height: 480,
   *   deviceScaleFactor: 1,
   * });
   * await page.goto('https://example.com');
   * ```
   *
   * @param viewport -
   * @remarks
   * Argument viewport have following properties:
   *
   * - `width`: page width in pixels. required
   *
   * - `height`: page height in pixels. required
   *
   * - `deviceScaleFactor`: Specify device scale factor (can be thought of as
   *   DPR). Defaults to `1`.
   *
   * - `isMobile`: Whether the meta viewport tag is taken into account. Defaults
   *   to `false`.
   *
   * - `hasTouch`: Specifies if viewport supports touch events. Defaults to `false`
   *
   * - `isLandScape`: Specifies if viewport is in landscape mode. Defaults to false.
   *
   * NOTE: in certain cases, setting viewport will reload the page in order to
   * set the isMobile or hasTouch properties.
   */
  async setViewport(viewport) {
    const needsReload = await __classPrivateFieldGet(
      this,
      _Page_emulationManager,
      "f",
    ).emulateViewport(viewport);
    __classPrivateFieldSet(this, _Page_viewport, viewport, "f");
    if (needsReload) {
      await this.reload();
    }
  }
  /**
   * @returns
   *
   * - `width`: page's width in pixels
   *
   * - `height`: page's height in pixels
   *
   * - `deviceScalarFactor`: Specify device scale factor (can be though of as
   *   dpr). Defaults to `1`.
   *
   * - `isMobile`: Whether the meta viewport tag is taken into account. Defaults
   *   to `false`.
   *
   * - `hasTouch`: Specifies if viewport supports touch events. Defaults to
   *   `false`.
   *
   * - `isLandScape`: Specifies if viewport is in landscape mode. Defaults to
   *   `false`.
   */
  viewport() {
    return __classPrivateFieldGet(this, _Page_viewport, "f");
  }
  /**
   * Evaluates a function in the page's context and returns the result.
   *
   * If the function passed to `page.evaluteHandle` returns a Promise, the
   * function will wait for the promise to resolve and return its value.
   *
   * @example
   *
   * ```ts
   * const result = await frame.evaluate(() => {
   *   return Promise.resolve(8 * 7);
   * });
   * console.log(result); // prints "56"
   * ```
   *
   * You can pass a string instead of a function (although functions are
   * recommended as they are easier to debug and use with TypeScript):
   *
   * @example
   *
   * ```ts
   * const aHandle = await page.evaluate('1 + 2');
   * ```
   *
   * To get the best TypeScript experience, you should pass in as the
   * generic the type of `pageFunction`:
   *
   * ```ts
   * const aHandle = await page.evaluate(() => 2);
   * ```
   *
   * @example
   *
   * {@link ElementHandle} instances (including {@link JSHandle}s) can be passed
   * as arguments to the `pageFunction`:
   *
   * ```ts
   * const bodyHandle = await page.$('body');
   * const html = await page.evaluate(body => body.innerHTML, bodyHandle);
   * await bodyHandle.dispose();
   * ```
   *
   * @param pageFunction - a function that is run within the page
   * @param args - arguments to be passed to the pageFunction
   *
   * @returns the return value of `pageFunction`.
   */
  async evaluate(pageFunction, ...args) {
    return __classPrivateFieldGet(this, _Page_frameManager, "f").mainFrame()
      .evaluate(pageFunction, ...args);
  }
  /**
   * Adds a function which would be invoked in one of the following scenarios:
   *
   * - whenever the page is navigated
   *
   * - whenever the child frame is attached or navigated. In this case, the
   *   function is invoked in the context of the newly attached frame.
   *
   * The function is invoked after the document was created but before any of
   * its scripts were run. This is useful to amend the JavaScript environment,
   * e.g. to seed `Math.random`.
   * @param pageFunction - Function to be evaluated in browser context
   * @param args - Arguments to pass to `pageFunction`
   * @example
   * An example of overriding the navigator.languages property before the page loads:
   *
   * ```ts
   * // preload.js
   *
   * // overwrite the `languages` property to use a custom getter
   * Object.defineProperty(navigator, 'languages', {
   * get: function () {
   * return ['en-US', 'en', 'bn'];
   * },
   * });
   *
   * // In your puppeteer script, assuming the preload.js file is
   * in same folder of our script
   * const preloadFile = fs.readFileSync('./preload.js', 'utf8');
   * await page.evaluateOnNewDocument(preloadFile);
   * ```
   */
  async evaluateOnNewDocument(pageFunction, ...args) {
    const source = evaluationString(pageFunction, ...args);
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source,
      },
    );
  }
  /**
   * Toggles ignoring cache for each request based on the enabled state. By
   * default, caching is enabled.
   * @param enabled - sets the `enabled` state of cache
   */
  async setCacheEnabled(enabled = true) {
    await __classPrivateFieldGet(this, _Page_frameManager, "f").networkManager
      .setCacheEnabled(enabled);
  }
  /**
   * @remarks
   * Options object which might have the following properties:
   *
   * - `path` : The file path to save the image to. The screenshot type
   *   will be inferred from file extension. If `path` is a relative path, then
   *   it is resolved relative to
   *   {@link https://nodejs.org/api/process.html#process_process_cwd
   *   | current working directory}.
   *   If no path is provided, the image won't be saved to the disk.
   *
   * - `type` : Specify screenshot type, can be either `jpeg` or `png`.
   *   Defaults to 'png'.
   *
   * - `quality` : The quality of the image, between 0-100. Not
   *   applicable to `png` images.
   *
   * - `fullPage` : When true, takes a screenshot of the full
   *   scrollable page. Defaults to `false`.
   *
   * - `clip` : An object which specifies clipping region of the page.
   *   Should have the following fields:<br/>
   * - `x` : x-coordinate of top-left corner of clip area.<br/>
   * - `y` : y-coordinate of top-left corner of clip area.<br/>
   * - `width` : width of clipping area.<br/>
   * - `height` : height of clipping area.
   *
   * - `omitBackground` : Hides default white background and allows
   *   capturing screenshots with transparency. Defaults to `false`.
   *
   * - `encoding` : The encoding of the image, can be either base64 or
   *   binary. Defaults to `binary`.
   *
   * - `captureBeyondViewport` : When true, captures screenshot
   *   {@link https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot
   *   | beyond the viewport}. When false, falls back to old behaviour,
   *   and cuts the screenshot by the viewport size. Defaults to `true`.
   *
   * - `fromSurface` : When true, captures screenshot
   *   {@link https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot
   *   | from the surface rather than the view}. When false, works only in
   *   headful mode and ignores page viewport (but not browser window's
   *   bounds). Defaults to `true`.
   *
   * NOTE: Screenshots take at least 1/6 second on OS X. See
   * {@link https://crbug.com/741689} for discussion.
   * @returns Promise which resolves to buffer or a base64 string (depending on
   * the value of `encoding`) with captured screenshot.
   */
  async screenshot(options = {}) {
    let screenshotType =
      "png" /* Protocol.Page.CaptureScreenshotRequestFormat.Png */;
    // options.type takes precedence over inferring the type from options.path
    // because it may be a 0-length file with no extension created beforehand
    // (i.e. as a temp file).
    if (options.type) {
      screenshotType = options.type;
    } else if (options.path) {
      const filePath = options.path;
      const extension = filePath
        .slice(filePath.lastIndexOf(".") + 1)
        .toLowerCase();
      switch (extension) {
        case "png":
          screenshotType =
            "png" /* Protocol.Page.CaptureScreenshotRequestFormat.Png */;
          break;
        case "jpeg":
        case "jpg":
          screenshotType =
            "jpeg" /* Protocol.Page.CaptureScreenshotRequestFormat.Jpeg */;
          break;
        case "webp":
          screenshotType =
            "webp" /* Protocol.Page.CaptureScreenshotRequestFormat.Webp */;
          break;
        default:
          throw new Error(
            `Unsupported screenshot type for extension \`.${extension}\``,
          );
      }
    }
    if (options.quality) {
      assert(
        screenshotType ===
            "jpeg" /* Protocol.Page.CaptureScreenshotRequestFormat.Jpeg */ ||
          screenshotType ===
            "webp", /* Protocol.Page.CaptureScreenshotRequestFormat.Webp */
        "options.quality is unsupported for the " +
          screenshotType +
          " screenshots",
      );
      assert(
        typeof options.quality === "number",
        "Expected options.quality to be a number but found " +
          typeof options.quality,
      );
      assert(
        Number.isInteger(options.quality),
        "Expected options.quality to be an integer",
      );
      assert(
        options.quality >= 0 && options.quality <= 100,
        "Expected options.quality to be between 0 and 100 (inclusive), got " +
          options.quality,
      );
    }
    assert(
      !options.clip || !options.fullPage,
      "options.clip and options.fullPage are exclusive",
    );
    if (options.clip) {
      assert(
        typeof options.clip.x === "number",
        "Expected options.clip.x to be a number but found " +
          typeof options.clip.x,
      );
      assert(
        typeof options.clip.y === "number",
        "Expected options.clip.y to be a number but found " +
          typeof options.clip.y,
      );
      assert(
        typeof options.clip.width === "number",
        "Expected options.clip.width to be a number but found " +
          typeof options.clip.width,
      );
      assert(
        typeof options.clip.height === "number",
        "Expected options.clip.height to be a number but found " +
          typeof options.clip.height,
      );
      assert(
        options.clip.width !== 0,
        "Expected options.clip.width not to be 0.",
      );
      assert(
        options.clip.height !== 0,
        "Expected options.clip.height not to be 0.",
      );
    }
    return __classPrivateFieldGet(this, _Page_screenshotTaskQueue, "f")
      .postTask(() => {
        return __classPrivateFieldGet(
          this,
          _Page_instances,
          "m",
          _Page_screenshotTask,
        ).call(this, screenshotType, options);
      });
  }
  /**
   * Generates a PDF of the page with the `print` CSS media type.
   * @remarks
   *
   * NOTE: PDF generation is only supported in Chrome headless mode.
   *
   * To generate a PDF with the `screen` media type, call
   * {@link Page.emulateMediaType | `page.emulateMediaType('screen')`} before
   * calling `page.pdf()`.
   *
   * By default, `page.pdf()` generates a pdf with modified colors for printing.
   * Use the
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust | `-webkit-print-color-adjust`}
   * property to force rendering of exact colors.
   *
   * @param options - options for generating the PDF.
   */
  async createPDFStream(options = {}) {
    const {
      scale = 1,
      displayHeaderFooter = false,
      headerTemplate = "",
      footerTemplate = "",
      printBackground = false,
      landscape = false,
      pageRanges = "",
      preferCSSPageSize = false,
      margin = {},
      omitBackground = false,
      timeout = 30000,
    } = options;
    let paperWidth = 8.5;
    let paperHeight = 11;
    if (options.format) {
      const format = _paperFormats[options.format.toLowerCase()];
      assert(format, "Unknown paper format: " + options.format);
      paperWidth = format.width;
      paperHeight = format.height;
    } else {
      paperWidth = convertPrintParameterToInches(options.width) || paperWidth;
      paperHeight = convertPrintParameterToInches(options.height) ||
        paperHeight;
    }
    const marginTop = convertPrintParameterToInches(margin.top) || 0;
    const marginLeft = convertPrintParameterToInches(margin.left) || 0;
    const marginBottom = convertPrintParameterToInches(margin.bottom) || 0;
    const marginRight = convertPrintParameterToInches(margin.right) || 0;
    if (omitBackground) {
      await __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_setTransparentBackgroundColor,
      ).call(this);
    }
    const printCommandPromise = __classPrivateFieldGet(this, _Page_client, "f")
      .send("Page.printToPDF", {
        transferMode: "ReturnAsStream",
        landscape,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
        printBackground,
        scale,
        paperWidth,
        paperHeight,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        pageRanges,
        preferCSSPageSize,
      });
    const result = await waitWithTimeout(
      printCommandPromise,
      "Page.printToPDF",
      timeout,
    );
    if (omitBackground) {
      await __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_resetDefaultBackgroundColor,
      ).call(this);
    }
    assert(result.stream, "`stream` is missing from `Page.printToPDF");
    return getReadableStreamFromProtocolStream(
      __classPrivateFieldGet(this, _Page_client, "f"),
      result.stream,
    );
  }
  /**
   * @param options -
   * @returns
   */
  async pdf(options = {}) {
    const { path = undefined } = options;
    const readableStream = await this.createPDFStream(options);
    const data = await getReadableStreamAsUint8Array(readableStream, path);
    return data;
  }
  /**
   * @returns The page's title
   * @remarks
   * Shortcut for {@link Frame.title | page.mainFrame().title()}.
   */
  async title() {
    return this.mainFrame().title();
  }
  async close(options = { runBeforeUnload: undefined }) {
    const connection = __classPrivateFieldGet(this, _Page_client, "f")
      .connection();
    assert(
      connection,
      "Protocol error: Connection closed. Most likely the page has been closed.",
    );
    const runBeforeUnload = !!options.runBeforeUnload;
    if (runBeforeUnload) {
      await __classPrivateFieldGet(this, _Page_client, "f").send("Page.close");
    } else {
      await connection.send("Target.closeTarget", {
        targetId: __classPrivateFieldGet(this, _Page_target, "f")._targetId,
      });
      await __classPrivateFieldGet(this, _Page_target, "f")._isClosedPromise;
    }
  }
  /**
   * Indicates that the page has been closed.
   * @returns
   */
  isClosed() {
    return __classPrivateFieldGet(this, _Page_closed, "f");
  }
  get mouse() {
    return __classPrivateFieldGet(this, _Page_mouse, "f");
  }
  /**
   * This method fetches an element with `selector`, scrolls it into view if
   * needed, and then uses {@link Page.mouse} to click in the center of the
   * element. If there's no element matching `selector`, the method throws an
   * error.
   * @remarks Bear in mind that if `click()` triggers a navigation event and
   * there's a separate `page.waitForNavigation()` promise to be resolved, you
   * may end up with a race condition that yields unexpected results. The
   * correct pattern for click and wait for navigation is the following:
   *
   * ```ts
   * const [response] = await Promise.all([
   *   page.waitForNavigation(waitOptions),
   *   page.click(selector, clickOptions),
   * ]);
   * ```
   *
   * Shortcut for {@link Frame.click | page.mainFrame().click(selector[, options]) }.
   * @param selector - A `selector` to search for element to click. If there are
   * multiple elements satisfying the `selector`, the first will be clicked
   * @param options - `Object`
   * @returns Promise which resolves when the element matching `selector` is
   * successfully clicked. The Promise will be rejected if there is no element
   * matching `selector`.
   */
  click(selector, options = {}) {
    return this.mainFrame().click(selector, options);
  }
  /**
   * This method fetches an element with `selector` and focuses it. If there's no
   * element matching `selector`, the method throws an error.
   * @param selector - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector }
   * of an element to focus. If there are multiple elements satisfying the
   * selector, the first will be focused.
   * @returns Promise which resolves when the element matching selector is
   * successfully focused. The promise will be rejected if there is no element
   * matching selector.
   * @remarks
   * Shortcut for {@link Frame.focus | page.mainFrame().focus(selector)}.
   */
  focus(selector) {
    return this.mainFrame().focus(selector);
  }
  /**
   * This method fetches an element with `selector`, scrolls it into view if
   * needed, and then uses {@link Page.mouse} to hover over the center of the element.
   * If there's no element matching `selector`, the method throws an error.
   * @param selector - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector}
   * to search for element to hover. If there are multiple elements satisfying
   * the selector, the first will be hovered.
   * @returns Promise which resolves when the element matching `selector` is
   * successfully hovered. Promise gets rejected if there's no element matching
   * `selector`.
   * @remarks
   * Shortcut for {@link Page.hover | page.mainFrame().hover(selector)}.
   */
  hover(selector) {
    return this.mainFrame().hover(selector);
  }
  /**
   * Triggers a `change` and `input` event once all the provided options have been
   * selected. If there's no `<select>` element matching `selector`, the method
   * throws an error.
   *
   * @example
   *
   * ```ts
   * page.select('select#colors', 'blue'); // single selection
   * page.select('select#colors', 'red', 'green', 'blue'); // multiple selections
   * ```
   *
   * @param selector - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | Selector}
   * to query the page for
   * @param values - Values of options to select. If the `<select>` has the
   * `multiple` attribute, all values are considered, otherwise only the first one
   * is taken into account.
   * @returns
   *
   * @remarks
   * Shortcut for {@link Frame.select | page.mainFrame().select()}
   */
  select(selector, ...values) {
    return this.mainFrame().select(selector, ...values);
  }
  /**
   * This method fetches an element with `selector`, scrolls it into view if
   * needed, and then uses {@link Page.touchscreen} to tap in the center of the element.
   * If there's no element matching `selector`, the method throws an error.
   * @param selector - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | Selector}
   * to search for element to tap. If there are multiple elements satisfying the
   * selector, the first will be tapped.
   * @returns
   * @remarks
   * Shortcut for {@link Frame.tap | page.mainFrame().tap(selector)}.
   */
  tap(selector) {
    return this.mainFrame().tap(selector);
  }
  /**
   * Sends a `keydown`, `keypress/input`, and `keyup` event for each character
   * in the text.
   *
   * To press a special key, like `Control` or `ArrowDown`, use {@link Keyboard.press}.
   * @example
   *
   * ```ts
   * await page.type('#mytextarea', 'Hello');
   * // Types instantly
   * await page.type('#mytextarea', 'World', {delay: 100});
   * // Types slower, like a user
   * ```
   *
   * @param selector - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector}
   * of an element to type into. If there are multiple elements satisfying the
   * selector, the first will be used.
   * @param text - A text to type into a focused element.
   * @param options - have property `delay` which is the Time to wait between
   * key presses in milliseconds. Defaults to `0`.
   * @returns
   * @remarks
   */
  type(selector, text, options) {
    return this.mainFrame().type(selector, text, options);
  }
  /**
   * @deprecated Use `new Promise(r => setTimeout(r, milliseconds));`.
   *
   * Causes your script to wait for the given number of milliseconds.
   *
   * @remarks
   * It's generally recommended to not wait for a number of seconds, but instead
   * use {@link Frame.waitForSelector}, {@link Frame.waitForXPath} or
   * {@link Frame.waitForFunction} to wait for exactly the conditions you want.
   *
   * @example
   *
   * Wait for 1 second:
   *
   * ```ts
   * await page.waitForTimeout(1000);
   * ```
   *
   * @param milliseconds - the number of milliseconds to wait.
   */
  waitForTimeout(milliseconds) {
    return this.mainFrame().waitForTimeout(milliseconds);
  }
  /**
   * Wait for the `selector` to appear in page. If at the moment of calling the
   * method the `selector` already exists, the method will return immediately. If
   * the `selector` doesn't appear after the `timeout` milliseconds of waiting, the
   * function will throw.
   *
   * This method works across navigations:
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   let currentURL;
   *   page
   *     .waitForSelector('img')
   *     .then(() => console.log('First URL with image: ' + currentURL));
   *   for (currentURL of [
   *     'https://example.com',
   *     'https://google.com',
   *     'https://bbc.com',
   *   ]) {
   *     await page.goto(currentURL);
   *   }
   *   await browser.close();
   * })();
   * ```
   *
   * @param selector - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors | selector}
   * of an element to wait for
   * @param options - Optional waiting parameters
   * @returns Promise which resolves when element specified by selector string
   * is added to DOM. Resolves to `null` if waiting for hidden: `true` and
   * selector is not found in DOM.
   * @remarks
   * The optional Parameter in Arguments `options` are :
   *
   * - `Visible`: A boolean wait for element to be present in DOM and to be
   *   visible, i.e. to not have `display: none` or `visibility: hidden` CSS
   *   properties. Defaults to `false`.
   *
   * - `hidden`: Wait for element to not be found in the DOM or to be hidden,
   *   i.e. have `display: none` or `visibility: hidden` CSS properties. Defaults to
   *   `false`.
   *
   * - `timeout`: maximum time to wait for in milliseconds. Defaults to `30000`
   *   (30 seconds). Pass `0` to disable timeout. The default value can be changed
   *   by using the {@link Page.setDefaultTimeout} method.
   */
  async waitForSelector(selector, options = {}) {
    return await this.mainFrame().waitForSelector(selector, options);
  }
  /**
   * Wait for the `xpath` to appear in page. If at the moment of calling the
   * method the `xpath` already exists, the method will return immediately. If
   * the `xpath` doesn't appear after the `timeout` milliseconds of waiting, the
   * function will throw.
   *
   * This method works across navigation
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   let currentURL;
   *   page
   *     .waitForXPath('//img')
   *     .then(() => console.log('First URL with image: ' + currentURL));
   *   for (currentURL of [
   *     'https://example.com',
   *     'https://google.com',
   *     'https://bbc.com',
   *   ]) {
   *     await page.goto(currentURL);
   *   }
   *   await browser.close();
   * })();
   * ```
   *
   * @param xpath - A
   * {@link https://developer.mozilla.org/en-US/docs/Web/XPath | xpath} of an
   * element to wait for
   * @param options - Optional waiting parameters
   * @returns Promise which resolves when element specified by xpath string is
   * added to DOM. Resolves to `null` if waiting for `hidden: true` and xpath is
   * not found in DOM.
   * @remarks
   * The optional Argument `options` have properties:
   *
   * - `visible`: A boolean to wait for element to be present in DOM and to be
   *   visible, i.e. to not have `display: none` or `visibility: hidden` CSS
   *   properties. Defaults to `false`.
   *
   * - `hidden`: A boolean wait for element to not be found in the DOM or to be
   *   hidden, i.e. have `display: none` or `visibility: hidden` CSS properties.
   *   Defaults to `false`.
   *
   * - `timeout`: A number which is maximum time to wait for in milliseconds.
   *   Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default
   *   value can be changed by using the {@link Page.setDefaultTimeout} method.
   */
  waitForXPath(xpath, options = {}) {
    return this.mainFrame().waitForXPath(xpath, options);
  }
  /**
   * Waits for a function to finish evaluating in the page's context.
   *
   * @example
   * The {@link Page.waitForFunction} can be used to observe viewport size change:
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   const watchDog = page.waitForFunction('window.innerWidth < 100');
   *   await page.setViewport({width: 50, height: 50});
   *   await watchDog;
   *   await browser.close();
   * })();
   * ```
   *
   * @example
   * To pass arguments from node.js to the predicate of
   * {@link Page.waitForFunction} function:
   *
   * ```ts
   * const selector = '.foo';
   * await page.waitForFunction(
   *   selector => !!document.querySelector(selector),
   *   {},
   *   selector
   * );
   * ```
   *
   * @example
   * The predicate of {@link Page.waitForFunction} can be asynchronous too:
   *
   * ```ts
   * const username = 'github-username';
   * await page.waitForFunction(
   *   async username => {
   *     const githubResponse = await fetch(
   *       `https://api.github.com/users/${username}`
   *     );
   *     const githubUser = await githubResponse.json();
   *     // show the avatar
   *     const img = document.createElement('img');
   *     img.src = githubUser.avatar_url;
   *     // wait 3 seconds
   *     await new Promise((resolve, reject) => setTimeout(resolve, 3000));
   *     img.remove();
   *   },
   *   {},
   *   username
   * );
   * ```
   *
   * @param pageFunction - Function to be evaluated in browser context
   * @param options - Optional waiting parameters
   *
   * - `polling` - An interval at which the `pageFunction` is executed, defaults
   *   to `raf`. If `polling` is a number, then it is treated as an interval in
   *   milliseconds at which the function would be executed. If polling is a
   *   string, then it can be one of the following values:
   *   - `raf` - to constantly execute `pageFunction` in
   *     `requestAnimationFrame` callback. This is the tightest polling mode
   *     which is suitable to observe styling changes.
   *   - `mutation`- to execute pageFunction on every DOM mutation.
   * - `timeout` - maximum time to wait for in milliseconds. Defaults to `30000`
   *   (30 seconds). Pass `0` to disable timeout. The default value can be
   *   changed by using the {@link Page.setDefaultTimeout} method.
   *   @param args - Arguments to pass to `pageFunction`
   *   @returns A `Promise` which resolves to a JSHandle/ElementHandle of the the
   *   `pageFunction`'s return value.
   */
  waitForFunction(pageFunction, options = {}, ...args) {
    return this.mainFrame().waitForFunction(pageFunction, options, ...args);
  }
}
_Page_closed = new WeakMap(),
  _Page_client = new WeakMap(),
  _Page_target = new WeakMap(),
  _Page_keyboard = new WeakMap(),
  _Page_mouse = new WeakMap(),
  _Page_timeoutSettings = new WeakMap(),
  _Page_touchscreen = new WeakMap(),
  _Page_accessibility = new WeakMap(),
  _Page_frameManager = new WeakMap(),
  _Page_emulationManager = new WeakMap(),
  _Page_tracing = new WeakMap(),
  _Page_pageBindings = new WeakMap(),
  _Page_coverage = new WeakMap(),
  _Page_javascriptEnabled = new WeakMap(),
  _Page_viewport = new WeakMap(),
  _Page_screenshotTaskQueue = new WeakMap(),
  _Page_workers = new WeakMap(),
  _Page_fileChooserPromises = new WeakMap(),
  _Page_disconnectPromise = new WeakMap(),
  _Page_userDragInterceptionEnabled = new WeakMap(),
  _Page_handlerMap = new WeakMap(),
  _Page_onDetachedFromTarget = new WeakMap(),
  _Page_onAttachedToTarget = new WeakMap(),
  _Page_instances = new WeakSet(),
  _Page_initialize = async function _Page_initialize() {
    await Promise.all([
      __classPrivateFieldGet(this, _Page_frameManager, "f").initialize(
        __classPrivateFieldGet(this, _Page_target, "f")._targetId,
      ),
      __classPrivateFieldGet(this, _Page_client, "f").send(
        "Performance.enable",
      ),
      __classPrivateFieldGet(this, _Page_client, "f").send("Log.enable"),
    ]);
  },
  _Page_onFileChooser = async function _Page_onFileChooser(event) {
    if (!__classPrivateFieldGet(this, _Page_fileChooserPromises, "f").size) {
      return;
    }
    const frame = __classPrivateFieldGet(this, _Page_frameManager, "f").frame(
      event.frameId,
    );
    assert(frame, "This should never happen.");
    // This is guaranteed to be an HTMLInputElement handle by the event.
    const handle =
      (await frame.worlds[MAIN_WORLD].adoptBackendNode(event.backendNodeId));
    const fileChooser = new FileChooser(handle, event);
    for (
      const promise of __classPrivateFieldGet(
        this,
        _Page_fileChooserPromises,
        "f",
      )
    ) {
      promise.resolve(fileChooser);
    }
    __classPrivateFieldGet(this, _Page_fileChooserPromises, "f").clear();
  },
  _Page_onTargetCrashed = function _Page_onTargetCrashed() {
    this.emit("error", new Error("Page crashed!"));
  },
  _Page_onLogEntryAdded = function _Page_onLogEntryAdded(event) {
    const { level, text, args, source, url, lineNumber } = event.entry;
    if (args) {
      args.map((arg) => {
        return releaseObject(
          __classPrivateFieldGet(this, _Page_client, "f"),
          arg,
        );
      });
    }
    if (source !== "worker") {
      this.emit(
        "console", /* PageEmittedEvents.Console */
        new ConsoleMessage(level, text, [], [{ url, lineNumber }]),
      );
    }
  },
  _Page_emitMetrics = function _Page_emitMetrics(event) {
    this.emit("metrics", /* PageEmittedEvents.Metrics */ {
      title: event.title,
      metrics: __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_buildMetricsObject,
      ).call(this, event.metrics),
    });
  },
  _Page_buildMetricsObject = function _Page_buildMetricsObject(metrics) {
    const result = {};
    for (const metric of metrics || []) {
      if (supportedMetrics.has(metric.name)) {
        result[metric.name] = metric.value;
      }
    }
    return result;
  },
  _Page_handleException = function _Page_handleException(exceptionDetails) {
    const message = getExceptionMessage(exceptionDetails);
    const err = new Error(message);
    err.stack = ""; // Don't report clientside error with a node stack attached
    this.emit("pageerror", /* PageEmittedEvents.PageError */ err);
  },
  _Page_onConsoleAPI = async function _Page_onConsoleAPI(event) {
    if (event.executionContextId === 0) {
      // DevTools protocol stores the last 1000 console messages. These
      // messages are always reported even for removed execution contexts. In
      // this case, they are marked with executionContextId = 0 and are
      // reported upon enabling Runtime agent.
      //
      // Ignore these messages since:
      // - there's no execution context we can use to operate with message
      //   arguments
      // - these messages are reported before Puppeteer clients can subscribe
      //   to the 'console'
      //   page event.
      //
      // @see https://github.com/puppeteer/puppeteer/issues/3865
      return;
    }
    const context = __classPrivateFieldGet(this, _Page_frameManager, "f")
      .executionContextById(
        event.executionContextId,
        __classPrivateFieldGet(this, _Page_client, "f"),
      );
    const values = event.args.map((arg) => {
      return createJSHandle(context, arg);
    });
    __classPrivateFieldGet(this, _Page_instances, "m", _Page_addConsoleMessage)
      .call(this, event.type, values, event.stackTrace);
  },
  _Page_onBindingCalled = async function _Page_onBindingCalled(event) {
    let payload;
    try {
      payload = JSON.parse(event.payload);
    } catch {
      // The binding was either called by something in the page or it was
      // called before our wrapper was initialized.
      return;
    }
    const { type, name, seq, args } = payload;
    if (
      type !== "exposedFun" ||
      !__classPrivateFieldGet(this, _Page_pageBindings, "f").has(name)
    ) {
      return;
    }
    let expression = null;
    try {
      const pageBinding = __classPrivateFieldGet(this, _Page_pageBindings, "f")
        .get(name);
      assert(pageBinding);
      const result = await pageBinding(...args);
      expression = pageBindingDeliverResultString(name, seq, result);
    } catch (error) {
      if (isErrorLike(error)) {
        expression = pageBindingDeliverErrorString(
          name,
          seq,
          error.message,
          error.stack,
        );
      } else {
        expression = pageBindingDeliverErrorValueString(name, seq, error);
      }
    }
    __classPrivateFieldGet(this, _Page_client, "f")
      .send("Runtime.evaluate", {
        expression,
        contextId: event.executionContextId,
      })
      .catch(debugError);
  },
  _Page_addConsoleMessage = function _Page_addConsoleMessage(
    eventType,
    args,
    stackTrace,
  ) {
    if (!this.listenerCount("console" /* PageEmittedEvents.Console */)) {
      args.forEach((arg) => {
        return arg.dispose();
      });
      return;
    }
    const textTokens = [];
    for (const arg of args) {
      const remoteObject = arg.remoteObject();
      if (remoteObject.objectId) {
        textTokens.push(arg.toString());
      } else {
        textTokens.push(valueFromRemoteObject(remoteObject));
      }
    }
    const stackTraceLocations = [];
    if (stackTrace) {
      for (const callFrame of stackTrace.callFrames) {
        stackTraceLocations.push({
          url: callFrame.url,
          lineNumber: callFrame.lineNumber,
          columnNumber: callFrame.columnNumber,
        });
      }
    }
    const message = new ConsoleMessage(
      eventType,
      textTokens.join(" "),
      args,
      stackTraceLocations,
    );
    this.emit("console", /* PageEmittedEvents.Console */ message);
  },
  _Page_onDialog = function _Page_onDialog(event) {
    let dialogType = null;
    const validDialogTypes = new Set([
      "alert",
      "confirm",
      "prompt",
      "beforeunload",
    ]);
    if (validDialogTypes.has(event.type)) {
      dialogType = event.type;
    }
    assert(dialogType, "Unknown javascript dialog type: " + event.type);
    const dialog = new Dialog(
      __classPrivateFieldGet(this, _Page_client, "f"),
      dialogType,
      event.message,
      event.defaultPrompt,
    );
    this.emit("dialog", /* PageEmittedEvents.Dialog */ dialog);
  },
  _Page_resetDefaultBackgroundColor =
    /**
     * Resets default white background
     */
    async function _Page_resetDefaultBackgroundColor() {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setDefaultBackgroundColorOverride",
      );
    },
  _Page_setTransparentBackgroundColor =
    /**
     * Hides default white background
     */
    async function _Page_setTransparentBackgroundColor() {
      await __classPrivateFieldGet(this, _Page_client, "f").send(
        "Emulation.setDefaultBackgroundColorOverride",
        {
          color: { r: 0, g: 0, b: 0, a: 0 },
        },
      );
    },
  _Page_sessionClosePromise = function _Page_sessionClosePromise() {
    if (!__classPrivateFieldGet(this, _Page_disconnectPromise, "f")) {
      __classPrivateFieldSet(
        this,
        _Page_disconnectPromise,
        new Promise((fulfill) => {
          return __classPrivateFieldGet(this, _Page_client, "f").once(
            CDPSessionEmittedEvents.Disconnected,
            () => {
              return fulfill(new Error("Target closed"));
            },
          );
        }),
        "f",
      );
    }
    return __classPrivateFieldGet(this, _Page_disconnectPromise, "f");
  },
  _Page_go = async function _Page_go(delta, options) {
    const history = await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Page.getNavigationHistory",
    );
    const entry = history.entries[history.currentIndex + delta];
    if (!entry) {
      return null;
    }
    const result = await Promise.all([
      this.waitForNavigation(options),
      __classPrivateFieldGet(this, _Page_client, "f").send(
        "Page.navigateToHistoryEntry",
        { entryId: entry.id },
      ),
    ]);
    return result[0];
  },
  _Page_screenshotTask = async function _Page_screenshotTask(
    format,
    options = {},
  ) {
    await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Target.activateTarget",
      {
        targetId: __classPrivateFieldGet(this, _Page_target, "f")._targetId,
      },
    );
    let clip = options.clip ? processClip(options.clip) : undefined;
    const captureBeyondViewport =
      typeof options.captureBeyondViewport === "boolean"
        ? options.captureBeyondViewport
        : true;
    const fromSurface = typeof options.fromSurface === "boolean"
      ? options.fromSurface
      : undefined;
    if (options.fullPage) {
      const metrics = await __classPrivateFieldGet(this, _Page_client, "f")
        .send("Page.getLayoutMetrics");
      // Fallback to `contentSize` in case of using Firefox.
      const { width, height } = metrics.cssContentSize || metrics.contentSize;
      // Overwrite clip for full page.
      clip = { x: 0, y: 0, width, height, scale: 1 };
      if (!captureBeyondViewport) {
        const { isMobile = false, deviceScaleFactor = 1, isLandscape = false } =
          __classPrivateFieldGet(this, _Page_viewport, "f") || {};
        const screenOrientation = isLandscape
          ? { angle: 90, type: "landscapePrimary" }
          : { angle: 0, type: "portraitPrimary" };
        await __classPrivateFieldGet(this, _Page_client, "f").send(
          "Emulation.setDeviceMetricsOverride",
          {
            mobile: isMobile,
            width,
            height,
            deviceScaleFactor,
            screenOrientation,
          },
        );
      }
    }
    const shouldSetDefaultBackground = options.omitBackground &&
      (format === "png" || format === "webp");
    if (shouldSetDefaultBackground) {
      await __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_setTransparentBackgroundColor,
      ).call(this);
    }
    const result = await __classPrivateFieldGet(this, _Page_client, "f").send(
      "Page.captureScreenshot",
      {
        format,
        quality: options.quality,
        clip,
        captureBeyondViewport,
        fromSurface,
      },
    );
    if (shouldSetDefaultBackground) {
      await __classPrivateFieldGet(
        this,
        _Page_instances,
        "m",
        _Page_resetDefaultBackgroundColor,
      ).call(this);
    }
    if (options.fullPage && __classPrivateFieldGet(this, _Page_viewport, "f")) {
      await this.setViewport(__classPrivateFieldGet(this, _Page_viewport, "f"));
    }
    const data = options.encoding === "base64"
      ? result.data
      : base64Decode(result.data);
    if (options.path) {
      await Deno.writeFile(options.path, base64Decode(result.data));
    }
    return data;
    function processClip(clip) {
      const x = Math.round(clip.x);
      const y = Math.round(clip.y);
      const width = Math.round(clip.width + clip.x - x);
      const height = Math.round(clip.height + clip.y - y);
      return { x, y, width, height, scale: 1 };
    }
  };
const supportedMetrics = new Set([
  "Timestamp",
  "Documents",
  "Frames",
  "JSEventListeners",
  "Nodes",
  "LayoutCount",
  "RecalcStyleCount",
  "LayoutDuration",
  "RecalcStyleDuration",
  "ScriptDuration",
  "TaskDuration",
  "JSHeapUsedSize",
  "JSHeapTotalSize",
]);
const unitToPixels = {
  px: 1,
  in: 96,
  cm: 37.8,
  mm: 3.78,
};
function convertPrintParameterToInches(parameter) {
  if (typeof parameter === "undefined") {
    return undefined;
  }
  let pixels;
  if (isNumber(parameter)) {
    // Treat numbers as pixel values to be aligned with phantom's paperSize.
    pixels = parameter;
  } else if (isString(parameter)) {
    const text = parameter;
    let unit = text.substring(text.length - 2).toLowerCase();
    let valueText = "";
    if (unit in unitToPixels) {
      valueText = text.substring(0, text.length - 2);
    } else {
      // In case of unknown unit try to parse the whole parameter as number of pixels.
      // This is consistent with phantom's paperSize behavior.
      unit = "px";
      valueText = text;
    }
    const value = Number(valueText);
    assert(!isNaN(value), "Failed to parse parameter value: " + text);
    pixels = value * unitToPixels[unit];
  } else {
    throw new Error(
      "page.pdf() Cannot handle parameter type: " + typeof parameter,
    );
  }
  return pixels / 96;
}
//# sourceMappingURL=Page.js.map
