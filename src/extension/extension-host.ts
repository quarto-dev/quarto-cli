/*
* extension-host.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

export interface ResolvedExtensionInfo {
  url: string;
  response: Promise<Response>;
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
  resolvedTarget: Response | string;
  targetSubdir?: string;
  learnMoreUrl?: string;
}

export async function extensionSource(
  target: string,
): Promise<ExtensionSource | undefined> {
  if (existsSync(target)) {
    return { type: "local", resolvedTarget: target };
  }

  for (const resolver of extensionHostResolvers) {
    const resolved = resolver(target);
    if (!resolved) {
      continue;
    }
    const response = await resolved.response;
    if (response.status === 200) {
      return {
        type: "remote",
        resolvedTarget: response,
        owner: resolved?.owner,
        targetSubdir: resolved?.subdirectory,
        learnMoreUrl: resolved?.learnMoreUrl,
      };
    }
  }
  return undefined;
}

const githubUrlTagRegexp =
  /^http(?:s?):\/\/(?:www\.)?github.com\/(.*?)\/(.*?)\/archive\/refs\/tags\/(.*)(\.tar\.gz|\.zip)$/;
const githubUrlLatestOrBranchRegexp =
  /^http(?:s?):\/\/(?:www\.)?github.com\/(.*?)\/(.*?)\/archive\/refs\/heads\/(.*)(\.tar\.gz|\.zip)$/;
function subdirectory(url: string) {
  const tagMatch = url.match(githubUrlTagRegexp);
  if (tagMatch) {
    return tagMatch[2] + "-" + tagMatch[3];
  } else {
    const latestMatch = url.match(githubUrlLatestOrBranchRegexp);
    if (!latestMatch) {
      return undefined;
    }
    return latestMatch[2] + "-" + latestMatch[3];
  }
}

function makeResolver(
  nameRegexp: RegExp,
  urlBuilder: ((match: RegExpMatchArray) => string),
): ExtensionNameResolver {
  return (name) => {
    const match = name.match(nameRegexp);
    if (!match) {
      return undefined;
    }
    const url = urlBuilder(match);
    const learnMoreUrl = `https://github.com/${match[1]}/${match[2]}`;
    return {
      url,
      response: fetch(url),
      owner: match[1],
      subdirectory: subdirectory(url),
      learnMoreUrl,
    };
  };
}

const githubNameRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)(?:@latest)?$/;
const githubLatest = makeResolver(
  githubNameRegex,
  (match) =>
    `https://github.com/${match[1]}/${match[2]}/archive/refs/heads/main.tar.gz`,
);

const githubPathTagRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)@([a-zA-Z0-9-_\.]*)$/;
const githubTag = makeResolver(
  githubPathTagRegex,
  (match) =>
    `https://github.com/${match[1]}/${match[2]}/archive/refs/tags/${
      match[3]
    }.tar.gz`,
);

const githubBranch = makeResolver(
  githubPathTagRegex, // this is also the same syntax for branches
  (match) =>
    `https://github.com/${match[1]}/${match[2]}/archive/refs/heads/${
      match[3]
    }.tar.gz`,
);

const extensionHostResolvers: ExtensionNameResolver[] = [
  githubLatest,
  githubTag,
  githubBranch,
];
