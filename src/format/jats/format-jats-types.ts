/*
 * format-jats-types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { formatResourcePath } from "../../core/resources.ts";

import { join } from "path/mod.ts";

export const kJatsSubarticle = "jats-subarticle";
export const kLintXml = "_lint-jats-xml-output";
export const kSubArticles = "subarticles";

export interface JatsSubArticle {
  input: string;
  output: string;
  supporting: string[];
  resources: string[];
  render: false;
}

export interface JatsRenderSubArticle {
  input: string;
  token: string;
  render: true;
}

export function jatsTagset(to: string): JatsTagset {
  return kTagSets[to];
}

export function jatsDtd(tagset: JatsTagset) {
  return kDJatsDtds[tagset];
}

export const subarticleTemplatePath = formatResourcePath(
  "jats",
  join("pandoc", "subarticle", "template.xml"),
);

export type JatsTagset = "archiving" | "publishing" | "authoring";

export function xmlPlaceholder(token: string, input: string) {
  return `<!-- (F2ED4C6E)[${token}]:${input} -->`;
}

interface DTDInfo {
  name: string;
  location: string;
}

const kTagSets: Record<string, JatsTagset> = {
  "jats": "archiving",
  "jats_archiving": "archiving",
  "jats_publishing": "publishing",
  "jats_articleauthoring": "authoring",
};

const kDJatsDtds: Record<JatsTagset, DTDInfo> = {
  "archiving": {
    name:
      "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2 20190208//EN",
    location: "JATS-archivearticle1.dtd",
  },
  "publishing": {
    name: "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.2 20190208//EN",
    location: "JATS-publishing1.dtd",
  },
  "authoring": {
    name: "-//NLM//DTD JATS (Z39.96) Article Authoring DTD v1.2 20190208//EN",
    location: "JATS-articleauthoring1.dtd",
  },
};
