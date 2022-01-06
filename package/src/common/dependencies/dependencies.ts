/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dartSass } from "./dartsass.ts";
import { deno_dom } from "./deno_dom.ts";
import { esBuild } from "./esbuild.ts";
import { pandoc } from "./pandoc.ts";

// The list of binary dependencies for Quarto
export const kDependencies = [
  deno_dom(version("DENO_DOM")),
  pandoc(version("PANDOC")),
  dartSass(version("DARTSASS")),
  esBuild(version("ESBUILD")),
];

// Defines a binary dependency for Quarto
export interface Dependency {
  name: string;
  bucket: string;
  version: string;
  architectureDependencies: Record<
    string,
    ArchitectureDependency
  >;
}

// Defines the specific Platform dependencies for
// a given architecture
export interface ArchitectureDependency {
  "darwin": PlatformDependency;
  "linux": PlatformDependency;
  "windows": PlatformDependency;
}

// Defines an individual binary dependency, specific
// to a Platform (and architecture)
export interface PlatformDependency {
  filename: string;
  url: string;
  configure(path: string): Promise<void>;
}

function version(env: string) {
  const version = Deno.env.get(env);
  if (!version) {
    throw Error(`${env} isn't defined with depedency version`);
  } else {
    return version;
  }
}
