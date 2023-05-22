/*
 * state.ts
 *
 * Helpers to manage the global state required by the yaml intelligence
 * code
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { InternalError } from "../error.ts";
import { Semaphore } from "../semaphore.ts";

export function makeInitializer(
  thunk: () => Promise<unknown>,
): () => Promise<void> {
  let initStarted = false;
  const hasInitSemaphore = new Semaphore(0);

  return async () => {
    if (initStarted) {
      await hasInitSemaphore.runExclusive(async () => {});
      return;
    }
    initStarted = true;
    await thunk();
    hasInitSemaphore.release();
  };
}

let initializer: () => Promise<void> = () => {
  // can't call "err" here because we don't know if we're in the IDE or CLI
  // this should be an internal error anyway.
  throw new InternalError("initializer not set!!");
};

export async function initState() {
  await initializer();
}

// the logic for what initializer will ultimately be set is relatively
// hairy. We don't fundamentally know if we're
// being called from the CLI or the IDE, and the CLI has potentially
// many entry points. In addition, the CLI itself can have a number
// of different initializers depending on the command being called:
//
// - quarto build-js uses an initializer that skips precompiled modules
//
// - Some of the test suite uses an initializer with precompiled
//   modules and includes tree-sitter (so the behavior is as close to
//   the IDE as possible.)
//
// - quarto render, quarto preview, etc all want an initializer with
//   precompiled modules and no tree-sitter (for performance reasons
//   etc)
//
// The solution, then, is "first to call setInitializer decides the
// initializer". This way, quarto's render.ts modules (and others) can
// safely always set the last initializer. If inside the test suite
// for yaml-intelligence in the IDE, a different initializer will
// already have been set and will not be further touched.

let hasSet = false;
export function setInitializer(init: () => Promise<unknown>) {
  if (hasSet) {
    return;
  }
  initializer = makeInitializer(init);
  hasSet = true;
}
