/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import type SemVer from "semver/mod.ts";
import { type Range } from "semver/mod.ts";

import { kSelfContained } from "../config/constants.ts";
import { Metadata, QuartoFilter } from "../config/types.ts";
import {
  RevealPlugin,
  RevealPluginBundle,
  RevealPluginScript,
} from "../format/reveal/format-reveal-plugin-types.ts";
import { ProjectConfig } from "../project/types.ts";

import { kRevealJSPlugins } from "./constants.ts";

export type Contributes =
  | "shortcodes"
  | "filters"
  | "formats"
  | "project"
  | "revealjs-plugins";

export interface Extension extends Record<string, unknown> {
  id: ExtensionId;
  title: string;
  author: string;
  version?: SemVer;
  quartoVersion?: Range;
  path: string;
  contributes: {
    project?: Record<string, unknown>;
    shortcodes?: string[];
    filters?: QuartoFilter[];
    formats?: Record<string, unknown>;
    [kRevealJSPlugins]?: Array<string | RevealPluginBundle | RevealPlugin>;
  };
}

export interface RevealPluginInline {
  name: string;
  register?: boolean;
  script?: string | string[] | RevealPluginScript | RevealPluginScript[];
  stylesheet?: string | string[];
  config?: Metadata;
  [kSelfContained]?: boolean;
}

export interface ExtensionOptions {
  builtIn: boolean;
}

export interface ExtensionContext {
  extensions(
    input?: string,
    config?: ProjectConfig,
    projectDir?: string,
    options?: ExtensionOptions,
  ): Promise<Extension[]>;
  extension(
    name: string,
    input: string,
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension | undefined>;
  find(
    name: string,
    input: string,
    contributes?:
      | "shortcodes"
      | "filters"
      | "formats"
      | "project"
      | "revealjs-plugins",
    config?: ProjectConfig,
    projectDir?: string,
    options?: ExtensionOptions,
  ): Promise<Extension[]>;
}

export interface ExtensionId {
  name: string;
  organization?: string;
}

export interface ExtensionMetadata {
  path: string;
  metadata: Metadata;
}
