// Copyright Isaac Z. Schlueter and Contributors. All rights reserved. ISC license.
// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * The semantic version parser.
 *
 * Adapted directly from [semver](https://github.com/npm/node-semver).
 *
 * ## Versions
 *
 * A "version" is described by the `v2.0.0` specification found at
 * <https://semver.org>.
 *
 * A leading `"="` or `"v"` character is stripped off and ignored.
 *
 * ## Ranges
 *
 * A `version range` is a set of `comparators` which specify versions that satisfy
 * the range.
 *
 * A `comparator` is composed of an `operator` and a `version`. The set of
 * primitive `operators` is:
 *
 * - `<` Less than
 * - `<=` Less than or equal to
 * - `>` Greater than
 * - `>=` Greater than or equal to
 * - `=` Equal. If no operator is specified, then equality is assumed, so this
 *   operator is optional, but MAY be included.
 *
 * For example, the comparator `>=1.2.7` would match the versions `1.2.7`, `1.2.8`,
 * `2.5.3`, and `1.3.9`, but not the versions `1.2.6` or `1.1.0`.
 *
 * Comparators can be joined by whitespace to form a `comparator set`, which is
 * satisfied by the **intersection** of all of the comparators it includes.
 *
 * A range is composed of one or more comparator sets, joined by `||`. A version
 * matches a range if and only if every comparator in at least one of the
 * `||`-separated comparator sets is satisfied by the version.
 *
 * For example, the range `>=1.2.7 <1.3.0` would match the versions `1.2.7`,
 * `1.2.8`, and `1.2.99`, but not the versions `1.2.6`, `1.3.0`, or `1.1.0`.
 *
 * The range `1.2.7 || >=1.2.9 <2.0.0` would match the versions `1.2.7`, `1.2.9`,
 * and `1.4.6`, but not the versions `1.2.8` or `2.0.0`.
 *
 * ### Prerelease Tags
 *
 * If a version has a prerelease tag (for example, `1.2.3-alpha.3`) then it will
 * only be allowed to satisfy comparator sets if at least one comparator with the
 * same `[major, minor, patch]` tuple also has a prerelease tag.
 *
 * For example, the range `>1.2.3-alpha.3` would be allowed to match the version
 * `1.2.3-alpha.7`, but it would _not_ be satisfied by `3.4.5-alpha.9`, even though
 * `3.4.5-alpha.9` is technically "greater than" `1.2.3-alpha.3` according to the
 * SemVer sort rules. The version range only accepts prerelease tags on the `1.2.3`
 * version. The version `3.4.5` _would_ satisfy the range, because it does not have
 * a prerelease flag, and `3.4.5` is greater than `1.2.3-alpha.7`.
 *
 * The purpose for this behavior is twofold. First, prerelease versions frequently
 * are updated very quickly, and contain many breaking changes that are (by the
 * author"s design) not yet fit for public consumption. Therefore, by default, they
 * are excluded from range matching semantics.
 *
 * Second, a user who has opted into using a prerelease version has clearly
 * indicated the intent to use _that specific_ set of alpha/beta/rc versions. By
 * including a prerelease tag in the range, the user is indicating that they are
 * aware of the risk. However, it is still not appropriate to assume that they have
 * opted into taking a similar risk on the _next_ set of prerelease versions.
 *
 * Note that this behavior can be suppressed (treating all prerelease versions as
 * if they were normal versions, for the purpose of range matching) by setting the
 * `includePrerelease` flag on the options object to any [functions](#functions)
 * that do range matching.
 *
 * #### Prerelease Identifiers
 *
 * The method `.increment` takes an additional `identifier` string argument that
 * will append the value of the string as a prerelease identifier:
 *
 * ```javascript
 * semver.increment("1.2.3", "prerelease", "beta");
 * // "1.2.4-beta.0"
 * ```
 *
 * ### Build Metadata
 *
 * Build metadata has no affect on comparisons and must be a `.` delimited
 * alpha-numeric string. When parsing a version it is retained on the `build: string[]` field
 * of the semver instance. When incrementing there is an additional parameter that
 * can set the build metadata on the semver instance.
 *
 * To print the full version including build metadata you must call `semver.format({ style: "full" })`.
 *
 * For compatibility reasons the `.version` field will not contain the build metadata, you can only
 * get a full version string by calling the format function.
 *
 * ### Advanced Range Syntax
 *
 * Advanced range syntax desugars to primitive comparators in deterministic ways.
 *
 * Advanced ranges may be combined in the same way as primitive comparators using
 * white space or `||`.
 *
 * #### Hyphen Ranges `X.Y.Z - A.B.C`
 *
 * Specifies an inclusive set.
 *
 * - `1.2.3 - 2.3.4` := `>=1.2.3 <=2.3.4`
 *
 * If a partial version is provided as the first version in the inclusive range,
 * then the missing pieces are replaced with zeroes.
 *
 * - `1.2 - 2.3.4` := `>=1.2.0 <=2.3.4`
 *
 * If a partial version is provided as the second version in the inclusive range,
 * then all versions that start with the supplied parts of the tuple are accepted,
 * but nothing that would be greater than the provided tuple parts.
 *
 * - `1.2.3 - 2.3` := `>=1.2.3 <2.4.0`
 * - `1.2.3 - 2` := `>=1.2.3 <3.0.0`
 *
 * #### X-Ranges `1.2.x` `1.X` `1.2.*` `*`
 *
 * Any of `X`, `x`, or `*` may be used to "stand in" for one of the numeric values
 * in the `[major, minor, patch]` tuple.
 *
 * - `*` := `>=0.0.0` (Any version satisfies)
 * - `1.x` := `>=1.0.0 <2.0.0` (Matching major version)
 * - `1.2.x` := `>=1.2.0 <1.3.0` (Matching major and minor versions)
 *
 * A partial version range is treated as an X-Range, so the special character is in
 * fact optional.
 *
 * - `""` (empty string) := `*` := `>=0.0.0`
 * - `1` := `1.x.x` := `>=1.0.0 <2.0.0`
 * - `1.2` := `1.2.x` := `>=1.2.0 <1.3.0`
 *
 * #### Tilde Ranges `~1.2.3` `~1.2` `~1`
 *
 * Allows patch-level changes if a minor version is specified on the comparator.
 * Allows minor-level changes if not.
 *
 * - `~1.2.3` := `>=1.2.3 <1.(2+1).0` := `>=1.2.3 <1.3.0`
 * - `~1.2` := `>=1.2.0 <1.(2+1).0` := `>=1.2.0 <1.3.0` (Same as `1.2.x`)
 * - `~1` := `>=1.0.0 <(1+1).0.0` := `>=1.0.0 <2.0.0` (Same as `1.x`)
 * - `~0.2.3` := `>=0.2.3 <0.(2+1).0` := `>=0.2.3 <0.3.0`
 * - `~0.2` := `>=0.2.0 <0.(2+1).0` := `>=0.2.0 <0.3.0` (Same as `0.2.x`)
 * - `~0` := `>=0.0.0 <(0+1).0.0` := `>=0.0.0 <1.0.0` (Same as `0.x`)
 * - `~1.2.3-beta.2` := `>=1.2.3-beta.2 <1.3.0` Note that prereleases in the
 *   `1.2.3` version will be allowed, if they are greater than or equal to
 *   `beta.2`. So, `1.2.3-beta.4` would be allowed, but `1.2.4-beta.2` would not,
 *   because it is a prerelease of a different `[major, minor, patch]` tuple.
 *
 * #### Caret Ranges `^1.2.3` `^0.2.5` `^0.0.4`
 *
 * Allows changes that do not modify the left-most non-zero element in the
 * `[major, minor, patch]` tuple. In other words, this allows patch and minor
 * updates for versions `1.0.0` and above, patch updates for versions
 * `0.X >=0.1.0`, and _no_ updates for versions `0.0.X`.
 *
 * Many authors treat a `0.x` version as if the `x` were the major
 * "breaking-change" indicator.
 *
 * Caret ranges are ideal when an author may make breaking changes between `0.2.4`
 * and `0.3.0` releases, which is a common practice. However, it presumes that
 * there will _not_ be breaking changes between `0.2.4` and `0.2.5`. It allows for
 * changes that are presumed to be additive (but non-breaking), according to
 * commonly observed practices.
 *
 * - `^1.2.3` := `>=1.2.3 <2.0.0`
 * - `^0.2.3` := `>=0.2.3 <0.3.0`
 * - `^0.0.3` := `>=0.0.3 <0.0.4`
 * - `^1.2.3-beta.2` := `>=1.2.3-beta.2 <2.0.0` Note that prereleases in the
 *   `1.2.3` version will be allowed, if they are greater than or equal to
 *   `beta.2`. So, `1.2.3-beta.4` would be allowed, but `1.2.4-beta.2` would not,
 *   because it is a prerelease of a different `[major, minor, patch]` tuple.
 * - `^0.0.3-beta` := `>=0.0.3-beta <0.0.4` Note that prereleases in the `0.0.3`
 *   version _only_ will be allowed, if they are greater than or equal to `beta`.
 *   So, `0.0.3-pr.2` would be allowed.
 *
 * When parsing caret ranges, a missing `patch` value desugars to the number `0`,
 * but will allow flexibility within that value, even if the major and minor
 * versions are both `0`.
 *
 * - `^1.2.x` := `>=1.2.0 <2.0.0`
 * - `^0.0.x` := `>=0.0.0 <0.1.0`
 * - `^0.0` := `>=0.0.0 <0.1.0`
 *
 * A missing `minor` and `patch` values will desugar to zero, but also allow
 * flexibility within those values, even if the major version is zero.
 *
 * - `^1.x` := `>=1.0.0 <2.0.0`
 * - `^0.x` := `>=0.0.0 <1.0.0`
 *
 * ### Range Grammar
 *
 * Putting all this together, here is a Backus-Naur grammar for ranges, for the
 * benefit of parser authors:
 *
 * ```bnf
 * range-set  ::= range ( logical-or range ) *
 * logical-or ::= ( " " ) * "||" ( " " ) *
 * range      ::= hyphen | simple ( " " simple ) * | ""
 * hyphen     ::= partial " - " partial
 * simple     ::= primitive | partial | tilde | caret
 * primitive  ::= ( "<" | ">" | ">=" | "<=" | "=" ) partial
 * partial    ::= xr ( "." xr ( "." xr qualifier ? )? )?
 * xr         ::= "x" | "X" | "*" | nr
 * nr         ::= "0" | ["1"-"9"] ( ["0"-"9"] ) *
 * tilde      ::= "~" partial
 * caret      ::= "^" partial
 * qualifier  ::= ( "-" pre )? ( "+" build )?
 * pre        ::= parts
 * build      ::= parts
 * parts      ::= part ( "." part ) *
 * part       ::= nr | [-0-9A-Za-z]+
 * ```
 *
 * Note that, since ranges may be non-contiguous, a version might not be greater
 * than a range, less than a range, _or_ satisfy a range! For example, the range
 * `1.2 <1.2.9 || >2.0.0` would have a hole from `1.2.9` until `2.0.0`, so the
 * version `1.2.10` would not be greater than the range (because `2.0.1` satisfies,
 * which is higher), nor less than the range (since `1.2.8` satisfies, which is
 * lower), and it also does not satisfy the range.
 *
 * If you want to know if a version satisfies or does not satisfy a range, use the
 * {@linkcode satisfies} function.
 *
 * This module is browser compatible.
 *
 * @example
 * ```ts
 * import * as semver from "https://deno.land/std@$STD_VERSION/semver/mod.ts";
 *
 * semver.valid("1.2.3"); // "1.2.3"
 * semver.valid("a.b.c"); // null
 * semver.satisfies("1.2.3", "1.x || >=2.5.0 || 5.0.0 - 7.2.3"); // true
 * semver.gt("1.2.3", "9.8.7"); // false
 * semver.lt("1.2.3", "9.8.7"); // true
 * semver.minVersion(">=1.0.0"); // "1.0.0"
 * ```
 *
 * @module
 */

export type ReleaseType =
  | "pre"
  | "major"
  | "premajor"
  | "minor"
  | "preminor"
  | "patch"
  | "prepatch"
  | "prerelease";

export type Operator =
  | "==="
  | "!=="
  | ""
  | "="
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<=";

export interface Options {
  /**
   * Set to suppress the default behavior of excluding prerelease tagged
   * versions from ranges unless they are explicitly opted into.
   */
  includePrerelease?: boolean;
}

// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
export const SEMVER_SPEC_VERSION = "2.0.0";

const MAX_LENGTH = 256;

// The actual regexps
const re: RegExp[] = [];
const src: string[] = [];
let R = 0;

// The following Regular Expressions can be used for tokenizing,
// validating, and parsing SemVer version strings.

// ## Numeric Identifier
// A single `0`, or a non-zero digit followed by zero or more digits.

const NUMERICIDENTIFIER: number = R++;
src[NUMERICIDENTIFIER] = "0|[1-9]\\d*";

// ## Non-numeric Identifier
// Zero or more digits, followed by a letter or hyphen, and then zero or
// more letters, digits, or hyphens.

const NONNUMERICIDENTIFIER: number = R++;
src[NONNUMERICIDENTIFIER] = "\\d*[a-zA-Z-][a-zA-Z0-9-]*";

// ## Main Version
// Three dot-separated numeric identifiers.

const MAINVERSION: number = R++;
const nid = src[NUMERICIDENTIFIER];
src[MAINVERSION] = `(${nid})\\.(${nid})\\.(${nid})`;

// ## Pre-release Version Identifier
// A numeric identifier, or a non-numeric identifier.

const PRERELEASEIDENTIFIER: number = R++;
src[PRERELEASEIDENTIFIER] = "(?:" + src[NUMERICIDENTIFIER] + "|" +
  src[NONNUMERICIDENTIFIER] + ")";

// ## Pre-release Version
// Hyphen, followed by one or more dot-separated pre-release version
// identifiers.

const PRERELEASE: number = R++;
src[PRERELEASE] = "(?:-(" +
  src[PRERELEASEIDENTIFIER] +
  "(?:\\." +
  src[PRERELEASEIDENTIFIER] +
  ")*))";

// ## Build Metadata Identifier
// Any combination of digits, letters, or hyphens.

const BUILDIDENTIFIER: number = R++;
src[BUILDIDENTIFIER] = "[0-9A-Za-z-]+";

// ## Build Metadata
// Plus sign, followed by one or more period-separated build metadata
// identifiers.

const BUILD: number = R++;
src[BUILD] = "(?:\\+(" + src[BUILDIDENTIFIER] + "(?:\\." +
  src[BUILDIDENTIFIER] + ")*))";

// ## Full Version String
// A main version, followed optionally by a pre-release version and
// build metadata.

// Note that the only major, minor, patch, and pre-release sections of
// the version string are capturing groups.  The build metadata is not a
// capturing group, because it should not ever be used in version
// comparison.

const FULL: number = R++;
const FULLPLAIN = "v?" + src[MAINVERSION] + src[PRERELEASE] + "?" + src[BUILD] +
  "?";

src[FULL] = "^" + FULLPLAIN + "$";

const GTLT: number = R++;
src[GTLT] = "((?:<|>)?=?)";

// Something like "2.*" or "1.2.x".
// Note that "x.x" is a valid xRange identifer, meaning "any version"
// Only the first item is strictly required.
const XRANGEIDENTIFIER: number = R++;
src[XRANGEIDENTIFIER] = src[NUMERICIDENTIFIER] + "|x|X|\\*";

const XRANGEPLAIN: number = R++;
src[XRANGEPLAIN] = "[v=\\s]*(" +
  src[XRANGEIDENTIFIER] +
  ")" +
  "(?:\\.(" +
  src[XRANGEIDENTIFIER] +
  ")" +
  "(?:\\.(" +
  src[XRANGEIDENTIFIER] +
  ")" +
  "(?:" +
  src[PRERELEASE] +
  ")?" +
  src[BUILD] +
  "?" +
  ")?)?";

const XRANGE: number = R++;
src[XRANGE] = "^" + src[GTLT] + "\\s*" + src[XRANGEPLAIN] + "$";

// Tilde ranges.
// Meaning is "reasonably at or greater than"
const LONETILDE: number = R++;
src[LONETILDE] = "(?:~>?)";

const TILDE: number = R++;
src[TILDE] = "^" + src[LONETILDE] + src[XRANGEPLAIN] + "$";

// Caret ranges.
// Meaning is "at least and backwards compatible with"
const LONECARET: number = R++;
src[LONECARET] = "(?:\\^)";

const CARET: number = R++;
src[CARET] = "^" + src[LONECARET] + src[XRANGEPLAIN] + "$";

// A simple gt/lt/eq thing, or just "" to indicate "any version"
const COMPARATOR: number = R++;
src[COMPARATOR] = "^" + src[GTLT] + "\\s*(" + FULLPLAIN + ")$|^$";

// Something like `1.2.3 - 1.2.4`
const HYPHENRANGE: number = R++;
src[HYPHENRANGE] = "^\\s*(" +
  src[XRANGEPLAIN] +
  ")" +
  "\\s+-\\s+" +
  "(" +
  src[XRANGEPLAIN] +
  ")" +
  "\\s*$";

// Star ranges basically just allow anything at all.
const STAR: number = R++;
src[STAR] = "(<|>)?=?\\s*\\*";

// Compile to actual regexp objects.
// All are flag-free, unless they were created above with a flag.
for (let i = 0; i < R; i++) {
  if (!re[i]) {
    re[i] = new RegExp(src[i]);
  }
}

/**
 * Attempt to parse a string as a semantic version, returning either a `SemVer`
 * object or `null`.
 */
export function parse(
  version: string | SemVer | null,
  options?: Options,
): SemVer | null {
  if (typeof options !== "object") {
    options = {
      includePrerelease: false,
    };
  }

  if (version instanceof SemVer) {
    return version;
  }

  if (typeof version !== "string") {
    return null;
  }

  if (version.length > MAX_LENGTH) {
    return null;
  }

  const r: RegExp = re[FULL];
  if (!r.test(version)) {
    return null;
  }

  try {
    return new SemVer(version, options);
  } catch {
    return null;
  }
}

/** Returns the parsed version, or null if it's not valid. */
export function valid(
  version: string | SemVer | null,
  options?: Options,
): string | null {
  if (version === null) return null;
  const v: SemVer | null = parse(version, options);
  return v ? v.version : null;
}

export class SemVer {
  raw!: string;
  options!: Options;

  major!: number;
  minor!: number;
  patch!: number;
  version!: string;
  build!: ReadonlyArray<string>;
  prerelease!: Array<string | number>;

  constructor(version: string | SemVer, options?: Options) {
    if (typeof options !== "object") {
      options = {
        includePrerelease: false,
      };
    }
    if (version instanceof SemVer) {
      version = version.version;
    } else if (typeof version !== "string") {
      throw new TypeError("Invalid Version: " + version);
    }

    if (version.length > MAX_LENGTH) {
      throw new TypeError(
        "version is longer than " + MAX_LENGTH + " characters",
      );
    }

    if (!(this instanceof SemVer)) {
      return new SemVer(version, options);
    }

    this.options = options;

    const m = version.trim().match(re[FULL]);

    if (!m) {
      throw new TypeError("Invalid Version: " + version);
    }

    // these are actually numbers
    this.major = +m[1];
    this.minor = +m[2];
    this.patch = +m[3];

    if (this.major > Number.MAX_SAFE_INTEGER || this.major < 0) {
      throw new TypeError("Invalid major version");
    }

    if (this.minor > Number.MAX_SAFE_INTEGER || this.minor < 0) {
      throw new TypeError("Invalid minor version");
    }

    if (this.patch > Number.MAX_SAFE_INTEGER || this.patch < 0) {
      throw new TypeError("Invalid patch version");
    }

    // numberify any prerelease numeric ids
    if (!m[4]) {
      this.prerelease = [];
    } else {
      this.prerelease = m[4].split(".").map((id: string) => {
        if (/^[0-9]+$/.test(id)) {
          const num: number = +id;
          if (num >= 0 && num < Number.MAX_SAFE_INTEGER) {
            return num;
          }
        }
        return id;
      });
    }

    this.build = m[5] ? m[5].split(".") : [];
    this.format();
    this.raw = this.version;
  }

  format(
    opts: { style?: "release" | "prerelease" | "build" | "full" } = {},
  ): string {
    const { style } = opts;

    // todo: Consider a refactor of this class to have no side effects. Increment should return
    // a new SemVer instance with the new values. This would be a breaking change.
    // see https://github.com/denoland/deno_std/issues/3110 for discussion details
    const release = this.version = this.major + "." + this.minor + "." +
      this.patch;
    if (this.prerelease.length) {
      this.version += "-" + this.prerelease.join(".");
    }

    switch (style) {
      case "build":
        return [release, this.build.join(".")].filter((v) => v).join("+");
      case "full":
        return [this.version, this.build.join(".")].filter((v) => v).join("+");
      case "release":
        return release;
      case "prerelease":
        return this.version;
      default:
        // todo: Have this function return the full version by default. This would be a breaking change.
        // see this issue for discussion details https://github.com/denoland/deno_std/issues/3110
        return this.version;
    }
  }

  compare(other: string | SemVer): 1 | 0 | -1 {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    return this.compareMain(other) || this.comparePre(other);
  }

  compareMain(other: string | SemVer): 1 | 0 | -1 {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    return (
      compareIdentifiers(this.major, other.major) ||
      compareIdentifiers(this.minor, other.minor) ||
      compareIdentifiers(this.patch, other.patch)
    );
  }

  comparePre(other: string | SemVer): 1 | 0 | -1 {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    // NOT having a prerelease is > having one
    if (this.prerelease.length && !other.prerelease.length) {
      return -1;
    } else if (!this.prerelease.length && other.prerelease.length) {
      return 1;
    } else if (!this.prerelease.length && !other.prerelease.length) {
      return 0;
    }

    let i = 0;
    do {
      const a: string | number = this.prerelease[i];
      const b: string | number = other.prerelease[i];
      if (a === undefined && b === undefined) {
        return 0;
      } else if (b === undefined) {
        return 1;
      } else if (a === undefined) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareIdentifiers(a, b);
      }
    } while (++i);
    return 1;
  }

  compareBuild(other: string | SemVer): 1 | 0 | -1 {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    let i = 0;
    do {
      const a: string = this.build[i];
      const b: string = other.build[i];
      if (a === undefined && b === undefined) {
        return 0;
      } else if (b === undefined) {
        return 1;
      } else if (a === undefined) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareIdentifiers(a, b);
      }
    } while (++i);
    return 1;
  }

  increment(
    release: ReleaseType,
    identifier?: string,
    metadata?: string,
  ): SemVer {
    switch (release) {
      case "premajor":
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor = 0;
        this.major++;
        this.increment("pre", identifier);
        break;
      case "preminor":
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor++;
        this.increment("pre", identifier);
        break;
      case "prepatch":
        // If this is already a prerelease, it will bump to the next version
        // drop any prereleases that might already exist, since they are not
        // relevant at this point.
        this.prerelease.length = 0;
        this.increment("patch", identifier);
        this.increment("pre", identifier);
        break;
      // If the input is a non-prerelease version, this acts the same as
      // prepatch.
      case "prerelease":
        if (this.prerelease.length === 0) {
          this.increment("patch", identifier);
        }
        this.increment("pre", identifier);
        break;

      case "major":
        // If this is a pre-major version, bump up to the same major version.
        // Otherwise increment major.
        // 1.0.0-5 bumps to 1.0.0
        // 1.1.0 bumps to 2.0.0
        if (
          this.minor !== 0 ||
          this.patch !== 0 ||
          this.prerelease.length === 0
        ) {
          this.major++;
        }
        this.minor = 0;
        this.patch = 0;
        this.prerelease = [];
        break;
      case "minor":
        // If this is a pre-minor version, bump up to the same minor version.
        // Otherwise increment minor.
        // 1.2.0-5 bumps to 1.2.0
        // 1.2.1 bumps to 1.3.0
        if (this.patch !== 0 || this.prerelease.length === 0) {
          this.minor++;
        }
        this.patch = 0;
        this.prerelease = [];
        break;
      case "patch":
        // If this is not a pre-release version, it will increment the patch.
        // If it is a pre-release it will bump up to the same patch version.
        // 1.2.0-5 patches to 1.2.0
        // 1.2.0 patches to 1.2.1
        if (this.prerelease.length === 0) {
          this.patch++;
        }
        this.prerelease = [];
        break;
      // This probably shouldn't be used publicly.
      // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
      case "pre":
        if (this.prerelease.length === 0) {
          this.prerelease = [0];
        } else {
          let i: number = this.prerelease.length;
          while (--i >= 0) {
            if (typeof this.prerelease[i] === "number") {
              // deno-fmt-ignore
              (this.prerelease[i] as number)++;
              i = -2;
            }
          }
          if (i === -1) {
            // didn't increment anything
            this.prerelease.push(0);
          }
        }
        if (identifier) {
          // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
          // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
          if (this.prerelease[0] === identifier) {
            if (isNaN(this.prerelease[1] as number)) {
              this.prerelease = [identifier, 0];
            }
          } else {
            this.prerelease = [identifier, 0];
          }
        }
        break;

      default:
        throw new Error("invalid increment argument: " + release);
    }
    this.build = metadata === undefined ? this.build : metadata.split(".");
    this.format();
    this.raw = this.version;
    return this;
  }

  toString(): string {
    return this.version;
  }
}

/**
 * Returns the version incremented by the release type
 * (major, minor, patch, or prerelease), or null if it's not valid.
 *
 * `premajor` in one call will bump the version up to the next major version and
 * down to a prerelease of that major version. `preminor`, and `prepatch` work
 * the same way.
 *
 * If called from a non-prerelease version, the `prerelease` will work the same
 * as `prepatch`. It increments the patch version, then makes a prerelease. If
 * the input version is already a prerelease it simply increments it.
 *
 * If the original version has build metadata and the `metadata` parameter is
 * `undefined`, then it will be unchanged.
 */
export function increment(
  version: string | SemVer,
  release: ReleaseType,
  options?: Options,
  identifier?: string,
  metadata?: string,
): string | null {
  if (typeof options === "string") {
    metadata = identifier;
    identifier = options;
    options = undefined;
  }
  try {
    return new SemVer(version, options).increment(release, identifier, metadata)
      .format({ style: "full" });
  } catch {
    return null;
  }
}

/**
 * Returns difference between two versions by the release type  (`major`,
 * `premajor`, `minor`, `preminor`, `patch`, `prepatch`, or `prerelease`), or
 * null if the versions are the same.
 */
export function difference(
  version1: string | SemVer,
  version2: string | SemVer,
  options?: Options,
): ReleaseType | null {
  if (eq(version1, version2, options)) {
    return null;
  } else {
    const v1: SemVer | null = parse(version1);
    const v2: SemVer | null = parse(version2);
    let prefix = "";
    let defaultResult: ReleaseType | null = null;

    if (v1 && v2) {
      if (v1.prerelease.length || v2.prerelease.length) {
        prefix = "pre";
        defaultResult = "prerelease";
      }

      for (const key in v1) {
        if (key === "major" || key === "minor" || key === "patch") {
          if (v1[key] !== v2[key]) {
            return (prefix + key) as ReleaseType;
          }
        }
      }
    }
    return defaultResult; // may be undefined
  }
}

const numeric = /^[0-9]+$/;

export function compareIdentifiers(
  a: string | number | null,
  b: string | number | null,
): 1 | 0 | -1 {
  const anum: boolean = numeric.test(a as string);
  const bnum: boolean = numeric.test(b as string);

  if (a === null || b === null) throw "Comparison against null invalid";

  if (anum && bnum) {
    a = +a;
    b = +b;
  }

  return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
}

export function rcompareIdentifiers(
  a: string | null,
  b: string | null,
): 1 | 0 | -1 {
  return compareIdentifiers(b, a);
}

/** Returns the major version number. */
export function major(
  v: string | SemVer,
  options?: Options,
): number {
  return new SemVer(v, options).major;
}

/** Returns the minor version number. */
export function minor(
  v: string | SemVer,
  options?: Options,
): number {
  return new SemVer(v, options).minor;
}

/** Returns the patch version number. */
export function patch(
  v: string | SemVer,
  options?: Options,
): number {
  return new SemVer(v, options).patch;
}

/**
 * Returns `0` if `v1 == v2`, or `1` if `v1` is greater, or `-1` if `v2` is
 * greater. Sorts in ascending order if passed to `Array.sort()`,
 */
export function compare(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): 1 | 0 | -1 {
  return new SemVer(v1, options).compare(new SemVer(v2, options));
}

/**
 * The same as {@linkcode compare} but considers `build` when two versions are
 * equal. Sorts in ascending order if passed to `Array.sort()`.
 */
export function compareBuild(
  a: string | SemVer,
  b: string | SemVer,
  options?: Options,
): 1 | 0 | -1 {
  const versionA = new SemVer(a, options);
  const versionB = new SemVer(b, options);
  return versionA.compare(versionB) || versionA.compareBuild(versionB);
}

/**
 * Returns `0` if `v1 == v2`, or `-1` if `v1` is greater, or `1` if `v2` is
 * greater. Sorts in descending order if passed to `Array.sort()`,
 */
export function rcompare(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): 1 | 0 | -1 {
  return compare(v2, v1, options);
}

export function sort<T extends string | SemVer>(
  list: T[],
  options?: Options,
): T[] {
  return list.sort((a, b) => {
    return compareBuild(a, b, options);
  });
}

export function rsort<T extends string | SemVer>(
  list: T[],
  options?: Options,
): T[] {
  return list.sort((a, b) => {
    return compareBuild(b, a, options);
  });
}

/** Greater than comparison */
export function gt(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): boolean {
  return compare(v1, v2, options) > 0;
}

/** Less than comparison */
export function lt(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): boolean {
  return compare(v1, v2, options) < 0;
}

/**
 * This is true if they're logically equivalent, even if they're not the exact
 * same string.
 */
export function eq(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): boolean {
  return compare(v1, v2, options) === 0;
}

/**
 * This is true if they're not logically equivalent, even if they're the exact
 * same string.
 */
export function neq(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): boolean {
  return compare(v1, v2, options) !== 0;
}

/** Greater than or equal comparison */
export function gte(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): boolean {
  return compare(v1, v2, options) >= 0;
}

/** Less than or equal comparison */
export function lte(
  v1: string | SemVer,
  v2: string | SemVer,
  options?: Options,
): boolean {
  return compare(v1, v2, options) <= 0;
}

/**
 * Pass in a comparison string, and it'll call the corresponding comparison
 * function. `"==="` and `"!=="` do simple string comparison, but are included
 * for completeness. Throws if an invalid comparison string is provided.
 */
export function cmp(
  v1: string | SemVer,
  operator: Operator,
  v2: string | SemVer,
  options?: Options,
): boolean {
  switch (operator) {
    case "===":
      if (typeof v1 === "object") v1 = v1.version;
      if (typeof v2 === "object") v2 = v2.version;
      return v1 === v2;

    case "!==":
      if (typeof v1 === "object") v1 = v1.version;
      if (typeof v2 === "object") v2 = v2.version;
      return v1 !== v2;

    case "":
    case "=":
    case "==":
      return eq(v1, v2, options);

    case "!=":
      return neq(v1, v2, options);

    case ">":
      return gt(v1, v2, options);

    case ">=":
      return gte(v1, v2, options);

    case "<":
      return lt(v1, v2, options);

    case "<=":
      return lte(v1, v2, options);

    default:
      throw new TypeError("Invalid operator: " + operator);
  }
}

const ANY: SemVer = {} as SemVer;

export class Comparator {
  semver!: SemVer;
  operator!: "" | "=" | "<" | ">" | "<=" | ">=";
  value!: string;
  options!: Options;

  constructor(comp: string | Comparator, options?: Options) {
    if (typeof options !== "object") {
      options = {
        includePrerelease: false,
      };
    }

    if (comp instanceof Comparator) {
      return comp;
    }

    if (!(this instanceof Comparator)) {
      return new Comparator(comp, options);
    }

    this.options = options;
    this.parse(comp);

    if (this.semver === ANY) {
      this.value = "";
    } else {
      this.value = this.operator + this.semver.version;
    }
  }

  parse(comp: string) {
    const r = re[COMPARATOR];
    const m = comp.match(r);

    if (!m) {
      throw new TypeError("Invalid comparator: " + comp);
    }

    const m1 = m[1] as "" | "=" | "<" | ">" | "<=" | ">=";
    this.operator = m1 !== undefined ? m1 : "";

    if (this.operator === "=") {
      this.operator = "";
    }

    // if it literally is just '>' or '' then allow anything.
    if (!m[2]) {
      this.semver = ANY;
    } else {
      this.semver = new SemVer(m[2], this.options);
    }
  }

  test(version: string | SemVer): boolean {
    if (this.semver === ANY || version === ANY) {
      return true;
    }

    if (typeof version === "string") {
      version = new SemVer(version, this.options);
    }

    return cmp(version, this.operator, this.semver, this.options);
  }

  intersects(comp: Comparator, options?: Options): boolean {
    if (!(comp instanceof Comparator)) {
      throw new TypeError("a Comparator is required");
    }

    if (typeof options !== "object") {
      options = {
        includePrerelease: false,
      };
    }

    let rangeTmp: Range;

    if (this.operator === "") {
      if (this.value === "") {
        return true;
      }
      rangeTmp = new Range(comp.value, options);
      return satisfies(this.value, rangeTmp, options);
    } else if (comp.operator === "") {
      if (comp.value === "") {
        return true;
      }
      rangeTmp = new Range(this.value, options);
      return satisfies(comp.semver, rangeTmp, options);
    }

    const sameDirectionIncreasing: boolean =
      (this.operator === ">=" || this.operator === ">") &&
      (comp.operator === ">=" || comp.operator === ">");
    const sameDirectionDecreasing: boolean =
      (this.operator === "<=" || this.operator === "<") &&
      (comp.operator === "<=" || comp.operator === "<");
    const sameSemVer: boolean = this.semver.version === comp.semver.version;
    const differentDirectionsInclusive: boolean =
      (this.operator === ">=" || this.operator === "<=") &&
      (comp.operator === ">=" || comp.operator === "<=");
    const oppositeDirectionsLessThan: boolean =
      cmp(this.semver, "<", comp.semver, options) &&
      (this.operator === ">=" || this.operator === ">") &&
      (comp.operator === "<=" || comp.operator === "<");
    const oppositeDirectionsGreaterThan: boolean =
      cmp(this.semver, ">", comp.semver, options) &&
      (this.operator === "<=" || this.operator === "<") &&
      (comp.operator === ">=" || comp.operator === ">");

    return (
      sameDirectionIncreasing ||
      sameDirectionDecreasing ||
      (sameSemVer && differentDirectionsInclusive) ||
      oppositeDirectionsLessThan ||
      oppositeDirectionsGreaterThan
    );
  }

  toString(): string {
    return this.value;
  }
}

export class Range {
  range!: string;
  raw!: string;
  options!: Options;
  includePrerelease!: boolean;
  set!: ReadonlyArray<ReadonlyArray<Comparator>>;

  constructor(
    range: string | Range | Comparator,
    options?: Options,
  ) {
    if (typeof options !== "object") {
      options = {
        includePrerelease: false,
      };
    }

    if (range instanceof Range) {
      if (
        range.includePrerelease === !!options.includePrerelease
      ) {
        return range;
      } else {
        return new Range(range.raw, options);
      }
    }

    if (range instanceof Comparator) {
      return new Range(range.value, options);
    }

    if (!(this instanceof Range)) {
      return new Range(range, options);
    }

    this.options = options;
    this.includePrerelease = !!options.includePrerelease;

    // First, split based on boolean or ||
    this.raw = range;
    this.set = range
      .split(/\s*\|\|\s*/)
      .map((range) => this.parseRange(range.trim()))
      .filter((c) => {
        // throw out any that are not relevant for whatever reason
        return c.length;
      });

    if (!this.set.length) {
      throw new TypeError("Invalid SemVer Range: " + range);
    }

    this.format();
  }

  format(): string {
    this.range = this.set
      .map((comps) => comps.join(" ").trim())
      .join("||")
      .trim();
    return this.range;
  }

  parseRange(range: string): ReadonlyArray<Comparator> {
    range = range.trim();
    // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
    const hr: RegExp = re[HYPHENRANGE];
    range = range.replace(hr, hyphenReplace);

    // normalize spaces
    range = range.split(/\s+/).join(" ");

    // At this point, the range is completely trimmed and
    // ready to be split into comparators.

    const set: string[] = range
      .split(" ")
      .map((comp) => parseComparator(comp, this.options))
      .join(" ")
      .split(/\s+/);

    return set.map((comp) => new Comparator(comp, this.options));
  }

  test(version: string | SemVer): boolean {
    if (typeof version === "string") {
      version = new SemVer(version, this.options);
    }

    for (let i = 0; i < this.set.length; i++) {
      if (testSet(this.set[i], version, this.options)) {
        return true;
      }
    }
    return false;
  }

  intersects(range?: Range, options?: Options): boolean {
    if (!(range instanceof Range)) {
      throw new TypeError("a Range is required");
    }

    return this.set.some((thisComparators) => {
      return (
        isSatisfiable(thisComparators, options) &&
        range.set.some((rangeComparators) => {
          return (
            isSatisfiable(rangeComparators, options) &&
            thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(
                  rangeComparator,
                  options,
                );
              });
            })
          );
        })
      );
    });
  }

  toString(): string {
    return this.range;
  }
}

