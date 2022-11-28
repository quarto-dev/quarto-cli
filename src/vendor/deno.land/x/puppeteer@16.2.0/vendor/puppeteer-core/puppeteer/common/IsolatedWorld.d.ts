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
import { Protocol } from "../../vendor/devtools-protocol/types/protocol.d.ts";
import { CDPSession } from "./Connection.js";
import { ElementHandle } from "./ElementHandle.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { FrameManager } from "./FrameManager.js";
import { Frame } from "./Frame.js";
import { MouseButton } from "./Input.js";
import { JSHandle } from "./JSHandle.js";
import { PuppeteerLifeCycleEvent } from "./LifecycleWatcher.js";
import { TimeoutSettings } from "./TimeoutSettings.js";
import { EvaluateFunc, HandleFor, NodeFor } from "./types.js";
/**
 * @public
 */
export interface WaitForSelectorOptions {
  /**
   * Wait for the selected element to be present in DOM and to be visible, i.e.
   * to not have `display: none` or `visibility: hidden` CSS properties.
   *
   * @defaultValue `false`
   */
  visible?: boolean;
  /**
   * Wait for the selected element to not be found in the DOM or to be hidden,
   * i.e. have `display: none` or `visibility: hidden` CSS properties.
   *
   * @defaultValue `false`
   */
  hidden?: boolean;
  /**
   * Maximum time to wait in milliseconds. Pass `0` to disable timeout.
   *
   * The default value can be changed by using {@link Page.setDefaultTimeout}
   *
   * @defaultValue `30000` (30 seconds)
   */
  timeout?: number;
  /**
   * @deprecated Do not use. Use the {@link ElementHandle.waitForSelector}
   */
  root?: ElementHandle<any>;
}
/**
 * @internal
 */
export interface PageBinding {
  name: string;
  pptrFunction: Function;
}
/**
 * A unique key for {@link IsolatedWorldChart} to denote the default world.
 * Execution contexts are automatically created in the default world.
 *
 * @internal
 */
export declare const MAIN_WORLD: unique symbol;
/**
 * A unique key for {@link IsolatedWorldChart} to denote the puppeteer world.
 * This world contains all puppeteer-internal bindings/code.
 *
 * @internal
 */
export declare const PUPPETEER_WORLD: unique symbol;
/**
 * @internal
 */
export interface IsolatedWorldChart {
  [key: string]: IsolatedWorld;
  [MAIN_WORLD]: IsolatedWorld;
  [PUPPETEER_WORLD]: IsolatedWorld;
}
/**
 * @internal
 */
export declare class IsolatedWorld {
  #private;
  get _waitTasks(): Set<WaitTask>;
  get _boundFunctions(): Map<string, Function>;
  constructor(
    client: CDPSession,
    frameManager: FrameManager,
    frame: Frame,
    timeoutSettings: TimeoutSettings,
  );
  frame(): Frame;
  clearContext(): void;
  setContext(context: ExecutionContext): void;
  hasContext(): boolean;
  _detach(): void;
  executionContext(): Promise<ExecutionContext>;
  evaluateHandle<
    Params extends unknown[],
    Func extends EvaluateFunc<Params> = EvaluateFunc<Params>,
  >(
    pageFunction: Func | string,
    ...args: Params
  ): Promise<HandleFor<Awaited<ReturnType<Func>>>>;
  evaluate<
    Params extends unknown[],
    Func extends EvaluateFunc<Params> = EvaluateFunc<Params>,
  >(
    pageFunction: Func | string,
    ...args: Params
  ): Promise<Awaited<ReturnType<Func>>>;
  $<Selector extends string>(
    selector: Selector,
  ): Promise<ElementHandle<NodeFor<Selector>> | null>;
  $$<Selector extends string>(
    selector: Selector,
  ): Promise<Array<ElementHandle<NodeFor<Selector>>>>;
  document(): Promise<ElementHandle<any>>;
  $x(expression: string): Promise<Array<ElementHandle<any>>>;
  $eval<
    Selector extends string,
    Params extends unknown[],
    Func extends EvaluateFunc<[
      ElementHandle<NodeFor<Selector>>,
      ...Params,
    ]> = EvaluateFunc<[ElementHandle<NodeFor<Selector>>, ...Params]>,
  >(
    selector: Selector,
    pageFunction: Func | string,
    ...args: Params
  ): Promise<Awaited<ReturnType<Func>>>;
  $$eval<
    Selector extends string,
    Params extends unknown[],
    Func extends EvaluateFunc<[
      Array<NodeFor<Selector>>,
      ...Params,
    ]> = EvaluateFunc<[Array<NodeFor<Selector>>, ...Params]>,
  >(
    selector: Selector,
    pageFunction: Func | string,
    ...args: Params
  ): Promise<Awaited<ReturnType<Func>>>;
  waitForSelector<Selector extends string>(
    selector: Selector,
    options: WaitForSelectorOptions,
  ): Promise<ElementHandle<NodeFor<Selector>> | null>;
  content(): Promise<string>;
  setContent(html: string, options?: {
    timeout?: number;
    waitUntil?: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[];
  }): Promise<void>;
  /**
   * Adds a script tag into the current context.
   *
   * @remarks
   * You can pass a URL, filepath or string of contents. Note that when running Puppeteer
   * in a browser environment you cannot pass a filepath and should use either
   * `url` or `content`.
   */
  addScriptTag(options: {
    url?: string;
    path?: string;
    content?: string;
    id?: string;
    type?: string;
  }): Promise<ElementHandle<any>>;
  /**
   * Adds a style tag into the current context.
   *
   * @remarks
   * You can pass a URL, filepath or string of contents. Note that when running Puppeteer
   * in a browser environment you cannot pass a filepath and should use either
   * `url` or `content`.
   */
  addStyleTag(options: {
    url?: string;
    path?: string;
    content?: string;
  }): Promise<ElementHandle<any>>;
  click(selector: string, options: {
    delay?: number;
    button?: MouseButton;
    clickCount?: number;
  }): Promise<void>;
  focus(selector: string): Promise<void>;
  hover(selector: string): Promise<void>;
  select(selector: string, ...values: string[]): Promise<string[]>;
  tap(selector: string): Promise<void>;
  type(selector: string, text: string, options?: {
    delay: number;
  }): Promise<void>;
  _addBindingToContext(context: ExecutionContext, name: string): Promise<void>;
  _waitForSelectorInPage(
    queryOne: Function,
    selector: string,
    options: WaitForSelectorOptions,
    binding?: PageBinding,
  ): Promise<ElementHandle<any> | null>;
  waitForFunction(pageFunction: Function | string, options?: {
    polling?: string | number;
    timeout?: number;
  }, ...args: unknown[]): Promise<JSHandle>;
  title(): Promise<string>;
  adoptBackendNode(
    backendNodeId?: Protocol.DOM.BackendNodeId,
  ): Promise<JSHandle<any>>;
  adoptHandle<T extends JSHandle<any>>(handle: T): Promise<T>;
}
/**
 * @internal
 */
export interface WaitTaskOptions {
  isolatedWorld: IsolatedWorld;
  predicateBody: Function | string;
  predicateAcceptsContextElement: boolean;
  title: string;
  polling: string | number;
  timeout: number;
  binding?: PageBinding;
  args: unknown[];
  root?: ElementHandle<any>;
}
/**
 * @internal
 */
export declare class WaitTask {
  #private;
  promise: Promise<JSHandle>;
  constructor(options: WaitTaskOptions);
  terminate(error: Error): void;
  rerun(): Promise<void>;
}
