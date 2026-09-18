/*
 * utils.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

let someCommandFailed = false;

// we do this the roundabout way because there doesn't seem to be any clean way
// for cliffy commands to return values? Likely a skill issue on my part
export const signalCommandFailure = () => {
  someCommandFailed = true;
};

export const commandFailed = () => {
  return someCommandFailed;
};
