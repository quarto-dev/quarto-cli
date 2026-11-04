/*
 * serve-render-manager.test.ts
 *
 * Tests that ServeRenderManager.submit queues a non-render task (such as a
 * project context refresh) on the same queue as renders, so a context swap
 * cannot overlap an in-flight render.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { RenderResult } from "../../src/command/render/types.ts";
import { ServeRenderManager } from "../../src/project/serve/render.ts";

unitTest(
  "ServeRenderManager.submit waits for an in-flight render",
  async () => {
    const manager = new ServeRenderManager();
    const order: string[] = [];

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const render = manager.submitRender(async () => {
      await gate;
      order.push("render");
      return { error: undefined } as unknown as RenderResult;
    });
    const task = manager.submit(() => {
      order.push("task");
      return Promise.resolve();
    });

    assertEquals(order, []);
    release();
    await Promise.all([render, task]);
    assertEquals(order, ["render", "task"]);
  },
);
