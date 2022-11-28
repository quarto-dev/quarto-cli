/**
 * Copyright 2020 Google Inc. All rights reserved.
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
import { IsolatedWorld, WaitForSelectorOptions } from "./IsolatedWorld.js";
import { ElementHandle } from "./ElementHandle.js";
import { JSHandle } from "./JSHandle.js";
/**
 * @public
 */
export interface CustomQueryHandler {
  /**
   * @returns A {@link Node} matching the given `selector` from {@link node}.
   */
  queryOne?: (node: any, selector: string) => any | null;
  /**
   * @returns Some {@link Node}s matching the given `selector` from {@link node}.
   */
  queryAll?: (node: any, selector: string) => any[];
}
/**
 * @internal
 */
export interface InternalQueryHandler {
  /**
   * Queries for a single node given a selector and {@link ElementHandle}.
   *
   * Akin to {@link Window.prototype.querySelector}.
   */
  queryOne?: (
    element: ElementHandle<any>,
    selector: string,
  ) => Promise<ElementHandle<any> | null>;
  /**
   * Queries for multiple nodes given a selector and {@link ElementHandle}.
   *
   * Akin to {@link Window.prototype.querySelectorAll}.
   */
  queryAll?: (
    element: ElementHandle<any>,
    selector: string,
  ) => Promise<Array<ElementHandle<any>>>;
  /**
   * Queries for multiple nodes given a selector and {@link ElementHandle}.
   * Unlike {@link queryAll}, this returns a handle to a node array.
   *
   * Akin to {@link Window.prototype.querySelectorAll}.
   */
  queryAllArray?: (
    element: ElementHandle<any>,
    selector: string,
  ) => Promise<JSHandle<any[]>>;
  /**
   * Waits until a single node appears for a given selector and
   * {@link ElementHandle}.
   *
   * Akin to {@link Window.prototype.querySelectorAll}.
   */
  waitFor?: (
    isolatedWorld: IsolatedWorld,
    selector: string,
    options: WaitForSelectorOptions,
  ) => Promise<ElementHandle<any> | null>;
}
/**
 * Registers a {@link CustomQueryHandler | custom query handler}.
 *
 * @remarks
 * After registration, the handler can be used everywhere where a selector is
 * expected by prepending the selection string with `<name>/`. The name is only
 * allowed to consist of lower- and upper case latin letters.
 *
 * @example
 *
 * ```
 * puppeteer.registerCustomQueryHandler('text', { … });
 * const aHandle = await page.$('text/…');
 * ```
 *
 * @param name - The name that the custom query handler will be registered
 * under.
 * @param queryHandler - The {@link CustomQueryHandler | custom query handler}
 * to register.
 *
 * @public
 */
export declare function registerCustomQueryHandler(
  name: string,
  handler: CustomQueryHandler,
): void;
/**
 * @param name - The name of the query handler to unregistered.
 *
 * @public
 */
export declare function unregisterCustomQueryHandler(name: string): void;
/**
 * @returns a list with the names of all registered custom query handlers.
 *
 * @public
 */
export declare function customQueryHandlerNames(): string[];
/**
 * Clears all registered handlers.
 *
 * @public
 */
export declare function clearCustomQueryHandlers(): void;
/**
 * @internal
 */
export declare function getQueryHandlerAndSelector(selector: string): {
  updatedSelector: string;
  queryHandler: InternalQueryHandler;
};
