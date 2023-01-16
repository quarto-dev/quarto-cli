// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.

// The following are all the process APIs that don't depend on the stream module
// They have to be split this way to prevent a circular dependency

import { isWindows } from "../../_util/os.ts";
import { nextTick as _nextTick } from "../_next_tick.ts";
import { _exiting } from "./exiting.ts";

/** Returns the operating system CPU architecture for which the Deno binary was compiled */
function _arch(): string {
  if (Deno.build.arch == "x86_64") {
    return "x64";
  } else if (Deno.build.arch == "aarch64") {
    return "arm64";
  } else {
    throw Error("unreachable");
  }
}

/** https://nodejs.org/api/process.html#process_process_arch */
export const arch = _arch();

/** https://nodejs.org/api/process.html#process_process_chdir_directory */
export const chdir = Deno.chdir;

/** https://nodejs.org/api/process.html#process_process_cwd */
export const cwd = Deno.cwd;

/** https://nodejs.org/api/process.html#process_process_nexttick_callback_args */
export const nextTick = _nextTick;

/** Wrapper of Deno.env.get, which doesn't throw type error when
 * the env name has "=" or "\0" in it. */
function denoEnvGet(name: string) {
  try {
    return Deno.env.get(name);
  } catch (e) {
    if (e instanceof TypeError) {
      return undefined;
    }
    throw e;
  }
}

const OBJECT_PROTO_PROP_NAMES = Object.getOwnPropertyNames(Object.prototype);
/**
 * https://nodejs.org/api/process.html#process_process_env
 * Requires env permissions
 */
export const env: InstanceType<ObjectConstructor> & Record<string, string> =
  new Proxy(Object(), {
    get: (target, prop) => {
      if (typeof prop === "symbol") {
        return target[prop];
      }

      const envValue = denoEnvGet(prop);

      if (envValue) {
        return envValue;
      }

      if (OBJECT_PROTO_PROP_NAMES.includes(prop)) {
        return target[prop];
      }

      return envValue;
    },
    ownKeys: () => Reflect.ownKeys(Deno.env.toObject()),
    getOwnPropertyDescriptor: (_target, name) => {
      const value = denoEnvGet(String(name));
      if (value) {
        return {
          enumerable: true,
          configurable: true,
          value,
        };
      }
    },
    set(_target, prop, value) {
      Deno.env.set(String(prop), String(value));
      return true; // success
    },
    has: (_target, prop) => typeof denoEnvGet(String(prop)) === "string",
  });

/** https://nodejs.org/api/process.html#process_process_pid */
export const pid = Deno.pid;

/** https://nodejs.org/api/process.html#process_process_platform */
export const platform = isWindows ? "win32" : Deno.build.os;

/**
 * https://nodejs.org/api/process.html#process_process_version
 *
 * This value is hard coded to latest stable release of Node, as
 * some packages are checking it for compatibility. Previously
 * it pointed to Deno version, but that led to incompability
 * with some packages.
 */
export const version = "v16.17.0";

/**
 * https://nodejs.org/api/process.html#process_process_versions
 *
 * This value is hard coded to latest stable release of Node, as
 * some packages are checking it for compatibility. Previously
 * it contained only output of `Deno.version`, but that led to incompability
 * with some packages. Value of `v8` field is still taken from `Deno.version`.
 */
export const versions = {
  node: "16.17.0",
  uv: "1.43.0",
  zlib: "1.2.11",
  brotli: "1.0.9",
  ares: "1.18.1",
  modules: "93",
  nghttp2: "1.47.0",
  napi: "8",
  llhttp: "6.0.7",
  openssl: "1.1.1q+quic",
  cldr: "41.0",
  icu: "71.1",
  tz: "2022a",
  unicode: "14.0",
  ...Deno.version,
};
