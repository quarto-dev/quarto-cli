/// <reference types="./Frame.d.ts" />
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
var _Frame_parentFrame, _Frame_url, _Frame_detached, _Frame_client;
import { isErrorLike } from "../util/ErrorLike.js";
import { IsolatedWorld, MAIN_WORLD, PUPPETEER_WORLD } from "./IsolatedWorld.js";
import { LifecycleWatcher } from "./LifecycleWatcher.js";
/**
 * Represents a DOM frame.
 *
 * To understand frames, you can think of frames as `<iframe>` elements. Just
 * like iframes, frames can be nested, and when JavaScript is executed in a
 * frame, the JavaScript does not effect frames inside the ambient frame the
 * JavaScript executes in.
 *
 * @example
 * At any point in time, {@link Page | pages} expose their current frame
 * tree via the {@link Page.mainFrame} and {@link Frame.childFrames} methods.
 *
 * @example
 * An example of dumping frame tree:
 *
 * ```ts
 * const puppeteer = require('puppeteer');
 *
 * (async () => {
 *   const browser = await puppeteer.launch();
 *   const page = await browser.newPage();
 *   await page.goto('https://www.google.com/chrome/browser/canary.html');
 *   dumpFrameTree(page.mainFrame(), '');
 *   await browser.close();
 *
 *   function dumpFrameTree(frame, indent) {
 *     console.log(indent + frame.url());
 *     for (const child of frame.childFrames()) {
 *       dumpFrameTree(child, indent + '  ');
 *     }
 *   }
 * })();
 * ```
 *
 * @example
 * An example of getting text from an iframe element:
 *
 * ```ts
 * const frame = page.frames().find(frame => frame.name() === 'myframe');
 * const text = await frame.$eval('.selector', element => element.textContent);
 * console.log(text);
 * ```
 *
 * @remarks
 * Frame lifecycles are controlled by three events that are all dispatched on
 * the parent {@link Frame.page | page}:
 *
 * - {@link PageEmittedEvents.FrameAttached}
 * - {@link PageEmittedEvents.FrameNavigated}
 * - {@link PageEmittedEvents.FrameDetached}
 *
 * @public
 */
