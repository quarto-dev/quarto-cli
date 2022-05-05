/*
* extension-version.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ExtensionVersion } from "./extension-shared.ts";

export function prettyVersion(version?: ExtensionVersion) {
  if (version) {
    return `${version.major}.${version.minor}.${version.build}.${version.revision}`;
  } else {
    return undefined;
  }
}

export function parseVersion(ver?: unknown) {
  // deno-lint-ignore no-explicit-any
  const verStr = ver ? (ver as any).toString() : undefined;
  if (verStr) {
    const verParts = verStr.split(".");
    const major = parseInt(verParts[0]);
    const minor = verParts.length > 1 ? parseInt(verParts[1]) : 0;
    const build = verParts.length > 2 ? parseInt(verParts[2]) : 0;
    const revision = verParts.length > 3 ? parseInt(verParts[3]) : 0;
    return {
      major,
      minor,
      build,
      revision,
    };
  } else {
    return undefined;
  }
}

export function compareVersions(
  version1: ExtensionVersion,
  version2: ExtensionVersion,
) {
  // -1 version1 is earlier
  // 0  versions are the same
  // 1  version1 is later
  if (version1.major > version2.major) {
    return 1;
  } else if (version1.major < version2.major) {
    return -1;
  }

  if (version1.minor > version2.minor) {
    return 1;
  } else if (version1.minor < version2.minor) {
    return -1;
  }

  if (version1.revision > version2.revision) {
    return 1;
  } else if (version1.revision < version2.revision) {
    return -1;
  }

  if (version1.build > version2.build) {
    return 1;
  } else if (version1.build < version2.build) {
    return -1;
  }

  return 0;
}