function testSet(
  set: ReadonlyArray<Comparator>,
  version: SemVer,
  options: Options,
): boolean {
  for (let i = 0; i < set.length; i++) {
    if (!set[i].test(version)) {
      return false;
    }
  }

  if (version.prerelease.length && !options.includePrerelease) {
    // Find the set of versions that are allowed to have prereleases
    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
    // That should allow `1.2.3-pr.2` to pass.
    // However, `1.2.4-alpha.notready` should NOT be allowed,
    // even though it's within the range set by the comparators.
    for (let i = 0; i < set.length; i++) {
      if (set[i].semver === ANY) {
        continue;
      }

      if (set[i].semver.prerelease.length > 0) {
        const allowed: SemVer = set[i].semver;
        if (
          allowed.major === version.major &&
          allowed.minor === version.minor &&
          allowed.patch === version.patch
        ) {
          return true;
        }
      }
    }

    // Version has a -pre, but it's not one of the ones we like.
    return false;
  }

  return true;
}

// take a set of comparators and determine whether there
// exists a version which can satisfy it
function isSatisfiable(
  comparators: readonly Comparator[],
  options?: Options,
): boolean {
  let result = true;
  const remainingComparators: Comparator[] = comparators.slice();
  let testComparator = remainingComparators.pop();

  while (result && remainingComparators.length) {
    result = remainingComparators.every((otherComparator) => {
      return testComparator?.intersects(otherComparator, options);
    });

    testComparator = remainingComparators.pop();
  }

  return result;
}

