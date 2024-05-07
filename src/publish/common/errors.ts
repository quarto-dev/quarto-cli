/*
 * errors.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

export const throwUnableToPublish = (reason: string, provider: string) => {
  throw new Error(
    `Unable to publish to ${provider} (${reason})`,
  );
};
