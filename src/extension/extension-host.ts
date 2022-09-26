/*
* extension-host.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

export interface ResolvedExtensionInfo {
  // The url to the resolved extension
  url: string;

  // The Fetch Response from fetching that URL
  response: Promise<Response>;

  // The directory that should be used when attempting to extract
  // the extension from the resolved archive
  subdirectory?: string;

  // The owner information for this extension
  owner?: string;

  // The learn more url for this extension
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

function makeResolver(
  nameRegexp: RegExp,
  urlBuilder: (match: RegExpMatchArray) => string,
  subDirBuilder?: (match: RegExpMatchArray) => string | undefined,
): ExtensionNameResolver {
  return (name) => {
    const match = name.match(nameRegexp);
    if (!match) {
      return undefined;
    }
    const url = urlBuilder(match);
    const learnMoreUrl = `https://github.com/${match[1]}/${match[2]}`;
    const subdirectory = subDirBuilder ? subDirBuilder(match) : subDirBuilder;
    return {
      url,
      response: fetch(url),
      owner: match[1],
      subdirectory,
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
  (match) => {
    return `${match[2]}-main`;
  },
);

const githubPathTagRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)@([a-zA-Z0-9-_\.]*)$/;
const githubTag = makeResolver(
  githubPathTagRegex,
  (match) =>
    `https://github.com/${match[1]}/${match[2]}/archive/refs/tags/${
      match[3]
    }.tar.gz`,
  (match) => {
    return `${match[2]}-${tagSubDirectory(match[3])}`;
  },
);

const githubBranch = makeResolver(
  githubPathTagRegex, // this is also the same syntax for branches
  (match) =>
    `https://github.com/${match[1]}/${match[2]}/archive/refs/heads/${
      match[3]
    }.tar.gz`,
  (match) => {
    return `${match[2]}-${match[3]}`;
  },
);

const githubArchiveUrlRegex =
  /https?\:\/\/github.com\/([a-zA-Z0-9-_\.]+?)\/([a-zA-Z0-9-_\.]+?)\/archive\/refs\/heads\/(.+)(?:\.tar\.gz|\.zip)$/;
const githubArchiveUrl = makeResolver(
  githubArchiveUrlRegex,
  (match) => {
    return match[0];
  },
  (match) => {
    return `${match[2]}-${match[3]}`;
  },
);

const githubTagUrlRegex =
  /https?\:\/\/github.com\/([a-zA-Z0-9-_\.]+?)\/([a-zA-Z0-9-_\.]+?)\/archive\/refs\/tags\/(.+)(?:\.tar\.gz|\.zip)$/;
const githubArchiveTagUrl = makeResolver(
  githubTagUrlRegex,
  (match) => {
    return match[0];
  },
  (match) => {
    return `${match[2]}-${tagSubDirectory(match[3])}`;
  },
);

function tagSubDirectory(tag: string) {
  // Strip the leading 'v' from tag names
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

const kGithubResolvers = [
  githubLatest,
  githubTag,
  githubBranch,
  githubArchiveUrl,
  githubArchiveTagUrl,
];

// This just resolves unknown URLs that are not resolved
// by any other resolver (allowing for installation of extensions
// from arbitrary urls)
const unknownUrlResolver = (
  name: string,
): ResolvedExtensionInfo | undefined => {
  return {
    url: name,
    response: fetch(name),
  };
};

const extensionHostResolvers: ExtensionNameResolver[] = [
  ...kGithubResolvers,
  unknownUrlResolver,
];