// Mostly just for testing and legacy API reasons
export function toComparators(
  range: string | Range,
  options?: Options,
): string[][] {
  return new Range(range, options).set.map((comp) => {
    return comp
      .map((c) => c.value)
      .join(" ")
      .trim()
      .split(" ");
  });
}

// comprised of xranges, tildes, stars, and gtlt's at this point.
// already replaced the hyphen ranges
// turn into a set of JUST comparators.
function parseComparator(comp: string, options: Options): string {
  comp = replaceCarets(comp, options);
  comp = replaceTildes(comp, options);
  comp = replaceXRanges(comp, options);
  comp = replaceStars(comp, options);
  return comp;
}

function isX(id: string): boolean {
  return !id || id.toLowerCase() === "x" || id === "*";
}

// ~, ~> --> * (any, kinda silly)
// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0
// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0
// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0
// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0
// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0
function replaceTildes(comp: string, options: Options): string {
  return comp
    .trim()
    .split(/\s+/)
    .map((comp) => replaceTilde(comp, options))
    .join(" ");
}

function replaceTilde(comp: string, _options: Options): string {
  const r: RegExp = re[TILDE];
  return comp.replace(
    r,
    (_: string, M: string, m: string, p: string, pr: string) => {
      let ret: string;

      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
      } else if (isX(p)) {
        // ~1.2 == >=1.2.0 <1.3.0
        ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
      } else if (pr) {
        ret = ">=" +
          M +
          "." +
          m +
          "." +
          p +
          "-" +
          pr +
          " <" +
          M +
          "." +
          (+m + 1) +
          ".0";
      } else {
        // ~1.2.3 == >=1.2.3 <1.3.0
        ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
      }

      return ret;
    },
  );
}

