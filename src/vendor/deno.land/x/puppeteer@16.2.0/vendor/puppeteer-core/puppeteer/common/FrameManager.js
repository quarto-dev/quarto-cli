/// <reference types="./FrameManager.d.ts" />
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
var _FrameManager_instances,
  _FrameManager_page,
  _FrameManager_networkManager,
  _FrameManager_timeoutSettings,
  _FrameManager_frames,
  _FrameManager_contextIdToContext,
  _FrameManager_isolatedWorlds,
  _FrameManager_mainFrame,
  _FrameManager_client,
  _FrameManager_framesPendingTargetInit,
  _FrameManager_framesPendingAttachment,
  _FrameManager_onLifecycleEvent,
  _FrameManager_onFrameStartedLoading,
  _FrameManager_onFrameStoppedLoading,
  _FrameManager_handleFrameTree,
  _FrameManager_onFrameAttached,
  _FrameManager_onFrameNavigated,
  _FrameManager_createIsolatedWorld,
  _FrameManager_onFrameNavigatedWithinDocument,
  _FrameManager_onFrameDetached,
  _FrameManager_onExecutionContextCreated,
  _FrameManager_onExecutionContextDestroyed,
  _FrameManager_onExecutionContextsCleared,
  _FrameManager_removeFramesRecursively;
import { assert } from "../util/assert.js";
import { createDeferredPromiseWithTimer } from "../util/DeferredPromise.js";
import { isErrorLike } from "../util/ErrorLike.js";
import { EventEmitter } from "./EventEmitter.js";
import { EVALUATION_SCRIPT_URL, ExecutionContext } from "./ExecutionContext.js";
import { Frame } from "./Frame.js";
import { MAIN_WORLD, PUPPETEER_WORLD } from "./IsolatedWorld.js";
import { NetworkManager } from "./NetworkManager.js";
import { debugError } from "./util.js";
const UTILITY_WORLD_NAME = "__puppeteer_utility_world__";
/**
 * We use symbols to prevent external parties listening to these events.
 * They are internal to Puppeteer.
 *
 * @internal
 */
export const FrameManagerEmittedEvents = {
  FrameAttached: Symbol("FrameManager.FrameAttached"),
  FrameNavigated: Symbol("FrameManager.FrameNavigated"),
  FrameDetached: Symbol("FrameManager.FrameDetached"),
  FrameSwapped: Symbol("FrameManager.FrameSwapped"),
  LifecycleEvent: Symbol("FrameManager.LifecycleEvent"),
  FrameNavigatedWithinDocument: Symbol(
    "FrameManager.FrameNavigatedWithinDocument",
  ),
  ExecutionContextCreated: Symbol("FrameManager.ExecutionContextCreated"),
  ExecutionContextDestroyed: Symbol("FrameManager.ExecutionContextDestroyed"),
};
/**
 * A frame manager manages the frames for a given {@link Page | page}.
 *
 * @internal
 */
