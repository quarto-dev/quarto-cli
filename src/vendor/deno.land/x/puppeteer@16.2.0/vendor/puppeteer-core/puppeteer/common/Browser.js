/// <reference types="./Browser.d.ts" />
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
var _Browser_instances,
  _Browser_ignoreHTTPSErrors,
  _Browser_defaultViewport,
  _Browser_process,
  _Browser_connection,
  _Browser_closeCallback,
  _Browser_targetFilterCallback,
  _Browser_isPageTargetCallback,
  _Browser_defaultContext,
  _Browser_contexts,
  _Browser_screenshotTaskQueue,
  _Browser_targetManager,
  _Browser_emitDisconnected,
  _Browser_setIsPageTargetCallback,
  _Browser_createTarget,
  _Browser_onAttachedToTarget,
  _Browser_onDetachedFromTarget,
  _Browser_onTargetChanged,
  _Browser_onTargetDiscovered,
  _Browser_getVersion,
  _BrowserContext_connection,
  _BrowserContext_browser,
  _BrowserContext_id;
import { assert } from "../util/assert.js";
import { ConnectionEmittedEvents } from "./Connection.js";
import { EventEmitter } from "./EventEmitter.js";
import { waitWithTimeout } from "./util.js";
import { Target } from "./Target.js";
import { TaskQueue } from "./TaskQueue.js";
import { ChromeTargetManager } from "./ChromeTargetManager.js";
import { FirefoxTargetManager } from "./FirefoxTargetManager.js";
const WEB_PERMISSION_TO_PROTOCOL_PERMISSION = new Map([
  ["geolocation", "geolocation"],
  ["midi", "midi"],
  ["notifications", "notifications"],
  // TODO: push isn't a valid type?
  // ['push', 'push'],
  ["camera", "videoCapture"],
  ["microphone", "audioCapture"],
  ["background-sync", "backgroundSync"],
  ["ambient-light-sensor", "sensors"],
  ["accelerometer", "sensors"],
  ["gyroscope", "sensors"],
  ["magnetometer", "sensors"],
  ["accessibility-events", "accessibilityEvents"],
  ["clipboard-read", "clipboardReadWrite"],
  ["clipboard-write", "clipboardReadWrite"],
  ["payment-handler", "paymentHandler"],
  ["persistent-storage", "durableStorage"],
  ["idle-detection", "idleDetection"],
  // chrome-specific permissions we have.
  ["midi-sysex", "midiSysex"],
]);
/**
 * A Browser is created when Puppeteer connects to a Chromium instance, either through
 * {@link PuppeteerNode.launch} or {@link Puppeteer.connect}.
 *
 * @remarks
 *
 * The Browser class extends from Puppeteer's {@link EventEmitter} class and will
 * emit various events which are documented in the {@link BrowserEmittedEvents} enum.
 *
 * @example
 * An example of using a {@link Browser} to create a {@link Page}:
 *
 * ```ts
 * const puppeteer = require('puppeteer');
 *
 * (async () => {
 *   const browser = await puppeteer.launch();
 *   const page = await browser.newPage();
 *   await page.goto('https://example.com');
 *   await browser.close();
 * })();
 * ```
 *
 * @example
 * An example of disconnecting from and reconnecting to a {@link Browser}:
 *
 * ```ts
 * const puppeteer = require('puppeteer');
 *
 * (async () => {
 *   const browser = await puppeteer.launch();
 *   // Store the endpoint to be able to reconnect to Chromium
 *   const browserWSEndpoint = browser.wsEndpoint();
 *   // Disconnect puppeteer from Chromium
 *   browser.disconnect();
 *
 *   // Use the endpoint to reestablish a connection
 *   const browser2 = await puppeteer.connect({browserWSEndpoint});
 *   // Close Chromium
 *   await browser2.close();
 * })();
 * ```
 *
 * @public
 */