// ^ --> * (any, kinda silly)
// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0
// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0
// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0
// ^1.2.3 --> >=1.2.3 <2.0.0
// ^1.2.0 --> >=1.2.0 <2.0.0
function replaceCarets(comp: string, options: Options): string {
  return comp
    .trim()
    .split(/\s+/)
    .map((comp) => replaceCaret(comp, options))
    .join(" ");
}

function replaceCaret(comp: string, _options: Options): string {
  const r: RegExp = re[CARET];
  return comp.replace(r, (_: string, M, m, p, pr) => {
    let ret: string;

    if (isX(M)) {
      ret = "";
    } else if (isX(m)) {
      ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
    } else if (isX(p)) {
      if (M === "0") {
        ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
      } else {
        ret = ">=" + M + "." + m + ".0 <" + (+M + 1) + ".0.0";
      }
    } else if (pr) {
      if (M === "0") {
        if (m === "0") {
          ret = ">=" +
            M +
            "." +
            m +
            "." +
            p +
            "-" +
            pr +
            " <" +
            M +
            "." +
            m +
            "." +
            (+p + 1);
        } else {
          ret = ">=" +
            M +
            "." +
            m +
            "." +
            p +
            "-" +
            pr +
            " <" +
            M +
            "." +
            (+m + 1) +
            ".0";
        }
      } else {
        ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + (+M + 1) +
          ".0.0";
      }
    } else {
      if (M === "0") {
        if (m === "0") {
          ret = ">=" + M + "." + m + "." + p + " <" + M + "." + m + "." +
            (+p + 1);
        } else {
          ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
        }
      } else {
        ret = ">=" + M + "." + m + "." + p + " <" + (+M + 1) + ".0.0";
      }
    }

    return ret;
  });
}

