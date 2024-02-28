// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { BaseHandler } from "./base_handler.ts";
import { DEFAULT_CONFIG } from "./_config.ts";
import { Logger } from "./logger.ts";

export const state = {
  handlers: new Map<string, BaseHandler>(),
  loggers: new Map<string, Logger>(),
  config: DEFAULT_CONFIG,
};
