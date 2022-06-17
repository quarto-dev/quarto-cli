/*
* extension-host.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

export interface ResolvedExtensionInfo {
  url: string;
  subdirectory?: string;
  owner?: string;
  learnMoreUrl?: string;
}

export type ExtensionNameResolver = (
  name: string,
) => ResolvedExtensionInfo | undefined;

export interface ExtensionSource {
  type: "remote" | "local";
  owner?: string;
  resolvedTarget: string;
  targetSubdir?: string;
  learnMoreUrl?: string;
}

export function extensionSource(target: string): ExtensionSource {
  if (existsSync(target)) {
    return { type: "local", resolvedTarget: target };
  } else {
    let resolved;
    for (const resolver of extensionHostResolvers) {
      resolved = resolver(target);
      if (resolved) {
        break;
      }
    }
    return {
      type: "remote",
      resolvedTarget: resolved?.url || target,
      owner: resolved?.owner,
      targetSubdir: resolved?.subdirectory,
      learnMoreUrl: resolved?.learnMoreUrl,
    };
  }
}

const githubNameRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)(?:@latest)?$/;
const githubLatest = (name: string) => {
  const match = name.match(githubNameRegex);
  if (match) {
    const url = `https://github.com/${match[1]}/${
      match[2]
    }/archive/refs/heads/main.tar.gz`;
    const learnMoreUrl = `https://github.com/${match[1]}/${match[2]}`;
    return {
      url,
      owner: match[1],
      subdirectory: subdirectory(url),
      learnMoreUrl,
    };
  } else {
    return undefined;
  }
};

const githubVersionRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)@v([a-zA-Z0-9-_\.]*)$/;
const githubVersion = (name: string) => {
  const match = name.match(githubVersionRegex);
  if (match) {
    const url = `https://github.com/${match[1]}/${
      match[2]
    }/archive/refs/tags/v${match[3]}.tar.gz`;
    const learnMoreUrl = `https://github.com/${match[1]}/${match[2]}`;
    return {
      url,
      owner: match[1],
      subdirectory: subdirectory(url),
      learnMoreUrl,
    };
  } else {
    return undefined;
  }
};

function subdirectory(url: string) {
  const tagMatch = url.match(githubTagRegexp);
  if (tagMatch) {
    return tagMatch[2] + "-" + tagMatch[3];
  } else {
    const latestMatch = url.match(githubLatestRegexp);
    if (latestMatch) {
      return latestMatch[2] + "-" + latestMatch[3];
    } else {
      return undefined;
    }
  }
}

const githubTagRegexp =
  /^http(?:s?):\/\/(?:www\.)?github.com\/(.*?)\/(.*?)\/archive\/refs\/tags\/(?:v?)(.*)(\.tar\.gz|\.zip)$/;
const githubLatestRegexp =
  /^http(?:s?):\/\/(?:www\.)?github.com\/(.*?)\/(.*?)\/archive\/refs\/heads\/(?:v?)(.*)(\.tar\.gz|\.zip)$/;

const extensionHostResolvers: ExtensionNameResolver[] = [
  githubLatest,
  githubVersion,
];