function replaceXRanges(comp: string, options: Options): string {
  return comp
    .split(/\s+/)
    .map((comp) => replaceXRange(comp, options))
    .join(" ");
}

function replaceXRange(comp: string, _options: Options): string {
  comp = comp.trim();
  const r: RegExp = re[XRANGE];
  return comp.replace(r, (ret: string, gtlt, M, m, p, _pr) => {
    const xM: boolean = isX(M);
    const xm: boolean = xM || isX(m);
    const xp: boolean = xm || isX(p);
    const anyX: boolean = xp;

    if (gtlt === "=" && anyX) {
      gtlt = "";
    }

    if (xM) {
      if (gtlt === ">" || gtlt === "<") {
        // nothing is allowed
        ret = "<0.0.0";
      } else {
        // nothing is forbidden
        ret = "*";
      }
    } else if (gtlt && anyX) {
      // we know patch is an x, because we have any x at all.
      // replace X with 0
      if (xm) {
        m = 0;
      }
      p = 0;

      if (gtlt === ">") {
        // >1 => >=2.0.0
        // >1.2 => >=1.3.0
        // >1.2.3 => >= 1.2.4
        gtlt = ">=";
        if (xm) {
          M = +M + 1;
          m = 0;
          p = 0;
        } else {
          m = +m + 1;
          p = 0;
        }
      } else if (gtlt === "<=") {
        // <=0.7.x is actually <0.8.0, since any 0.7.x should
        // pass.  Similarly, <=7.x is actually <8.0.0, etc.
        gtlt = "<";
        if (xm) {
          M = +M + 1;
        } else {
          m = +m + 1;
        }
      }

      ret = gtlt + M + "." + m + "." + p;
    } else if (xm) {
      ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
    } else if (xp) {
      ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
    }

    return ret;
  });
}

