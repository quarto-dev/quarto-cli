// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { basename } from "../path.ts";
import { EventEmitter } from "../events.ts";
import { notImplemented } from "../_utils.ts";
import { promisify } from "../util.ts";
import { getValidatedPath } from "../internal/fs/utils.mjs";
import { validateFunction } from "../internal/validators.mjs";
import { stat, Stats } from "./_fs_stat.ts";
import { Stats as StatsClass } from "../internal/fs/utils.mjs";
import { Buffer } from "../buffer.ts";
import { delay } from "../../async/delay.ts";

const statPromisified = promisify(stat);
const statAsync = async (filename: string): Promise<Stats | null> => {
  try {
    return await statPromisified(filename);
  } catch {
    return emptyStats;
  }
};
const emptyStats = new StatsClass(
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  Date.UTC(1970, 0, 1, 0, 0, 0),
  Date.UTC(1970, 0, 1, 0, 0, 0),
  Date.UTC(1970, 0, 1, 0, 0, 0),
  Date.UTC(1970, 0, 1, 0, 0, 0),
) as unknown as Stats;

export function asyncIterableIteratorToCallback<T>(
  iterator: AsyncIterableIterator<T>,
  callback: (val: T, done?: boolean) => void,
) {
  function next() {
    iterator.next().then((obj) => {
      if (obj.done) {
        callback(obj.value, true);
        return;
      }
      callback(obj.value);
      next();
    });
  }
  next();
}

export function asyncIterableToCallback<T>(
  iter: AsyncIterable<T>,
  callback: (val: T, done?: boolean) => void,
  errCallback: (e: unknown) => void,
) {
  const iterator = iter[Symbol.asyncIterator]();
  function next() {
    iterator.next().then((obj) => {
      if (obj.done) {
        callback(obj.value, true);
        return;
      }
      callback(obj.value);
      next();
    }, errCallback);
  }
  next();
}

type watchOptions = {
  persistent?: boolean;
  recursive?: boolean;
  encoding?: string;
};

type watchListener = (eventType: string, filename: string) => void;

export function watch(
  filename: string | URL,
  options: watchOptions,
  listener: watchListener,
): FSWatcher;
export function watch(
  filename: string | URL,
  listener: watchListener,
): FSWatcher;
export function watch(
  filename: string | URL,
  options: watchOptions,
): FSWatcher;
export function watch(filename: string | URL): FSWatcher;
export function watch(
  filename: string | URL,
  optionsOrListener?: watchOptions | watchListener,
  optionsOrListener2?: watchOptions | watchListener,
) {
  const listener = typeof optionsOrListener === "function"
    ? optionsOrListener
    : typeof optionsOrListener2 === "function"
    ? optionsOrListener2
    : undefined;
  const options = typeof optionsOrListener === "object"
    ? optionsOrListener
    : typeof optionsOrListener2 === "object"
    ? optionsOrListener2
    : undefined;

  const watchPath = getValidatedPath(filename).toString();

  let iterator: Deno.FsWatcher;
  // Start the actual watcher a few msec later to avoid race condition
  // error in test case in compat test case
  // (parallel/test-fs-watch.js, parallel/test-fs-watchfile.js)
  const timer = setTimeout(() => {
    iterator = Deno.watchFs(watchPath, {
      recursive: options?.recursive || false,
    });

    asyncIterableToCallback<Deno.FsEvent>(iterator, (val, done) => {
      if (done) return;
      fsWatcher.emit(
        "change",
        convertDenoFsEventToNodeFsEvent(val.kind),
        basename(val.paths[0]),
      );
    }, (e) => {
      fsWatcher.emit("error", e);
    });
  }, 5);

  const fsWatcher = new FSWatcher(() => {
    clearTimeout(timer);
    try {
      iterator?.close();
    } catch (e) {
      if (e instanceof Deno.errors.BadResource) {
        // already closed
        return;
      }
      throw e;
    }
  });

  if (listener) {
    fsWatcher.on("change", listener.bind({ _handle: fsWatcher }));
  }

  return fsWatcher;
}

export const watchPromise = promisify(watch) as (
  & ((
    filename: string | URL,
    options: watchOptions,
    listener: watchListener,
  ) => Promise<FSWatcher>)
  & ((
    filename: string | URL,
    listener: watchListener,
  ) => Promise<FSWatcher>)
  & ((
    filename: string | URL,
    options: watchOptions,
  ) => Promise<FSWatcher>)
  & ((filename: string | URL) => Promise<FSWatcher>)
);

