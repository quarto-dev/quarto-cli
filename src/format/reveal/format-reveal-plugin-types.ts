/*
 * format-reveal-plugin-types.ts
 *
 * Copyright (C) 2021-2023 Posit Software, PBC
 */

import { Metadata } from "../../config/types.ts";
import { kSelfContained } from "../../config/constants.ts";

export interface RevealPluginBundle {
  plugin: string;
  config?: Metadata;
}

export interface RevealPlugin {
  path: string;
  name: string;
  register?: boolean;
  script?: RevealPluginScript[];
  stylesheet?: string[];
  config?: Metadata;
  metadata?: string[];
  [kSelfContained]?: boolean;
}

export interface RevealPluginScript {
  path: string;
  async?: boolean;
}