// Because * is AND-ed with everything else in the comparator,
// and '' means "any version", just remove the *s entirely.
function replaceStars(comp: string, _options: Options): string {
  return comp.trim().replace(re[STAR], "");
}

// This function is passed to string.replace(re[HYPHENRANGE])
// M, m, patch, prerelease, build
// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
// 1.2.3 - 3.4 => >=1.2.0 <3.5.0 Any 3.4.x will do
// 1.2 - 3.4 => >=1.2.0 <3.5.0
function hyphenReplace(
  _$0: string,
  from: string,
  fM: string,
  fm: string,
  fp: string,
  _fpr: string,
  _fb: string,
  to: string,
  tM: string,
  tm: string,
  tp: string,
  tpr: string,
  _tb: string,
) {
  if (isX(fM)) {
    from = "";
  } else if (isX(fm)) {
    from = ">=" + fM + ".0.0";
  } else if (isX(fp)) {
    from = ">=" + fM + "." + fm + ".0";
  } else {
    from = ">=" + from;
  }

  if (isX(tM)) {
    to = "";
  } else if (isX(tm)) {
    to = "<" + (+tM + 1) + ".0.0";
  } else if (isX(tp)) {
    to = "<" + tM + "." + (+tm + 1) + ".0";
  } else if (tpr) {
    to = "<=" + tM + "." + tm + "." + tp + "-" + tpr;
  } else {
    to = "<=" + to;
  }

  return (from + " " + to).trim();
}