export class Frame {
  /**
   * @internal
   */
  constructor(frameManager, parentFrame, frameId, client) {
    _Frame_parentFrame.set(this, void 0);
    _Frame_url.set(this, "");
    _Frame_detached.set(this, false);
    _Frame_client.set(this, void 0);
    /**
     * @internal
     */
    this._loaderId = "";
    /**
     * @internal
     */
    this._hasStartedLoading = false;
    /**
     * @internal
     */
    this._lifecycleEvents = new Set();
    this._frameManager = frameManager;
    __classPrivateFieldSet(
      this,
      _Frame_parentFrame,
      parentFrame !== null && parentFrame !== void 0 ? parentFrame : null,
      "f",
    );
    __classPrivateFieldSet(this, _Frame_url, "", "f");
    this._id = frameId;
    __classPrivateFieldSet(this, _Frame_detached, false, "f");
    this._loaderId = "";
    this._childFrames = new Set();
    if (__classPrivateFieldGet(this, _Frame_parentFrame, "f")) {
      __classPrivateFieldGet(this, _Frame_parentFrame, "f")._childFrames.add(
        this,
      );
    }
    this.updateClient(client);
  }
  /**
   * @internal
   */
  updateClient(client) {
    __classPrivateFieldSet(this, _Frame_client, client, "f");
    this.worlds = {
      [MAIN_WORLD]: new IsolatedWorld(
        client,
        this._frameManager,
        this,
        this._frameManager.timeoutSettings,
      ),
      [PUPPETEER_WORLD]: new IsolatedWorld(
        client,
        this._frameManager,
        this,
        this._frameManager.timeoutSettings,
      ),
    };
  }
  /**
   * @returns The page associated with the frame.
   */
  page() {
    return this._frameManager.page();
  }
  /**
   * @returns `true` if the frame is an out-of-process (OOP) frame. Otherwise,
   * `false`.
   */
  isOOPFrame() {
    return __classPrivateFieldGet(this, _Frame_client, "f") !==
      this._frameManager.client;
  }
  /**
   * Navigates a frame to the given url.
   *
   * @remarks
   * Navigation to `about:blank` or navigation to the same URL with a different
   * hash will succeed and return `null`.
   *
   * :::warning
   *
   * Headless mode doesn't support navigation to a PDF document. See the {@link
   * https://bugs.chromium.org/p/chromium/issues/detail?id=761295 | upstream
   * issue}.
   *
   * :::
   *
   * @param url - the URL to navigate the frame to. This should include the
   * scheme, e.g. `https://`.
   * @param options - navigation options. `waitUntil` is useful to define when
   * the navigation should be considered successful - see the docs for
   * {@link PuppeteerLifeCycleEvent} for more details.
   *
   * @returns A promise which resolves to the main resource response. In case of
   * multiple redirects, the navigation will resolve with the response of the
   * last redirect.
   * @throws This method will throw an error if:
   *
   * - there's an SSL error (e.g. in case of self-signed certificates).
   * - target URL is invalid.
   * - the `timeout` is exceeded during navigation.
   * - the remote server does not respond or is unreachable.
   * - the main resource failed to load.
   *
   * This method will not throw an error when any valid HTTP status code is
   * returned by the remote server, including 404 "Not Found" and 500 "Internal
   * Server Error". The status code for such responses can be retrieved by
   * calling {@link HTTPResponse.status}.
   */
  async goto(url, options = {}) {
    const {
      referer = this._frameManager.networkManager.extraHTTPHeaders()["referer"],
      waitUntil = ["load"],
      timeout = this._frameManager.timeoutSettings.navigationTimeout(),
    } = options;
    let ensureNewDocumentNavigation = false;
    const watcher = new LifecycleWatcher(
      this._frameManager,
      this,
      waitUntil,
      timeout,
    );
    let error = await Promise.race([
      navigate(
        __classPrivateFieldGet(this, _Frame_client, "f"),
        url,
        referer,
        this._id,
      ),
      watcher.timeoutOrTerminationPromise(),
    ]);
    if (!error) {
      error = await Promise.race([
        watcher.timeoutOrTerminationPromise(),
        ensureNewDocumentNavigation
          ? watcher.newDocumentNavigationPromise()
          : watcher.sameDocumentNavigationPromise(),
      ]);
    }
    try {
      if (error) {
        throw error;
      }
      return await watcher.navigationResponse();
    } finally {
      watcher.dispose();
    }
    async function navigate(client, url, referrer, frameId) {
      try {
        const response = await client.send("Page.navigate", {
          url,
          referrer,
          frameId,
        });
        ensureNewDocumentNavigation = !!response.loaderId;
        return response.errorText
          ? new Error(`${response.errorText} at ${url}`)
          : null;
      } catch (error) {
        if (isErrorLike(error)) {
          return error;
        }
        throw error;
      }
    }
  }
  /**
   * Waits for the frame to navigate. It is useful for when you run code which
   * will indirectly cause the frame to navigate.
   *
   * Usage of the
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/History_API | History API}
   * to change the URL is considered a navigation.
   *
   * @example
   *
   * ```ts
   * const [response] = await Promise.all([
   *   // The navigation promise resolves after navigation has finished
   *   frame.waitForNavigation(),
   *   // Clicking the link will indirectly cause a navigation
   *   frame.click('a.my-link'),
   * ]);
   * ```
   *
   * @param options - options to configure when the navigation is consided
   * finished.
   * @returns a promise that resolves when the frame navigates to a new URL.
   */
  async waitForNavigation(options = {}) {
    const {
      waitUntil = ["load"],
      timeout = this._frameManager.timeoutSettings.navigationTimeout(),
    } = options;
    const watcher = new LifecycleWatcher(
      this._frameManager,
      this,
      waitUntil,
      timeout,
    );
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise(),
      watcher.sameDocumentNavigationPromise(),
      watcher.newDocumentNavigationPromise(),
    ]);
    try {
      if (error) {
        throw error;
      }
      return await watcher.navigationResponse();
    } finally {
      watcher.dispose();
    }
  }
  /**
   * @internal
   */
  _client() {
    return __classPrivateFieldGet(this, _Frame_client, "f");
  }
  /**
   * @deprecated Do not use the execution context directly.
   *
   * @returns a promise that resolves to the frame's default execution context.
   */
  executionContext() {
    return this.worlds[MAIN_WORLD].executionContext();
  }
  /**
   * Behaves identically to {@link Page.evaluateHandle} except it's run within
   * the context of this frame.
   *
   * @see {@link Page.evaluateHandle} for details.
   */
  async evaluateHandle(pageFunction, ...args) {
    return this.worlds[MAIN_WORLD].evaluateHandle(pageFunction, ...args);
  }
  /**
   * Behaves identically to {@link Page.evaluate} except it's run within the
   * the context of this frame.
   *
   * @see {@link Page.evaluate} for details.
   */
  async evaluate(pageFunction, ...args) {
    return this.worlds[MAIN_WORLD].evaluate(pageFunction, ...args);
  }
  /**
   * Queries the frame for an element matching the given selector.
   *
   * @param selector - The selector to query for.
   * @returns A {@link ElementHandle | element handle} to the first element
   * matching the given selector. Otherwise, `null`.
   */
  async $(selector) {
    return this.worlds[MAIN_WORLD].$(selector);
  }
  /**
   * Queries the frame for all elements matching the given selector.
   *
   * @param selector - The selector to query for.
   * @returns An array of {@link ElementHandle | element handles} that point to
   * elements matching the given selector.
   */
  async $$(selector) {
    return this.worlds[MAIN_WORLD].$$(selector);
  }
  /**
   * Runs the given function on the first element matching the given selector in
   * the frame.
   *
   * If the given function returns a promise, then this method will wait till
   * the promise resolves.
   *
   * @example
   *
   * ```ts
   * const searchValue = await frame.$eval('#search', el => el.value);
   * ```
   *
   * @param selector - The selector to query for.
   * @param pageFunction - The function to be evaluated in the frame's context.
   * The first element matching the selector will be passed to the function as
   * its first argument.
   * @param args - Additional arguments to pass to `pageFunction`.
   * @returns A promise to the result of the function.
   */
  async $eval(selector, pageFunction, ...args) {
    return this.worlds[MAIN_WORLD].$eval(selector, pageFunction, ...args);
  }
  /**
   * Runs the given function on an array of elements matching the given selector
   * in the frame.
   *
   * If the given function returns a promise, then this method will wait till
   * the promise resolves.
   *
   * @example
   *
   * ```js
   * const divsCounts = await frame.$$eval('div', divs => divs.length);
   * ```
   *
   * @param selector - The selector to query for.
   * @param pageFunction - The function to be evaluated in the frame's context.
   * An array of elements matching the given selector will be passed to the
   * function as its first argument.
   * @param args - Additional arguments to pass to `pageFunction`.
   * @returns A promise to the result of the function.
   */
  async $$eval(selector, pageFunction, ...args) {
    return this.worlds[MAIN_WORLD].$$eval(selector, pageFunction, ...args);
  }
  /**
   * @deprecated Use {@link Frame.$$} with the `xpath` prefix.
   *
   * This method evaluates the given XPath expression and returns the results.
   * @param expression - the XPath expression to evaluate.
   */
  async $x(expression) {
    return this.worlds[MAIN_WORLD].$x(expression);
  }
  /**
   * Waits for an element matching the given selector to appear in the frame.
   *
   * This method works across navigations.
   *
   * @example
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   *
   * (async () => {
   *   const browser = await puppeteer.launch();
   *   const page = await browser.newPage();
   *   let currentURL;
   *   page
   *     .mainFrame()
   *     .waitForSelector('img')
   *     .then(() => console.log('First URL with image: ' + currentURL));
   *
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
   * @param selector - The selector to query and wait for.
   * @param options - Options for customizing waiting behavior.
   * @returns An element matching the given selector.
   * @throws Throws if an element matching the given selector doesn't appear.
   */
  async waitForSelector(selector, options = {}) {
    const handle = await this.worlds[PUPPETEER_WORLD].waitForSelector(
      selector,
      options,
    );
    if (!handle) {
      return null;
    }
    const mainHandle = (await this.worlds[MAIN_WORLD].adoptHandle(handle));
    await handle.dispose();
    return mainHandle;
  }
  /**
   * @deprecated Use {@link Frame.waitForSelector} with the `xpath` prefix.
   *
   * Wait for the `xpath` to appear in page. If at the moment of calling the
   * method the `xpath` already exists, the method will return immediately. If
   * the xpath doesn't appear after the `timeout` milliseconds of waiting, the
   * function will throw.
   *
   * For a code example, see the example for {@link Frame.waitForSelector}. That
   * function behaves identically other than taking a CSS selector rather than
   * an XPath.
   *
   * @param xpath - the XPath expression to wait for.
   * @param options - options to configure the visiblity of the element and how
   * long to wait before timing out.
   */
  async waitForXPath(xpath, options = {}) {
    if (xpath.startsWith("//")) {
      xpath = `.${xpath}`;
    }
    return this.waitForSelector(`xpath/${xpath}`, options);
  }
  /**
   * @example
   * The `waitForFunction` can be used to observe viewport size change:
   *
   * ```ts
   * const puppeteer = require('puppeteer');
   *
   * (async () => {
   * .  const browser = await puppeteer.launch();
   * .  const page = await browser.newPage();
   * .  const watchDog = page.mainFrame().waitForFunction('window.innerWidth < 100');
   * .  page.setViewport({width: 50, height: 50});
   * .  await watchDog;
   * .  await browser.close();
   * })();
   * ```
   *
   * To pass arguments from Node.js to the predicate of `page.waitForFunction` function:
   *
   * ```ts
   * const selector = '.foo';
   * await frame.waitForFunction(
   *   selector => !!document.querySelector(selector),
   *   {}, // empty options object
   *   selector
   * );
   * ```
   *
   * @param pageFunction - the function to evaluate in the frame context.
   * @param options - options to configure the polling method and timeout.
   * @param args - arguments to pass to the `pageFunction`.
   * @returns the promise which resolve when the `pageFunction` returns a truthy value.
   */
  waitForFunction(pageFunction, options = {}, ...args) {
    // TODO: Fix when NodeHandle has been added.
    return this.worlds[MAIN_WORLD].waitForFunction(
      pageFunction,
      options,
      ...args,
    );
  }
  /**
   * @returns The full HTML contents of the frame, including the DOCTYPE.
   */
  async content() {
    return this.worlds[PUPPETEER_WORLD].content();
  }
  /**
   * Set the content of the frame.
   *
   * @param html - HTML markup to assign to the page.
   * @param options - Options to configure how long before timing out and at
   * what point to consider the content setting successful.
   */
  async setContent(html, options = {}) {
    return this.worlds[PUPPETEER_WORLD].setContent(html, options);
  }
  /**
   * @returns The frame's `name` attribute as specified in the tag.
   *
   * @remarks
   * If the name is empty, it returns the `id` attribute instead.
   *
   * @remarks
   * This value is calculated once when the frame is created, and will not
   * update if the attribute is changed later.
   */
  name() {
    return this._name || "";
  }
  /**
   * @returns The frame's URL.
   */
  url() {
    return __classPrivateFieldGet(this, _Frame_url, "f");
  }
  /**
   * @returns The parent frame, if any. Detached and main frames return `null`.
   */
  parentFrame() {
    return __classPrivateFieldGet(this, _Frame_parentFrame, "f");
  }
  /**
   * @returns An array of child frames.
   */
  childFrames() {
    return Array.from(this._childFrames);
  }
  /**
   * @returns `true` if the frame has been detached. Otherwise, `false`.
   */
  isDetached() {
    return __classPrivateFieldGet(this, _Frame_detached, "f");
  }
  /**
   * Adds a `<script>` tag into the page with the desired url or content.
   *
   * @param options - Options for the script.
   * @returns a promise that resolves to the added tag when the script's
   * `onload` event fires or when the script content was injected into the
   * frame.
   */
  async addScriptTag(options) {
    return this.worlds[MAIN_WORLD].addScriptTag(options);
  }
  /**
   * Adds a `<link rel="stylesheet">` tag into the page with the desired url or
   * a `<style type="text/css">` tag with the content.
   *
   * @param options - Options for the style link.
   * @returns a promise that resolves to the added tag when the stylesheets's
   * `onload` event fires or when the CSS content was injected into the
   * frame.
   */
  async addStyleTag(options) {
    return this.worlds[MAIN_WORLD].addStyleTag(options);
  }
  /**
   * Clicks the first element found that matches `selector`.
   *
   * @remarks
   * If `click()` triggers a navigation event and there's a separate
   * `page.waitForNavigation()` promise to be resolved, you may end up with a
   * race condition that yields unexpected results. The correct pattern for
   * click and wait for navigation is the following:
   *
   * ```ts
   * const [response] = await Promise.all([
   *   page.waitForNavigation(waitOptions),
   *   frame.click(selector, clickOptions),
   * ]);
   * ```
   *
   * @param selector - The selector to query for.
   */
  async click(selector, options = {}) {
    return this.worlds[PUPPETEER_WORLD].click(selector, options);
  }
  /**
   * Focuses the first element that matches the `selector`.
   *
   * @param selector - The selector to query for.
   * @throws Throws if there's no element matching `selector`.
   */
  async focus(selector) {
    return this.worlds[PUPPETEER_WORLD].focus(selector);
  }
  /**
   * Hovers the pointer over the center of the first element that matches the
   * `selector`.
   *
   * @param selector - The selector to query for.
   * @throws Throws if there's no element matching `selector`.
   */
  async hover(selector) {
    return this.worlds[PUPPETEER_WORLD].hover(selector);
  }
  /**
   * Selects a set of value on the first `<select>` element that matches the
   * `selector`.
   *
   * @example
   *
   * ```ts
   * frame.select('select#colors', 'blue'); // single selection
   * frame.select('select#colors', 'red', 'green', 'blue'); // multiple selections
   * ```
   *
   * @param selector - The selector to query for.
   * @param values - The array of values to select. If the `<select>` has the
   * `multiple` attribute, all values are considered, otherwise only the first
   * one is taken into account.
   * @returns the list of values that were successfully selected.
   * @throws Throws if there's no `<select>` matching `selector`.
   */
  select(selector, ...values) {
    return this.worlds[PUPPETEER_WORLD].select(selector, ...values);
  }
  /**
   * Taps the first element that matches the `selector`.
   *
   * @param selector - The selector to query for.
   * @throws Throws if there's no element matching `selector`.
   */
  async tap(selector) {
    return this.worlds[PUPPETEER_WORLD].tap(selector);
  }
  /**
   * Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character
   * in the text.
   *
   * @remarks
   * To press a special key, like `Control` or `ArrowDown`, use
   * {@link Keyboard.press}.
   *
   * @example
   *
   * ```ts
   * await frame.type('#mytextarea', 'Hello'); // Types instantly
   * await frame.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
   * ```
   *
   * @param selector - the selector for the element to type into. If there are
   * multiple the first will be used.
   * @param text - text to type into the element
   * @param options - takes one option, `delay`, which sets the time to wait
   * between key presses in milliseconds. Defaults to `0`.
   */
  async type(selector, text, options) {
    return this.worlds[PUPPETEER_WORLD].type(selector, text, options);
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
   * await frame.waitForTimeout(1000);
   * ```
   *
   * @param milliseconds - the number of milliseconds to wait.
   */
  waitForTimeout(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
  /**
   * @returns the frame's title.
   */
  async title() {
    return this.worlds[PUPPETEER_WORLD].title();
  }
  /**
   * @internal
   */
  _navigated(framePayload) {
    this._name = framePayload.name;
    __classPrivateFieldSet(
      this,
      _Frame_url,
      `${framePayload.url}${framePayload.urlFragment || ""}`,
      "f",
    );
  }
  /**
   * @internal
   */
  _navigatedWithinDocument(url) {
    __classPrivateFieldSet(this, _Frame_url, url, "f");
  }
  /**
   * @internal
   */
  _onLifecycleEvent(loaderId, name) {
    if (name === "init") {
      this._loaderId = loaderId;
      this._lifecycleEvents.clear();
    }
    this._lifecycleEvents.add(name);
  }
  /**
   * @internal
   */
  _onLoadingStopped() {
    this._lifecycleEvents.add("DOMContentLoaded");
    this._lifecycleEvents.add("load");
  }
  /**
   * @internal
   */
  _onLoadingStarted() {
    this._hasStartedLoading = true;
  }
  /**
   * @internal
   */
  _detach() {
    __classPrivateFieldSet(this, _Frame_detached, true, "f");
    this.worlds[MAIN_WORLD]._detach();
    this.worlds[PUPPETEER_WORLD]._detach();
    if (__classPrivateFieldGet(this, _Frame_parentFrame, "f")) {
      __classPrivateFieldGet(this, _Frame_parentFrame, "f")._childFrames.delete(
        this,
      );
    }
    __classPrivateFieldSet(this, _Frame_parentFrame, null, "f");
  }
}
_Frame_parentFrame = new WeakMap(),
  _Frame_url = new WeakMap(),
  _Frame_detached = new WeakMap(),
  _Frame_client = new WeakMap();
//# sourceMappingURL=Frame.js.map