export class FrameManager extends EventEmitter {
  constructor(client, page, ignoreHTTPSErrors, timeoutSettings) {
    super();
    _FrameManager_instances.add(this);
    _FrameManager_page.set(this, void 0);
    _FrameManager_networkManager.set(this, void 0);
    _FrameManager_timeoutSettings.set(this, void 0);
    _FrameManager_frames.set(this, new Map());
    _FrameManager_contextIdToContext.set(this, new Map());
    _FrameManager_isolatedWorlds.set(this, new Set());
    _FrameManager_mainFrame.set(this, void 0);
    _FrameManager_client.set(this, void 0);
    /**
     * Keeps track of OOPIF targets/frames (target ID == frame ID for OOPIFs)
     * that are being initialized.
     */
    _FrameManager_framesPendingTargetInit.set(this, new Map());
    /**
     * Keeps track of frames that are in the process of being attached in #onFrameAttached.
     */
    _FrameManager_framesPendingAttachment.set(this, new Map());
    __classPrivateFieldSet(this, _FrameManager_client, client, "f");
    __classPrivateFieldSet(this, _FrameManager_page, page, "f");
    __classPrivateFieldSet(
      this,
      _FrameManager_networkManager,
      new NetworkManager(client, ignoreHTTPSErrors, this),
      "f",
    );
    __classPrivateFieldSet(
      this,
      _FrameManager_timeoutSettings,
      timeoutSettings,
      "f",
    );
    this.setupEventListeners(
      __classPrivateFieldGet(this, _FrameManager_client, "f"),
    );
  }
  get timeoutSettings() {
    return __classPrivateFieldGet(this, _FrameManager_timeoutSettings, "f");
  }
  get networkManager() {
    return __classPrivateFieldGet(this, _FrameManager_networkManager, "f");
  }
  get client() {
    return __classPrivateFieldGet(this, _FrameManager_client, "f");
  }
  setupEventListeners(session) {
    session.on("Page.frameAttached", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameAttached,
      ).call(this, session, event.frameId, event.parentFrameId);
    });
    session.on("Page.frameNavigated", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameNavigated,
      ).call(this, event.frame);
    });
    session.on("Page.navigatedWithinDocument", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameNavigatedWithinDocument,
      ).call(this, event.frameId, event.url);
    });
    session.on("Page.frameDetached", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameDetached,
      ).call(this, event.frameId, event.reason);
    });
    session.on("Page.frameStartedLoading", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameStartedLoading,
      ).call(this, event.frameId);
    });
    session.on("Page.frameStoppedLoading", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameStoppedLoading,
      ).call(this, event.frameId);
    });
    session.on("Runtime.executionContextCreated", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onExecutionContextCreated,
      ).call(this, event.context, session);
    });
    session.on("Runtime.executionContextDestroyed", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onExecutionContextDestroyed,
      ).call(this, event.executionContextId, session);
    });
    session.on("Runtime.executionContextsCleared", () => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onExecutionContextsCleared,
      ).call(this, session);
    });
    session.on("Page.lifecycleEvent", (event) => {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onLifecycleEvent,
      ).call(this, event);
    });
  }
  async initialize(
    targetId,
    client = __classPrivateFieldGet(this, _FrameManager_client, "f"),
  ) {
    var _a;
    try {
      if (
        !__classPrivateFieldGet(
          this,
          _FrameManager_framesPendingTargetInit,
          "f",
        ).has(targetId)
      ) {
        __classPrivateFieldGet(this, _FrameManager_framesPendingTargetInit, "f")
          .set(
            targetId,
            createDeferredPromiseWithTimer(
              `Waiting for target frame ${targetId} failed`,
            ),
          );
      }
      const result = await Promise.all([
        client.send("Page.enable"),
        client.send("Page.getFrameTree"),
      ]);
      const { frameTree } = result[1];
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_handleFrameTree,
      ).call(this, client, frameTree);
      await Promise.all([
        client.send("Page.setLifecycleEventsEnabled", { enabled: true }),
        client.send("Runtime.enable").then(() => {
          return __classPrivateFieldGet(
            this,
            _FrameManager_instances,
            "m",
            _FrameManager_createIsolatedWorld,
          ).call(this, client, UTILITY_WORLD_NAME);
        }),
        // TODO: Network manager is not aware of OOP iframes yet.
        client === __classPrivateFieldGet(this, _FrameManager_client, "f")
          ? __classPrivateFieldGet(this, _FrameManager_networkManager, "f")
            .initialize()
          : Promise.resolve(),
      ]);
    } catch (error) {
      // The target might have been closed before the initialization finished.
      if (
        isErrorLike(error) &&
        (error.message.includes("Target closed") ||
          error.message.includes("Session closed"))
      ) {
        return;
      }
      throw error;
    } finally {
      (_a = __classPrivateFieldGet(
            this,
            _FrameManager_framesPendingTargetInit,
            "f",
          ).get(targetId)) === null || _a === void 0
        ? void 0
        : _a.resolve();
      __classPrivateFieldGet(this, _FrameManager_framesPendingTargetInit, "f")
        .delete(targetId);
    }
  }
  executionContextById(
    contextId,
    session = __classPrivateFieldGet(this, _FrameManager_client, "f"),
  ) {
    const key = `${session.id()}:${contextId}`;
    const context = __classPrivateFieldGet(
      this,
      _FrameManager_contextIdToContext,
      "f",
    ).get(key);
    assert(context, "INTERNAL ERROR: missing context with id = " + contextId);
    return context;
  }
  page() {
    return __classPrivateFieldGet(this, _FrameManager_page, "f");
  }
  mainFrame() {
    assert(
      __classPrivateFieldGet(this, _FrameManager_mainFrame, "f"),
      "Requesting main frame too early!",
    );
    return __classPrivateFieldGet(this, _FrameManager_mainFrame, "f");
  }
  frames() {
    return Array.from(
      __classPrivateFieldGet(this, _FrameManager_frames, "f").values(),
    );
  }
  frame(frameId) {
    return __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
      frameId,
    ) || null;
  }
  onAttachedToTarget(target) {
    if (target._getTargetInfo().type !== "iframe") {
      return;
    }
    const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
      target._getTargetInfo().targetId,
    );
    if (frame) {
      frame.updateClient(target._session());
    }
    this.setupEventListeners(target._session());
    this.initialize(target._getTargetInfo().targetId, target._session());
  }
  onDetachedFromTarget(target) {
    const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
      target._targetId,
    );
    if (frame && frame.isOOPFrame()) {
      // When an OOP iframe is removed from the page, it
      // will only get a Target.detachedFromTarget event.
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_removeFramesRecursively,
      ).call(this, frame);
    }
  }
}
_FrameManager_page = new WeakMap(),
  _FrameManager_networkManager = new WeakMap(),
  _FrameManager_timeoutSettings = new WeakMap(),
  _FrameManager_frames = new WeakMap(),
  _FrameManager_contextIdToContext = new WeakMap(),
  _FrameManager_isolatedWorlds = new WeakMap(),
  _FrameManager_mainFrame = new WeakMap(),
  _FrameManager_client = new WeakMap(),
  _FrameManager_framesPendingTargetInit = new WeakMap(),
  _FrameManager_framesPendingAttachment = new WeakMap(),
  _FrameManager_instances = new WeakSet(),
  _FrameManager_onLifecycleEvent = function _FrameManager_onLifecycleEvent(
    event,
  ) {
    const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
      event.frameId,
    );
    if (!frame) {
      return;
    }
    frame._onLifecycleEvent(event.loaderId, event.name);
    this.emit(FrameManagerEmittedEvents.LifecycleEvent, frame);
  },
  _FrameManager_onFrameStartedLoading =
    function _FrameManager_onFrameStartedLoading(frameId) {
      const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
        frameId,
      );
      if (!frame) {
        return;
      }
      frame._onLoadingStarted();
    },
  _FrameManager_onFrameStoppedLoading =
    function _FrameManager_onFrameStoppedLoading(frameId) {
      const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
        frameId,
      );
      if (!frame) {
        return;
      }
      frame._onLoadingStopped();
      this.emit(FrameManagerEmittedEvents.LifecycleEvent, frame);
    },
  _FrameManager_handleFrameTree = function _FrameManager_handleFrameTree(
    session,
    frameTree,
  ) {
    if (frameTree.frame.parentId) {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_onFrameAttached,
      ).call(this, session, frameTree.frame.id, frameTree.frame.parentId);
    }
    __classPrivateFieldGet(
      this,
      _FrameManager_instances,
      "m",
      _FrameManager_onFrameNavigated,
    ).call(this, frameTree.frame);
    if (!frameTree.childFrames) {
      return;
    }
    for (const child of frameTree.childFrames) {
      __classPrivateFieldGet(
        this,
        _FrameManager_instances,
        "m",
        _FrameManager_handleFrameTree,
      ).call(this, session, child);
    }
  },
  _FrameManager_onFrameAttached = function _FrameManager_onFrameAttached(
    session,
    frameId,
    parentFrameId,
  ) {
    if (__classPrivateFieldGet(this, _FrameManager_frames, "f").has(frameId)) {
      const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
        frameId,
      );
      if (session && frame.isOOPFrame()) {
        // If an OOP iframes becomes a normal iframe again
        // it is first attached to the parent page before
        // the target is removed.
        frame.updateClient(session);
      }
      return;
    }
    const parentFrame = __classPrivateFieldGet(this, _FrameManager_frames, "f")
      .get(parentFrameId);
    const complete = (parentFrame) => {
      assert(parentFrame, `Parent frame ${parentFrameId} not found`);
      const frame = new Frame(this, parentFrame, frameId, session);
      __classPrivateFieldGet(this, _FrameManager_frames, "f").set(
        frame._id,
        frame,
      );
      this.emit(FrameManagerEmittedEvents.FrameAttached, frame);
    };
    if (parentFrame) {
      return complete(parentFrame);
    }
    const frame = __classPrivateFieldGet(
      this,
      _FrameManager_framesPendingTargetInit,
      "f",
    ).get(parentFrameId);
    if (frame) {
      if (
        !__classPrivateFieldGet(
          this,
          _FrameManager_framesPendingAttachment,
          "f",
        ).has(frameId)
      ) {
        __classPrivateFieldGet(this, _FrameManager_framesPendingAttachment, "f")
          .set(
            frameId,
            createDeferredPromiseWithTimer(
              `Waiting for frame ${frameId} to attach failed`,
            ),
          );
      }
      frame.then(() => {
        var _a;
        complete(
          __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
            parentFrameId,
          ),
        );
        (_a = __classPrivateFieldGet(
              this,
              _FrameManager_framesPendingAttachment,
              "f",
            ).get(frameId)) === null || _a === void 0
          ? void 0
          : _a.resolve();
        __classPrivateFieldGet(this, _FrameManager_framesPendingAttachment, "f")
          .delete(frameId);
      });
      return;
    }
    throw new Error(`Parent frame ${parentFrameId} not found`);
  },
  _FrameManager_onFrameNavigated = function _FrameManager_onFrameNavigated(
    framePayload,
  ) {
    const frameId = framePayload.id;
    const isMainFrame = !framePayload.parentId;
    const frame = isMainFrame
      ? __classPrivateFieldGet(this, _FrameManager_mainFrame, "f")
      : __classPrivateFieldGet(this, _FrameManager_frames, "f").get(frameId);
    const complete = (frame) => {
      assert(
        isMainFrame || frame,
        `Missing frame isMainFrame=${isMainFrame}, frameId=${frameId}`,
      );
      // Detach all child frames first.
      if (frame) {
        for (const child of frame.childFrames()) {
          __classPrivateFieldGet(
            this,
            _FrameManager_instances,
            "m",
            _FrameManager_removeFramesRecursively,
          ).call(this, child);
        }
      }
      // Update or create main frame.
      if (isMainFrame) {
        if (frame) {
          // Update frame id to retain frame identity on cross-process navigation.
          __classPrivateFieldGet(this, _FrameManager_frames, "f").delete(
            frame._id,
          );
          frame._id = frameId;
        } else {
          // Initial main frame navigation.
          frame = new Frame(
            this,
            null,
            frameId,
            __classPrivateFieldGet(this, _FrameManager_client, "f"),
          );
        }
        __classPrivateFieldGet(this, _FrameManager_frames, "f").set(
          frameId,
          frame,
        );
        __classPrivateFieldSet(this, _FrameManager_mainFrame, frame, "f");
      }
      // Update frame payload.
      assert(frame);
      frame._navigated(framePayload);
      this.emit(FrameManagerEmittedEvents.FrameNavigated, frame);
    };
    const pendingFrame = __classPrivateFieldGet(
      this,
      _FrameManager_framesPendingAttachment,
      "f",
    ).get(frameId);
    if (pendingFrame) {
      pendingFrame.then(() => {
        complete(
          isMainFrame
            ? __classPrivateFieldGet(this, _FrameManager_mainFrame, "f")
            : __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
              frameId,
            ),
        );
      });
    } else {
      complete(frame);
    }
  },
  _FrameManager_createIsolatedWorld =
    async function _FrameManager_createIsolatedWorld(session, name) {
      const key = `${session.id()}:${name}`;
      if (
        __classPrivateFieldGet(this, _FrameManager_isolatedWorlds, "f").has(key)
      ) {
        return;
      }
      await session.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`,
        worldName: name,
      });
      await Promise.all(
        this.frames()
          .filter((frame) => {
            return frame._client() === session;
          })
          .map((frame) => {
            // Frames might be removed before we send this, so we don't want to
            // throw an error.
            return session
              .send("Page.createIsolatedWorld", {
                frameId: frame._id,
                worldName: name,
                grantUniveralAccess: true,
              })
              .catch(debugError);
          }),
      );
      __classPrivateFieldGet(this, _FrameManager_isolatedWorlds, "f").add(key);
    },
  _FrameManager_onFrameNavigatedWithinDocument =
    function _FrameManager_onFrameNavigatedWithinDocument(frameId, url) {
      const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
        frameId,
      );
      if (!frame) {
        return;
      }
      frame._navigatedWithinDocument(url);
      this.emit(FrameManagerEmittedEvents.FrameNavigatedWithinDocument, frame);
      this.emit(FrameManagerEmittedEvents.FrameNavigated, frame);
    },
  _FrameManager_onFrameDetached = function _FrameManager_onFrameDetached(
    frameId,
    reason,
  ) {
    const frame = __classPrivateFieldGet(this, _FrameManager_frames, "f").get(
      frameId,
    );
    if (reason === "remove") {
      // Only remove the frame if the reason for the detached event is
      // an actual removement of the frame.
      // For frames that become OOP iframes, the reason would be 'swap'.
      if (frame) {
        __classPrivateFieldGet(
          this,
          _FrameManager_instances,
          "m",
          _FrameManager_removeFramesRecursively,
        ).call(this, frame);
      }
    } else if (reason === "swap") {
      this.emit(FrameManagerEmittedEvents.FrameSwapped, frame);
    }
  },
  _FrameManager_onExecutionContextCreated =
    function _FrameManager_onExecutionContextCreated(contextPayload, session) {
      const auxData = contextPayload.auxData;
      const frameId = auxData && auxData.frameId;
      const frame = typeof frameId === "string"
        ? __classPrivateFieldGet(this, _FrameManager_frames, "f").get(frameId)
        : undefined;
      let world;
      if (frame) {
        // Only care about execution contexts created for the current session.
        if (frame._client() !== session) {
          return;
        }
        if (contextPayload.auxData && !!contextPayload.auxData["isDefault"]) {
          world = frame.worlds[MAIN_WORLD];
        } else if (
          contextPayload.name === UTILITY_WORLD_NAME &&
          !frame.worlds[PUPPETEER_WORLD].hasContext()
        ) {
          // In case of multiple sessions to the same target, there's a race between
          // connections so we might end up creating multiple isolated worlds.
          // We can use either.
          world = frame.worlds[PUPPETEER_WORLD];
        }
      }
      const context = new ExecutionContext(
        (frame === null || frame === void 0 ? void 0 : frame._client()) ||
          __classPrivateFieldGet(this, _FrameManager_client, "f"),
        contextPayload,
        world,
      );
      if (world) {
        world.setContext(context);
      }
      const key = `${session.id()}:${contextPayload.id}`;
      __classPrivateFieldGet(this, _FrameManager_contextIdToContext, "f").set(
        key,
        context,
      );
    },
  _FrameManager_onExecutionContextDestroyed =
    function _FrameManager_onExecutionContextDestroyed(
      executionContextId,
      session,
    ) {
      const key = `${session.id()}:${executionContextId}`;
      const context = __classPrivateFieldGet(
        this,
        _FrameManager_contextIdToContext,
        "f",
      ).get(key);
      if (!context) {
        return;
      }
      __classPrivateFieldGet(this, _FrameManager_contextIdToContext, "f")
        .delete(key);
      if (context._world) {
        context._world.clearContext();
      }
    },
  _FrameManager_onExecutionContextsCleared =
    function _FrameManager_onExecutionContextsCleared(session) {
      for (
        const [key, context] of __classPrivateFieldGet(
          this,
          _FrameManager_contextIdToContext,
          "f",
        ).entries()
      ) {
        // Make sure to only clear execution contexts that belong
        // to the current session.
        if (context._client !== session) {
          continue;
        }
        if (context._world) {
          context._world.clearContext();
        }
        __classPrivateFieldGet(this, _FrameManager_contextIdToContext, "f")
          .delete(key);
      }
    },
  _FrameManager_removeFramesRecursively =
    function _FrameManager_removeFramesRecursively(frame) {
      for (const child of frame.childFrames()) {
        __classPrivateFieldGet(
          this,
          _FrameManager_instances,
          "m",
          _FrameManager_removeFramesRecursively,
        ).call(this, child);
      }
      frame._detach();
      __classPrivateFieldGet(this, _FrameManager_frames, "f").delete(frame._id);
      this.emit(FrameManagerEmittedEvents.FrameDetached, frame);
    };
//# sourceMappingURL=FrameManager.js.map