type WatchFileListener = (curr: Stats, prev: Stats) => void;
type WatchFileOptions = {
  bigint?: boolean;
  persistent?: boolean;
  interval?: number;
};

export function watchFile(
  filename: string | Buffer | URL,
  listener: WatchFileListener,
): StatWatcher;
export function watchFile(
  filename: string | Buffer | URL,
  options: WatchFileOptions,
  listener: WatchFileListener,
): StatWatcher;
export function watchFile(
  filename: string | Buffer | URL,
  listenerOrOptions: WatchFileListener | WatchFileOptions,
  listener?: WatchFileListener,
): StatWatcher {
  const watchPath = getValidatedPath(filename).toString();
  const handler = typeof listenerOrOptions === "function"
    ? listenerOrOptions
    : listener!;
  validateFunction(handler, "listener");
  const {
    bigint = false,
    persistent = true,
    interval = 5007,
  } = typeof listenerOrOptions === "object" ? listenerOrOptions : {};

  let stat = statWatchers.get(watchPath);
  if (stat === undefined) {
    stat = new StatWatcher(bigint);
    stat[kFSStatWatcherStart](watchPath, persistent, interval);
    statWatchers.set(watchPath, stat);
  }

  stat.addListener("change", listener!);
  return stat;
}

export function unwatchFile(
  filename: string | Buffer | URL,
  listener?: WatchFileListener,
) {
  const watchPath = getValidatedPath(filename).toString();
  const stat = statWatchers.get(watchPath);

  if (!stat) {
    return;
  }

  if (typeof listener === "function") {
    const beforeListenerCount = stat.listenerCount("change");
    stat.removeListener("change", listener);
    if (stat.listenerCount("change") < beforeListenerCount) {
      stat[kFSStatWatcherAddOrCleanRef]("clean");
    }
  } else {
    stat.removeAllListeners("change");
    stat[kFSStatWatcherAddOrCleanRef]("cleanAll");
  }

  if (stat.listenerCount("change") === 0) {
    stat.stop();
    statWatchers.delete(watchPath);
  }
}

const statWatchers = new Map<string, StatWatcher>();

const kFSStatWatcherStart = Symbol("kFSStatWatcherStart");
const kFSStatWatcherAddOrCleanRef = Symbol("kFSStatWatcherAddOrCleanRef");

class StatWatcher extends EventEmitter {
  #bigint: boolean;
  #refCount = 0;
  #abortController = new AbortController();
  constructor(bigint: boolean) {
    super();
    this.#bigint = bigint;
  }
  [kFSStatWatcherStart](
    filename: string,
    persistent: boolean,
    interval: number,
  ) {
    if (persistent) {
      this.#refCount++;
    }

    (async () => {
      let prev = await statAsync(filename);

      if (prev === emptyStats) {
        this.emit("change", prev, prev);
      }

      try {
        while (true) {
          await delay(interval, { signal: this.#abortController.signal });
          const curr = await statAsync(filename);
          if (curr?.mtime !== prev?.mtime) {
            this.emit("change", curr, prev);
            prev = curr;
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        this.emit("error", e);
      }
    })();
  }
  [kFSStatWatcherAddOrCleanRef](addOrClean: "add" | "clean" | "cleanAll") {
    if (addOrClean === "add") {
      this.#refCount++;
    } else if (addOrClean === "clean") {
      this.#refCount--;
    } else {
      this.#refCount = 0;
    }
  }
  stop() {
    if (this.#abortController.signal.aborted) {
      return;
    }
    this.#abortController.abort();
    this.emit("stop");
  }
  ref() {
    notImplemented("FSWatcher.ref() is not implemented");
  }
  unref() {
    notImplemented("FSWatcher.unref() is not implemented");
  }
}

class FSWatcher extends EventEmitter {
  #closer: () => void;
  #closed = false;
  constructor(closer: () => void) {
    super();
    this.#closer = closer;
  }
  close() {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.emit("close");
    this.#closer();
  }
  ref() {
    notImplemented("FSWatcher.ref() is not implemented");
  }
  unref() {
    notImplemented("FSWatcher.unref() is not implemented");
  }
}

type NodeFsEventType = "rename" | "change";

function convertDenoFsEventToNodeFsEvent(
  kind: Deno.FsEvent["kind"],
): NodeFsEventType {
  if (kind === "create" || kind === "remove") {
    return "rename";
  } else {
    return "change";
  }
}