/** Returns true if the version satisfies the range. */
export function satisfies(
  version: string | SemVer,
  range: string | Range,
  options?: Options,
): boolean {
  try {
    range = new Range(range, options);
  } catch {
    return false;
  }
  return range.test(version);
}

/**
 * Returns the highest version in the list that satisfies the range, or `null`
 * if none of them do.
 */
export function maxSatisfying<T extends string | SemVer>(
  versions: ReadonlyArray<T>,
  range: string | Range,
  options?: Options,
): T | null {
  //todo
  let max: T | SemVer | null = null;
  let maxSV: SemVer | null = null;
  let rangeObj: Range;
  try {
    rangeObj = new Range(range, options);
  } catch {
    return null;
  }
  versions.forEach((v) => {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!max || (maxSV && maxSV.compare(v) === -1)) {
        // compare(max, v, true)
        max = v;
        maxSV = new SemVer(max, options);
      }
    }
  });
  return max;
}

/**
 * Returns the lowest version in the list that satisfies the range, or `null` if
 * none of them do.
 */
export function minSatisfying<T extends string | SemVer>(
  versions: ReadonlyArray<T>,
  range: string | Range,
  options?: Options,
): T | null {
  //todo
  let min: string | SemVer | null = null;
  let minSV: SemVer | null = null;
  let rangeObj: Range;
  try {
    rangeObj = new Range(range, options);
  } catch {
    return null;
  }
  versions.forEach((v) => {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!min || minSV!.compare(v) === 1) {
        // compare(min, v, true)
        min = v;
        minSV = new SemVer(min, options);
      }
    }
  });
  return min;
}