export class Browser extends EventEmitter {
  /**
   * @internal
   */
  constructor(
    product,
    connection,
    contextIds,
    ignoreHTTPSErrors,
    defaultViewport,
    process,
    closeCallback,
    targetFilterCallback,
    isPageTargetCallback,
  ) {
    super();
    _Browser_instances.add(this);
    _Browser_ignoreHTTPSErrors.set(this, void 0);
    _Browser_defaultViewport.set(this, void 0);
    _Browser_process.set(this, void 0);
    _Browser_connection.set(this, void 0);
    _Browser_closeCallback.set(this, void 0);
    _Browser_targetFilterCallback.set(this, void 0);
    _Browser_isPageTargetCallback.set(this, void 0);
    _Browser_defaultContext.set(this, void 0);
    _Browser_contexts.set(this, void 0);
    _Browser_screenshotTaskQueue.set(this, void 0);
    _Browser_targetManager.set(this, void 0);
    _Browser_emitDisconnected.set(this, () => {
      this.emit("disconnected" /* BrowserEmittedEvents.Disconnected */);
    });
    _Browser_createTarget.set(this, (targetInfo, session) => {
      var _a;
      const { browserContextId } = targetInfo;
      const context = browserContextId &&
          __classPrivateFieldGet(this, _Browser_contexts, "f").has(
            browserContextId,
          )
        ? __classPrivateFieldGet(this, _Browser_contexts, "f").get(
          browserContextId,
        )
        : __classPrivateFieldGet(this, _Browser_defaultContext, "f");
      if (!context) {
        throw new Error("Missing browser context");
      }
      return new Target(
        targetInfo,
        session,
        context,
        __classPrivateFieldGet(this, _Browser_targetManager, "f"),
        (isAutoAttachEmulated) => {
          return __classPrivateFieldGet(this, _Browser_connection, "f")
            ._createSession(targetInfo, isAutoAttachEmulated);
        },
        __classPrivateFieldGet(this, _Browser_ignoreHTTPSErrors, "f"),
        (_a = __classPrivateFieldGet(this, _Browser_defaultViewport, "f")) !==
            null && _a !== void 0
          ? _a
          : null,
        __classPrivateFieldGet(this, _Browser_screenshotTaskQueue, "f"),
        __classPrivateFieldGet(this, _Browser_isPageTargetCallback, "f"),
      );
    });
    _Browser_onAttachedToTarget.set(this, async (target) => {
      if (await target._initializedPromise) {
        this.emit(
          "targetcreated", /* BrowserEmittedEvents.TargetCreated */
          target,
        );
        target
          .browserContext()
          .emit(
            "targetcreated", /* BrowserContextEmittedEvents.TargetCreated */
            target,
          );
      }
    });
    _Browser_onDetachedFromTarget.set(this, async (target) => {
      target._initializedCallback(false);
      target._closedCallback();
      if (await target._initializedPromise) {
        this.emit(
          "targetdestroyed", /* BrowserEmittedEvents.TargetDestroyed */
          target,
        );
        target
          .browserContext()
          .emit(
            "targetdestroyed", /* BrowserContextEmittedEvents.TargetDestroyed */
            target,
          );
      }
    });
    _Browser_onTargetChanged.set(this, ({ target, targetInfo }) => {
      const previousURL = target.url();
      const wasInitialized = target._isInitialized;
      target._targetInfoChanged(targetInfo);
      if (wasInitialized && previousURL !== target.url()) {
        this.emit(
          "targetchanged", /* BrowserEmittedEvents.TargetChanged */
          target,
        );
        target
          .browserContext()
          .emit(
            "targetchanged", /* BrowserContextEmittedEvents.TargetChanged */
            target,
          );
      }
    });
    _Browser_onTargetDiscovered.set(this, (targetInfo) => {
      this.emit("targetdiscovered", targetInfo);
    });
    product = product || "chrome";
    __classPrivateFieldSet(
      this,
      _Browser_ignoreHTTPSErrors,
      ignoreHTTPSErrors,
      "f",
    );
    __classPrivateFieldSet(
      this,
      _Browser_defaultViewport,
      defaultViewport,
      "f",
    );
    __classPrivateFieldSet(this, _Browser_process, process, "f");
    __classPrivateFieldSet(
      this,
      _Browser_screenshotTaskQueue,
      new TaskQueue(),
      "f",
    );
    __classPrivateFieldSet(this, _Browser_connection, connection, "f");
    __classPrivateFieldSet(
      this,
      _Browser_closeCallback,
      closeCallback || function () {},
      "f",
    );
    __classPrivateFieldSet(
      this,
      _Browser_targetFilterCallback,
      targetFilterCallback ||
        (() => {
          return true;
        }),
      "f",
    );
    __classPrivateFieldGet(
      this,
      _Browser_instances,
      "m",
      _Browser_setIsPageTargetCallback,
    ).call(this, isPageTargetCallback);
    if (product === "firefox") {
      __classPrivateFieldSet(
        this,
        _Browser_targetManager,
        new FirefoxTargetManager(
          connection,
          __classPrivateFieldGet(this, _Browser_createTarget, "f"),
          __classPrivateFieldGet(this, _Browser_targetFilterCallback, "f"),
        ),
        "f",
      );
    } else {
      __classPrivateFieldSet(
        this,
        _Browser_targetManager,
        new ChromeTargetManager(
          connection,
          __classPrivateFieldGet(this, _Browser_createTarget, "f"),
          __classPrivateFieldGet(this, _Browser_targetFilterCallback, "f"),
        ),
        "f",
      );
    }
    __classPrivateFieldSet(
      this,
      _Browser_defaultContext,
      new BrowserContext(
        __classPrivateFieldGet(this, _Browser_connection, "f"),
        this,
      ),
      "f",
    );
    __classPrivateFieldSet(this, _Browser_contexts, new Map(), "f");
    for (const contextId of contextIds) {
      __classPrivateFieldGet(this, _Browser_contexts, "f").set(
        contextId,
        new BrowserContext(
          __classPrivateFieldGet(this, _Browser_connection, "f"),
          this,
          contextId,
        ),
      );
    }
  }
  /**
   * @internal
   */
  static async _create(
    product,
    connection,
    contextIds,
    ignoreHTTPSErrors,
    defaultViewport,
    process,
    closeCallback,
    targetFilterCallback,
    isPageTargetCallback,
  ) {
    const browser = new Browser(
      product,
      connection,
      contextIds,
      ignoreHTTPSErrors,
      defaultViewport,
      process,
      closeCallback,
      targetFilterCallback,
      isPageTargetCallback,
    );
    await browser._attach();
    return browser;
  }
  /**
   * @internal
   */
  get _targets() {
    return __classPrivateFieldGet(this, _Browser_targetManager, "f")
      .getAvailableTargets();
  }
  /**
   * @internal
   */
  async _attach() {
    __classPrivateFieldGet(this, _Browser_connection, "f").on(
      ConnectionEmittedEvents.Disconnected,
      __classPrivateFieldGet(this, _Browser_emitDisconnected, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").on(
      "targetAvailable", /* TargetManagerEmittedEvents.TargetAvailable */
      __classPrivateFieldGet(this, _Browser_onAttachedToTarget, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").on(
      "targetGone", /* TargetManagerEmittedEvents.TargetGone */
      __classPrivateFieldGet(this, _Browser_onDetachedFromTarget, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").on(
      "targetChanged", /* TargetManagerEmittedEvents.TargetChanged */
      __classPrivateFieldGet(this, _Browser_onTargetChanged, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").on(
      "targetDiscovered", /* TargetManagerEmittedEvents.TargetDiscovered */
      __classPrivateFieldGet(this, _Browser_onTargetDiscovered, "f"),
    );
    await __classPrivateFieldGet(this, _Browser_targetManager, "f")
      .initialize();
  }
  /**
   * @internal
   */
  _detach() {
    __classPrivateFieldGet(this, _Browser_connection, "f").off(
      ConnectionEmittedEvents.Disconnected,
      __classPrivateFieldGet(this, _Browser_emitDisconnected, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").off(
      "targetAvailable", /* TargetManagerEmittedEvents.TargetAvailable */
      __classPrivateFieldGet(this, _Browser_onAttachedToTarget, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").off(
      "targetGone", /* TargetManagerEmittedEvents.TargetGone */
      __classPrivateFieldGet(this, _Browser_onDetachedFromTarget, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").off(
      "targetChanged", /* TargetManagerEmittedEvents.TargetChanged */
      __classPrivateFieldGet(this, _Browser_onTargetChanged, "f"),
    );
    __classPrivateFieldGet(this, _Browser_targetManager, "f").off(
      "targetDiscovered", /* TargetManagerEmittedEvents.TargetDiscovered */
      __classPrivateFieldGet(this, _Browser_onTargetDiscovered, "f"),
    );
  }
  /**
   * The spawned browser process. Returns `null` if the browser instance was created with
   * {@link Puppeteer.connect}.
   */
  process() {
    var _a;
    return (_a = __classPrivateFieldGet(this, _Browser_process, "f")) !==
          null && _a !== void 0
      ? _a
      : null;
  }
  /**
   * @internal
   */
  _targetManager() {
    return __classPrivateFieldGet(this, _Browser_targetManager, "f");
  }
  /**
   * @internal
   */
  _getIsPageTargetCallback() {
    return __classPrivateFieldGet(this, _Browser_isPageTargetCallback, "f");
  }
  /**
   * Creates a new incognito browser context. This won't share cookies/cache with other
   * browser contexts.
   *
   * @example
   *
   * ```ts
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   // Create a new incognito browser context.
   *   const context = await browser.createIncognitoBrowserContext();
   *   // Create a new page in a pristine context.
   *   const page = await context.newPage();
   *   // Do stuff
   *   await page.goto('https://example.com');
   * })();
   * ```
   */
  async createIncognitoBrowserContext(options = {}) {
    const { proxyServer, proxyBypassList } = options;
    const { browserContextId } = await __classPrivateFieldGet(
      this,
      _Browser_connection,
      "f",
    ).send("Target.createBrowserContext", {
      proxyServer,
      proxyBypassList: proxyBypassList && proxyBypassList.join(","),
    });
    const context = new BrowserContext(
      __classPrivateFieldGet(this, _Browser_connection, "f"),
      this,
      browserContextId,
    );
    __classPrivateFieldGet(this, _Browser_contexts, "f").set(
      browserContextId,
      context,
    );
    return context;
  }
  /**
   * Returns an array of all open browser contexts. In a newly created browser, this will
   * return a single instance of {@link BrowserContext}.
   */
  browserContexts() {
    return [
      __classPrivateFieldGet(this, _Browser_defaultContext, "f"),
      ...Array.from(
        __classPrivateFieldGet(this, _Browser_contexts, "f").values(),
      ),
    ];
  }
  /**
   * Returns the default browser context. The default browser context cannot be closed.
   */
  defaultBrowserContext() {
    return __classPrivateFieldGet(this, _Browser_defaultContext, "f");
  }
  /**
   * @internal
   */
  async _disposeContext(contextId) {
    if (!contextId) {
      return;
    }
    await __classPrivateFieldGet(this, _Browser_connection, "f").send(
      "Target.disposeBrowserContext",
      {
        browserContextId: contextId,
      },
    );
    __classPrivateFieldGet(this, _Browser_contexts, "f").delete(contextId);
  }
  /**
   * The browser websocket endpoint which can be used as an argument to
   * {@link Puppeteer.connect}.
   *
   * @returns The Browser websocket url.
   *
   * @remarks
   *
   * The format is `ws://${host}:${port}/devtools/browser/<id>`.
   *
   * You can find the `webSocketDebuggerUrl` from `http://${host}:${port}/json/version`.
   * Learn more about the
   * {@link https://chromedevtools.github.io/devtools-protocol | devtools protocol} and
   * the {@link
   * https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
   * | browser endpoint}.
   */
  wsEndpoint() {
    return __classPrivateFieldGet(this, _Browser_connection, "f").url();
  }
  /**
   * Promise which resolves to a new {@link Page} object. The Page is created in
   * a default browser context.
   */
  async newPage() {
    return __classPrivateFieldGet(this, _Browser_defaultContext, "f").newPage();
  }
  /**
   * @internal
   */
  async _createPageInContext(contextId) {
    const { targetId } = await __classPrivateFieldGet(
      this,
      _Browser_connection,
      "f",
    ).send("Target.createTarget", {
      url: "about:blank",
      browserContextId: contextId || undefined,
    });
    const target = __classPrivateFieldGet(this, _Browser_targetManager, "f")
      .getAvailableTargets().get(targetId);
    if (!target) {
      throw new Error(`Missing target for page (id = ${targetId})`);
    }
    const initialized = await target._initializedPromise;
    if (!initialized) {
      throw new Error(`Failed to create target for page (id = ${targetId})`);
    }
    const page = await target.page();
    if (!page) {
      throw new Error(
        `Failed to create a page for context (id = ${contextId})`,
      );
    }
    return page;
  }
  /**
   * All active targets inside the Browser. In case of multiple browser contexts, returns
   * an array with all the targets in all browser contexts.
   */
  targets() {
    return Array.from(
      __classPrivateFieldGet(this, _Browser_targetManager, "f")
        .getAvailableTargets().values(),
    ).filter((target) => {
      return target._isInitialized;
    });
  }
  /**
   * The target associated with the browser.
   */
  target() {
    const browserTarget = this.targets().find((target) => {
      return target.type() === "browser";
    });
    if (!browserTarget) {
      throw new Error("Browser target is not found");
    }
    return browserTarget;
  }
  /**
   * Searches for a target in all browser contexts.
   *
   * @param predicate - A function to be run for every target.
   * @returns The first target found that matches the `predicate` function.
   *
   * @example
   *
   * An example of finding a target for a page opened via `window.open`:
   *
   * ```ts
   * await page.evaluate(() => window.open('https://www.example.com/'));
   * const newWindowTarget = await browser.waitForTarget(
   *   target => target.url() === 'https://www.example.com/'
   * );
   * ```
   */
  async waitForTarget(predicate, options = {}) {
    const { timeout = 30000 } = options;
    let resolve;
    let isResolved = false;
    const targetPromise = new Promise((x) => {
      return (resolve = x);
    });
    this.on("targetcreated", /* BrowserEmittedEvents.TargetCreated */ check);
    this.on("targetchanged", /* BrowserEmittedEvents.TargetChanged */ check);
    try {
      this.targets().forEach(check);
      if (!timeout) {
        return await targetPromise;
      }
      return await waitWithTimeout(targetPromise, "target", timeout);
    } finally {
      this.off("targetcreated", /* BrowserEmittedEvents.TargetCreated */ check);
      this.off("targetchanged", /* BrowserEmittedEvents.TargetChanged */ check);
    }
    async function check(target) {
      if ((await predicate(target)) && !isResolved) {
        isResolved = true;
        resolve(target);
      }
    }
  }
  /**
   * An array of all open pages inside the Browser.
   *
   * @remarks
   *
   * In case of multiple browser contexts, returns an array with all the pages in all
   * browser contexts. Non-visible pages, such as `"background_page"`, will not be listed
   * here. You can find them using {@link Target.page}.
   */
  async pages() {
    const contextPages = await Promise.all(
      this.browserContexts().map((context) => {
        return context.pages();
      }),
    );
    // Flatten array.
    return contextPages.reduce((acc, x) => {
      return acc.concat(x);
    }, []);
  }
  /**
   * A string representing the browser name and version.
   *
   * @remarks
   *
   * For headless Chromium, this is similar to `HeadlessChrome/61.0.3153.0`. For
   * non-headless, this is similar to `Chrome/61.0.3153.0`.
   *
   * The format of browser.version() might change with future releases of Chromium.
   */
  async version() {
    const version = await __classPrivateFieldGet(
      this,
      _Browser_instances,
      "m",
      _Browser_getVersion,
    ).call(this);
    return version.product;
  }
  /**
   * The browser's original user agent. Pages can override the browser user agent with
   * {@link Page.setUserAgent}.
   */
  async userAgent() {
    const version = await __classPrivateFieldGet(
      this,
      _Browser_instances,
      "m",
      _Browser_getVersion,
    ).call(this);
    return version.userAgent;
  }
  /**
   * Closes Chromium and all of its pages (if any were opened). The {@link Browser} object
   * itself is considered to be disposed and cannot be used anymore.
   */
  async close() {
    await __classPrivateFieldGet(this, _Browser_closeCallback, "f").call(null);
    this.disconnect();
  }
  /**
   * Disconnects Puppeteer from the browser, but leaves the Chromium process running.
   * After calling `disconnect`, the {@link Browser} object is considered disposed and
   * cannot be used anymore.
   */
  disconnect() {
    __classPrivateFieldGet(this, _Browser_targetManager, "f").dispose();
    __classPrivateFieldGet(this, _Browser_connection, "f").dispose();
  }
  /**
   * Indicates that the browser is connected.
   */
  isConnected() {
    return !__classPrivateFieldGet(this, _Browser_connection, "f")._closed;
  }
}
_Browser_ignoreHTTPSErrors = new WeakMap(),
  _Browser_defaultViewport = new WeakMap(),
  _Browser_process = new WeakMap(),
  _Browser_connection = new WeakMap(),
  _Browser_closeCallback = new WeakMap(),
  _Browser_targetFilterCallback = new WeakMap(),
  _Browser_isPageTargetCallback = new WeakMap(),
  _Browser_defaultContext = new WeakMap(),
  _Browser_contexts = new WeakMap(),
  _Browser_screenshotTaskQueue = new WeakMap(),
  _Browser_targetManager = new WeakMap(),
  _Browser_emitDisconnected = new WeakMap(),
  _Browser_createTarget = new WeakMap(),
  _Browser_onAttachedToTarget = new WeakMap(),
  _Browser_onDetachedFromTarget = new WeakMap(),
  _Browser_onTargetChanged = new WeakMap(),
  _Browser_onTargetDiscovered = new WeakMap(),
  _Browser_instances = new WeakSet(),
  _Browser_setIsPageTargetCallback = function _Browser_setIsPageTargetCallback(
    isPageTargetCallback,
  ) {
    __classPrivateFieldSet(
      this,
      _Browser_isPageTargetCallback,
      isPageTargetCallback ||
        ((target) => {
          return (target.type === "page" ||
            target.type === "background_page" ||
            target.type === "webview");
        }),
      "f",
    );
  },
  _Browser_getVersion = function _Browser_getVersion() {
    return __classPrivateFieldGet(this, _Browser_connection, "f").send(
      "Browser.getVersion",
    );
  };
/**
 * BrowserContexts provide a way to operate multiple independent browser
 * sessions. When a browser is launched, it has a single BrowserContext used by
 * default. The method {@link Browser.newPage | Browser.newPage} creates a page
 * in the default browser context.
 *
 * @remarks
 *
 * The Browser class extends from Puppeteer's {@link EventEmitter} class and
 * will emit various events which are documented in the
 * {@link BrowserContextEmittedEvents} enum.
 *
 * If a page opens another page, e.g. with a `window.open` call, the popup will
 * belong to the parent page's browser context.
 *
 * Puppeteer allows creation of "incognito" browser contexts with
 * {@link Browser.createIncognitoBrowserContext | Browser.createIncognitoBrowserContext}
 * method. "Incognito" browser contexts don't write any browsing data to disk.
 *
 * @example
 *
 * ```ts
 * // Create a new incognito browser context
 * const context = await browser.createIncognitoBrowserContext();
 * // Create a new page inside context.
 * const page = await context.newPage();
 * // ... do stuff with page ...
 * await page.goto('https://example.com');
 * // Dispose context once it's no longer needed.
 * await context.close();
 * ```
 *
 * @public
 */
export class BrowserContext extends EventEmitter {
  /**
   * @internal
   */
  constructor(connection, browser, contextId) {
    super();
    _BrowserContext_connection.set(this, void 0);
    _BrowserContext_browser.set(this, void 0);
    _BrowserContext_id.set(this, void 0);
    __classPrivateFieldSet(this, _BrowserContext_connection, connection, "f");
    __classPrivateFieldSet(this, _BrowserContext_browser, browser, "f");
    __classPrivateFieldSet(this, _BrowserContext_id, contextId, "f");
  }
  /**
   * An array of all active targets inside the browser context.
   */
  targets() {
    return __classPrivateFieldGet(this, _BrowserContext_browser, "f").targets()
      .filter((target) => {
        return target.browserContext() === this;
      });
  }
  /**
   * This searches for a target in this specific browser context.
   *
   * @example
   * An example of finding a target for a page opened via `window.open`:
   *
   * ```ts
   * await page.evaluate(() => window.open('https://www.example.com/'));
   * const newWindowTarget = await browserContext.waitForTarget(
   *   target => target.url() === 'https://www.example.com/'
   * );
   * ```
   *
   * @param predicate - A function to be run for every target
   * @param options - An object of options. Accepts a timout,
   * which is the maximum wait time in milliseconds.
   * Pass `0` to disable the timeout. Defaults to 30 seconds.
   * @returns Promise which resolves to the first target found
   * that matches the `predicate` function.
   */
  waitForTarget(predicate, options = {}) {
    return __classPrivateFieldGet(this, _BrowserContext_browser, "f")
      .waitForTarget((target) => {
        return target.browserContext() === this && predicate(target);
      }, options);
  }
  /**
   * An array of all pages inside the browser context.
   *
   * @returns Promise which resolves to an array of all open pages.
   * Non visible pages, such as `"background_page"`, will not be listed here.
   * You can find them using {@link Target.page | the target page}.
   */
  async pages() {
    const pages = await Promise.all(
      this.targets()
        .filter((target) => {
          var _a;
          return (target.type() === "page" ||
            (target.type() === "other" &&
              ((_a = __classPrivateFieldGet(this, _BrowserContext_browser, "f")
                      ._getIsPageTargetCallback()) === null || _a === void 0
                ? void 0
                : _a(target._getTargetInfo()))));
        })
        .map((target) => {
          return target.page();
        }),
    );
    return pages.filter((page) => {
      return !!page;
    });
  }
  /**
   * Returns whether BrowserContext is incognito.
   * The default browser context is the only non-incognito browser context.
   *
   * @remarks
   * The default browser context cannot be closed.
   */
  isIncognito() {
    return !!__classPrivateFieldGet(this, _BrowserContext_id, "f");
  }
  /**
   * @example
   *
   * ```ts
   * const context = browser.defaultBrowserContext();
   * await context.overridePermissions('https://html5demos.com', [
   *   'geolocation',
   * ]);
   * ```
   *
   * @param origin - The origin to grant permissions to, e.g. "https://example.com".
   * @param permissions - An array of permissions to grant.
   * All permissions that are not listed here will be automatically denied.
   */
  async overridePermissions(origin, permissions) {
    const protocolPermissions = permissions.map((permission) => {
      const protocolPermission = WEB_PERMISSION_TO_PROTOCOL_PERMISSION.get(
        permission,
      );
      if (!protocolPermission) {
        throw new Error("Unknown permission: " + permission);
      }
      return protocolPermission;
    });
    await __classPrivateFieldGet(this, _BrowserContext_connection, "f").send(
      "Browser.grantPermissions",
      {
        origin,
        browserContextId:
          __classPrivateFieldGet(this, _BrowserContext_id, "f") || undefined,
        permissions: protocolPermissions,
      },
    );
  }
  /**
   * Clears all permission overrides for the browser context.
   *
   * @example
   *
   * ```ts
   * const context = browser.defaultBrowserContext();
   * context.overridePermissions('https://example.com', ['clipboard-read']);
   * // do stuff ..
   * context.clearPermissionOverrides();
   * ```
   */
  async clearPermissionOverrides() {
    await __classPrivateFieldGet(this, _BrowserContext_connection, "f").send(
      "Browser.resetPermissions",
      {
        browserContextId:
          __classPrivateFieldGet(this, _BrowserContext_id, "f") || undefined,
      },
    );
  }
  /**
   * Creates a new page in the browser context.
   */
  newPage() {
    return __classPrivateFieldGet(this, _BrowserContext_browser, "f")
      ._createPageInContext(
        __classPrivateFieldGet(this, _BrowserContext_id, "f"),
      );
  }
  /**
   * The browser this browser context belongs to.
   */
  browser() {
    return __classPrivateFieldGet(this, _BrowserContext_browser, "f");
  }
  /**
   * Closes the browser context. All the targets that belong to the browser context
   * will be closed.
   *
   * @remarks
   * Only incognito browser contexts can be closed.
   */
  async close() {
    assert(
      __classPrivateFieldGet(this, _BrowserContext_id, "f"),
      "Non-incognito profiles cannot be closed!",
    );
    await __classPrivateFieldGet(this, _BrowserContext_browser, "f")
      ._disposeContext(__classPrivateFieldGet(this, _BrowserContext_id, "f"));
  }
}
_BrowserContext_connection = new WeakMap(),
  _BrowserContext_browser = new WeakMap(),
  _BrowserContext_id = new WeakMap();
//# sourceMappingURL=Browser.js.map
