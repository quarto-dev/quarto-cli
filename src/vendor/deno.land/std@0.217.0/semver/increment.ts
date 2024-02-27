// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { parseBuild } from "./_shared.ts";
import type { ReleaseType, SemVer } from "./types.ts";

function bumpPrereleaseNumber(prerelease: ReadonlyArray<string | number> = []) {
  const values = [...prerelease];

  let index = values.length;
  while (index >= 0) {
    const value = values[index];
    if (typeof value === "number") {
      values[index] = value + 1;
      break;
    }
    index -= 1;
  }
  // if no number was bumped
  if (index === -1) values.push(0);

  return values;
}

function bumpPrerelease(
  prerelease: ReadonlyArray<string | number> = [],
  identifier: string | undefined,
) {
  let values = bumpPrereleaseNumber(prerelease);
  if (!identifier) return values;
  // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
  // 1.2.0-beta.foobar or 1.2.0-beta bumps to 1.2.0-beta.0
  if (values[0] !== identifier || isNaN(values[1] as number)) {
    values = [identifier, 0];
  }
  return values;
}

/**
 * Returns the new version resulting from an increment by release type.
 *
 * `premajor`, `preminor` and `prepatch` will bump the version up to the next version,
 * based on the type, and will also add prerelease metadata.
 *
 * If called from a non-prerelease version, the `prerelease` will work the same as
 * `prepatch`. The patch version is incremented and then is made into a prerelease. If
 * the input version is already a prerelease it will simply increment the prerelease
 * metadata.
 *
 * If a prerelease identifier is specified without a number then a number will be added.
 * For example `pre` will result in `pre.0`. If the existing version already has a
 * prerelease with a number and its the same prerelease identifier then the number
 * will be incremented. If the identifier differs from the new identifier then the new
 * identifier is applied and the number is reset to `0`.
 *
 * If the input version has build metadata it will be preserved on the resulting version
 * unless a new build parameter is specified. Specifying `""` will unset existing build
 * metadata.
 * @param version The version to increment
 * @param release The type of increment to perform
 * @param prerelease The pre-release metadata of the new version
 * @param build The build metadata of the new version
 * @returns
 */
export function increment(
  version: SemVer,
  release: ReleaseType,
  prerelease?: string,
  buildmetadata?: string,
): SemVer {
  const build = buildmetadata !== undefined
    ? parseBuild(buildmetadata)
    : version.build;

  switch (release) {
    case "premajor":
      return {
        major: version.major + 1,
        minor: 0,
        patch: 0,
        prerelease: bumpPrerelease(version.prerelease, prerelease),
        build,
      };
    case "preminor":
      return {
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
        prerelease: bumpPrerelease(version.prerelease, prerelease),
        build,
      };
    case "prepatch":
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
        prerelease: bumpPrerelease(version.prerelease, prerelease),
        build,
      };
    case "prerelease": {
      // If the input is a non-prerelease version, this acts the same as prepatch.
      const isPrerelease = (version.prerelease ?? []).length === 0;
      const patch = isPrerelease ? version.patch + 1 : version.patch;
      return {
        major: version.major,
        minor: version.minor,
        patch,
        prerelease: bumpPrerelease(version.prerelease, prerelease),
        build,
      };
    }
    case "major": {
      // If this is a pre-major version, bump up to the same major version. Otherwise increment major.
      // 1.0.0-5 bumps to 1.0.0
      // 1.1.0 bumps to 2.0.0
      const isPrerelease = (version.prerelease ?? []).length === 0;
      const major = isPrerelease || version.minor !== 0 || version.patch !== 0
        ? version.major + 1
        : version.major;
      return {
        major,
        minor: 0,
        patch: 0,
        prerelease: [],
        build,
      };
    }
    case "minor": {
      // If this is a pre-minor version, bump up to the same minor version. Otherwise increment minor.
      // 1.2.0-5 bumps to 1.2.0
      // 1.2.1 bumps to 1.3.0
      const isPrerelease = (version.prerelease ?? []).length === 0;
      const minor = isPrerelease || version.patch !== 0
        ? version.minor + 1
        : version.minor;
      return {
        major: version.major,
        minor,
        patch: 0,
        prerelease: [],
        build,
      };
    }
    case "patch": {
      // If this is not a pre-release version, it will increment the patch.
      // If it is a pre-release it will bump up to the same patch version.
      // 1.2.0-5 patches to 1.2.0
      // 1.2.0 patches to 1.2.1
      const isPrerelease = (version.prerelease ?? []).length === 0;
      const patch = isPrerelease ? version.patch + 1 : version.patch;
      return {
        major: version.major,
        minor: version.minor,
        patch,
        prerelease: [],
        build,
      };
    }
    case "pre": {
      // 1.0.0 "pre" would become 1.0.0-0
      // 1.0.0-0 would become 1.0.0-1
      // 1.0.0-beta.0 would be come 1.0.0-beta.1
      // switching the pre identifier resets the number to 0
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        prerelease: bumpPrerelease(version.prerelease, prerelease),
        build,
      };
    }
    default:
      throw new Error(`invalid increment argument: ${release}`);
  }
}
