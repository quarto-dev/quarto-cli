/*
 * extension-host.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { isWindows } from "../core/platform.ts";

export interface ResolvedExtensionInfo {
  // The url to the resolved extension
  url: string;

  // The file part of the url resolved
  urlFile?: string;

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

export interface ExtensionSource {
  type: "remote" | "local";
  owner?: string;
  resolvedTarget: Response | string;
  resolvedFile?: string;
  targetSubdir?: string;
  learnMoreUrl?: string;
}

export async function extensionSource(
  target: string,
): Promise<ExtensionSource | undefined> {
  if (!target.match(/^https?:\/\/.*$/) && existsSync(target)) {
    return { type: "local", resolvedTarget: target };
  }

  for (const resolver of extensionHostResolvers) {
    const resolved = resolver(target);
    if (!resolved) {
      continue;
    }
    try {
      const response = await resolved.response;
      if (response.status === 200) {
        return {
          type: "remote",
          resolvedTarget: response,
          resolvedFile: resolved?.urlFile,
          owner: resolved?.owner,
          targetSubdir: resolved?.subdirectory,
          learnMoreUrl: resolved?.learnMoreUrl,
        };
      }
    } catch (err) {
      err.message =
        `A network error occurred when attempting to inspect the extension '${target}'. Please try again.\n\n` +
        err.message;
      throw err;
    }
  }

  return undefined;
}

type ExtensionNameResolver = (
  name: string,
) => ResolvedExtensionInfo | undefined;

// A single source for extensions (the name can be parsed)
// and turned into a url (for example, GitHub is a source)
interface ExtensionHostSource {
  parse(name: string): ExtensionHost | undefined;
  urlProviders: ExtensionUrlProvider[];
}

// The definition of an extension host which can be used to
// form a url
interface ExtensionHost {
  name: string;
  organization: string;
  repo: string;
  modifier?: string;
  subdirectory?: string;
}

// Converts a parsed extension host into a url
interface ExtensionUrlProvider {
  // The url from which to download the extension archive
  extensionUrl: (host: ExtensionHost) => string | undefined;
  // The subdirectory to use within the downloaded archive
  archiveSubdir: (host: ExtensionHost) => string | undefined;
  // The url the user may use to learn more
  learnMoreUrl: (host: ExtensionHost) => string | undefined;
}

const archiveExt = isWindows() ? ".zip" : ".tar.gz";

const githubLatestUrlProvider = {
  extensionUrl: (host: ExtensionHost) => {
    if (host.modifier === undefined || host.modifier === "latest") {
      return `https://github.com/${host.organization}/${host.repo}/archive/refs/heads/main${archiveExt}`;
    }
  },
  archiveSubdir: (host: ExtensionHost) => {
    const baseDir = `${host.repo}-main`;
    if (host.subdirectory) {
      return baseDir + "/" + host.subdirectory;
    } else {
      return baseDir;
    }
  },
  learnMoreUrl: (host: ExtensionHost) => {
    return `https://www.github.com/${host.organization}/${host.repo}`;
  },
};

const githubTagUrlProvider = {
  extensionUrl: (host: ExtensionHost) => {
    if (host.modifier) {
      return `https://github.com/${host.organization}/${host.repo}/archive/refs/tags/${host.modifier}${archiveExt}`;
    }
  },
  archiveSubdir: (host: ExtensionHost) => {
    const baseDir = `${host.repo}-${tagSubDirectory(host.modifier)}`;
    if (host.subdirectory) {
      return baseDir + "/" + host.subdirectory;
    } else {
      return baseDir;
    }
  },
  learnMoreUrl: (host: ExtensionHost) => {
    return `https://github.com/${host.organization}/${host.repo}/tree/${host.modifier}`;
  },
};

const githubBranchUrlProvider = {
  extensionUrl: (host: ExtensionHost) => {
    if (host.modifier) {
      return `https://github.com/${host.organization}/${host.repo}/archive/refs/heads/${host.modifier}${archiveExt}`;
    }
  },
  archiveSubdir: (host: ExtensionHost) => {
    const baseDir = `${host.repo}-${host.modifier}`;
    if (host.subdirectory) {
      return baseDir + "/" + host.subdirectory;
    } else {
      return baseDir;
    }
  },
  learnMoreUrl: (host: ExtensionHost) => {
    return `https://github.com/${host.organization}/${host.repo}/tree/${host.modifier}`;
  },
};

// The github extension source
const kGithubExtensionSource: ExtensionHostSource = {
  parse: (name: string) => {
    const match = name.match(kGithubExtensionNameRegex);
    if (match) {
      return {
        name,
        organization: match[1],
        repo: match[2],
        subdirectory: match[3],
        modifier: match[4],
      };
    } else {
      return undefined;
    }
  },
  urlProviders: [
    githubLatestUrlProvider,
    githubTagUrlProvider,
    githubBranchUrlProvider,
  ],
};
const kGithubExtensionNameRegex =
  /^([a-zA-Z0-9-_\.]*?)\/([a-zA-Z0-9-_\.]*?)(?:\/(.*?)\/?)?(?:@([a-zA-Z0-9-_\.]*))?$/;

const kGithubArchiveUrlSource: ExtensionHostSource = {
  parse: (name: string) => {
    const match = name.match(kGithubArchiveUrlRegex);
    if (match) {
      return {
        name,
        organization: match[1],
        repo: match[2],
        subdirectory: undefined, // Subdirectories aren't support for archive urls
        modifier: match[3],
      };
    } else {
      return undefined;
    }
  },
  urlProviders: [
    {
      extensionUrl: (host: ExtensionHost) => host.name,
      archiveSubdir: (host: ExtensionHost) => {
        return `${host.repo}-${tagSubDirectory(host.modifier)}`;
      },
      learnMoreUrl: (host: ExtensionHost) =>
        `https://www.github.com/${host.organization}/${host.repo}`,
    },
  ],
};

const kGithubArchiveUrlRegex =
  /https?\:\/\/github.com\/([a-zA-Z0-9-_\.]+?)\/([a-zA-Z0-9-_\.]+?)\/archive\/refs\/(?:tags|heads)\/(.+)(?:\.tar\.gz|\.zip)$/;

function tagSubDirectory(tag?: string) {
  // Strip the leading 'v' from tag names
  if (tag) {
    return tag.startsWith("v") ? tag.slice(1) : tag;
  } else {
    return tag;
  }
}

function makeResolvers(
  source: ExtensionHostSource,
): ExtensionNameResolver[] {
  return source.urlProviders.map((urlProvider) => {
    return (name) => {
      const host = source.parse(name);
      if (!host) {
        return undefined;
      }
      const url = urlProvider.extensionUrl(host);
      if (url) {
        return {
          url,
          urlFile: url.split("/").pop(),
          response: fetch(url),
          owner: host.organization,
          subdirectory: urlProvider.archiveSubdir(host),
          learnMoreUrl: urlProvider.learnMoreUrl(host),
        };
      } else {
        return undefined;
      }
    };
  });
}

const kGithubResolvers = [
  ...makeResolvers(kGithubExtensionSource),
  ...makeResolvers(kGithubArchiveUrlSource),
];

// This just resolves unknown URLs that are not resolved
// by any other resolver (allowing for installation of extensions
// from arbitrary urls)
const unknownUrlResolver = (
  name: string,
): ResolvedExtensionInfo | undefined => {
  try {
    new URL(name);
  } catch {
    // That isn't a url, sadly
    return undefined;
  }

  return {
    url: name,
    response: fetch(name),
  };
};

const extensionHostResolvers: ExtensionNameResolver[] = [
  ...kGithubResolvers,
  unknownUrlResolver,
];
