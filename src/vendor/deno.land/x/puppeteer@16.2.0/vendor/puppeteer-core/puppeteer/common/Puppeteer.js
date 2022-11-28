/// <reference types="./Puppeteer.d.ts" />
import { _connectToBrowser } from "./BrowserConnector.js";
import { devices } from "./DeviceDescriptors.js";
import { errors } from "./Errors.js";
import { networkConditions } from "./NetworkConditions.js";
import {
  clearCustomQueryHandlers,
  customQueryHandlerNames,
  registerCustomQueryHandler,
  unregisterCustomQueryHandler,
} from "./QueryHandler.js";
/**
 * The main Puppeteer class.
 *
 * IMPORTANT: if you are using Puppeteer in a Node environment, you will get an
 * instance of {@link PuppeteerNode} when you import or require `puppeteer`.
 * That class extends `Puppeteer`, so has all the methods documented below as
 * well as all that are defined on {@link PuppeteerNode}.
 * @public
 */
export class Puppeteer {
  /**
   * @internal
   */
  constructor(settings) {
    this._changedProduct = false;
    this._isPuppeteerCore = settings.isPuppeteerCore;
    this.connect = this.connect.bind(this);
  }
  /**
   * This method attaches Puppeteer to an existing browser instance.
   *
   * @remarks
   *
   * @param options - Set of configurable options to set on the browser.
   * @returns Promise which resolves to browser instance.
   */
  connect(options) {
    return _connectToBrowser(options);
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {devices} from 'puppeteer';
   * ```
   */
  get devices() {
    return devices;
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {errors} from 'puppeteer';
   * ```
   */
  get errors() {
    return errors;
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {networkConditions} from 'puppeteer';
   * ```
   */
  get networkConditions() {
    return networkConditions;
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {registerCustomQueryHandler} from 'puppeteer';
   * ```
   */
  registerCustomQueryHandler(name, queryHandler) {
    return registerCustomQueryHandler(name, queryHandler);
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {unregisterCustomQueryHandler} from 'puppeteer';
   * ```
   */
  unregisterCustomQueryHandler(name) {
    return unregisterCustomQueryHandler(name);
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {customQueryHandlerNames} from 'puppeteer';
   * ```
   */
  customQueryHandlerNames() {
    return customQueryHandlerNames();
  }
  /**
   * @deprecated Import directly puppeteer.
   * @example
   *
   * ```ts
   * import {clearCustomQueryHandlers} from 'puppeteer';
   * ```
   */
  clearCustomQueryHandlers() {
    return clearCustomQueryHandlers();
  }
}
//# sourceMappingURL=Puppeteer.js.map