/** Returns the lowest version that can possibly match the given range. */
export function minVersion(
  range: string | Range,
  options?: Options,
): SemVer | null {
  range = new Range(range, options);

  let minver: SemVer | null = new SemVer("0.0.0");
  if (range.test(minver)) {
    return minver;
  }

  minver = new SemVer("0.0.0-0");
  if (range.test(minver)) {
    return minver;
  }

  minver = null;
  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i];

    comparators.forEach((comparator) => {
      // Clone to avoid manipulating the comparator's semver object.
      const compver = new SemVer(comparator.semver.version);
      switch (comparator.operator) {
        case ">":
          if (compver.prerelease.length === 0) {
            compver.patch++;
          } else {
            compver.prerelease.push(0);
          }
          compver.raw = compver.format();
        /* fallthrough */
        case "":
        case ">=":
          if (!minver || gt(minver, compver)) {
            minver = compver;
          }
          break;
        case "<":
        case "<=":
          /* Ignore maximum versions */
          break;
        /* istanbul ignore next */
        default:
          throw new Error("Unexpected operation: " + comparator.operator);
      }
    });
  }

  if (minver && range.test(minver)) {
    return minver;
  }

  return null;
}

/** Returns the valid range or null if it's not valid. */
export function validRange(
  range: string | Range | null,
  options?: Options,
): string | null {
  try {
    if (range === null) return null;
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return new Range(range, options).range || "*";
  } catch {
    return null;
  }
}

/**
 * Returns true if version is less than all the versions possible in the range.
 */
export function ltr(
  version: string | SemVer,
  range: string | Range,
  options?: Options,
): boolean {
  return outside(version, range, "<", options);
}

/**
 * Returns true if version is greater than all the versions possible in the range.
 */
export function gtr(
  version: string | SemVer,
  range: string | Range,
  options?: Options,
): boolean {
  return outside(version, range, ">", options);
}

/**
 * Returns true if the version is outside the bounds of the range in either the
 * high or low direction. The hilo argument must be either the string '>' or
 * '<'. (This is the function called by {@linkcode gtr} and {@linkcode ltr}.)
 */
export function outside(
  version: string | SemVer,
  range: string | Range,
  hilo: ">" | "<",
  options?: Options,
): boolean {
  version = new SemVer(version, options);
  range = new Range(range, options);

  let gtfn: typeof gt;
  let ltefn: typeof lte;
  let ltfn: typeof lt;
  let comp: string;
  let ecomp: string;
  switch (hilo) {
    case ">":
      gtfn = gt;
      ltefn = lte;
      ltfn = lt;
      comp = ">";
      ecomp = ">=";
      break;
    case "<":
      gtfn = lt;
      ltefn = gte;
      ltfn = gt;
      comp = "<";
      ecomp = "<=";
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }

  // If it satisifes the range it is not outside
  if (satisfies(version, range, options)) {
    return false;
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (let i = 0; i < range.set.length; ++i) {
    const comparators: readonly Comparator[] = range.set[i];

    let high: Comparator | null = null;
    let low: Comparator | null = null;

    for (let comparator of comparators) {
      if (comparator.semver === ANY) {
        comparator = new Comparator(">=0.0.0");
      }
      high = high || comparator;
      low = low || comparator;
      if (gtfn(comparator.semver, high.semver, options)) {
        high = comparator;
      } else if (ltfn(comparator.semver, low.semver, options)) {
        low = comparator;
      }
    }

    if (high === null || low === null) return true;

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high!.operator === comp || high!.operator === ecomp) {
      return false;
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if (
      (!low!.operator || low!.operator === comp) &&
      ltefn(version, low!.semver)
    ) {
      return false;
    } else if (low!.operator === ecomp && ltfn(version, low!.semver)) {
      return false;
    }
  }
  return true;
}

/**
 * Returns an array of prerelease components, or null if none exist.
 *
 * @example
 * `prerelease("1.2.3-alpha.1") -> ["alpha", 1]`
 */
export function prerelease(
  version: string | SemVer,
  options?: Options,
): ReadonlyArray<string | number> | null {
  const parsed = parse(version, options);
  return parsed && parsed.prerelease.length ? parsed.prerelease : null;
}

/** Returns true if the two supplied ranges or comparators intersect. */
export function intersects(
  range1: string | Range | Comparator,
  range2: string | Range | Comparator,
  options?: Options,
): boolean {
  range1 = new Range(range1, options);
  range2 = new Range(range2, options);
  return range1.intersects(range2);
}

export default SemVer;
