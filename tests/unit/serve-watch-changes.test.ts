/*
 * serve-watch-changes.test.ts
 *
 * Tests that the debounced client reload in quarto preview accumulates
 * WatchChanges across debounce calls: a config refresh (config: true) or
 * full project render (output: false) requested within the debounce window
 * must not be dropped when a later call (e.g. an IDE-driven render that
 * finished right after a config or extension file event) reschedules the
 * debounce with only its own changes.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import {
  debouncedWatchChanges,
  WatchChanges,
} from "../../src/project/serve/watch.ts";

const kDebounceWait = 10;

const collect = () => {
  const calls: WatchChanges[] = [];
  const enqueue = debouncedWatchChanges((changes) => {
    calls.push(changes);
    return Promise.resolve();
  }, kDebounceWait);
  return { calls, enqueue };
};

const settle = () =>
  new Promise<void>((resolve) => setTimeout(resolve, kDebounceWait * 5));

unitTest(
  "watch changes: a later reload does not drop a pending config refresh",
  async () => {
    const { calls, enqueue } = collect();
    enqueue({ config: true, output: false });
    enqueue({ config: false, output: true, reloadTarget: "index.html" });
    await settle();
    assertEquals(calls, [
      { config: true, output: false, reloadTarget: "index.html" },
    ]);
  },
);

unitTest(
  "watch changes: an earlier reload does not drop a later config refresh",
  async () => {
    const { calls, enqueue } = collect();
    enqueue({ config: false, output: true, reloadTarget: "index.html" });
    enqueue({ config: true, output: false });
    await settle();
    assertEquals(calls, [
      { config: true, output: false, reloadTarget: "index.html" },
    ]);
  },
);

unitTest(
  "watch changes: a single call passes through unchanged",
  async () => {
    const { calls, enqueue } = collect();
    enqueue({ config: false, output: true, reloadTarget: "doc.html" });
    await settle();
    assertEquals(calls, [
      { config: false, output: true, reloadTarget: "doc.html" },
    ]);
  },
);

unitTest(
  "watch changes: a later undefined reload target keeps the earlier one",
  async () => {
    const { calls, enqueue } = collect();
    enqueue({ config: false, output: true, reloadTarget: "doc.html" });
    enqueue({ config: true, output: false });
    enqueue({ config: false, output: true, reloadTarget: "other.html" });
    await settle();
    assertEquals(calls, [
      { config: true, output: false, reloadTarget: "other.html" },
    ]);
  },
);

unitTest(
  "watch changes: each debounce window delivers the accumulated changes once",
  async () => {
    const { calls, enqueue } = collect();
    enqueue({ config: true, output: false });
    await settle();
    enqueue({ config: false, output: true });
    await settle();
    assertEquals(calls, [
      { config: true, output: false, reloadTarget: undefined },
      { config: false, output: true, reloadTarget: undefined },
    ]);
  },
);
