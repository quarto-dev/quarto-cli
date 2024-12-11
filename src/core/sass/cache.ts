/*
 * cache.ts
 *
 * A persistent cache for sass compilation based partly on Deno.KV.
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { InternalError } from "../lib/error.ts";
import { md5Hash } from "../hash.ts";
import { join } from "../../deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../deno_ral/fs.ts";
import { dartCompile } from "../dart-sass.ts";
import { TempContext } from "../temp.ts";
import { safeRemoveIfExists } from "../path.ts";
import * as log from "../../deno_ral/log.ts";
import { onCleanup } from "../cleanup.ts";

class SassCache {
  kv: Deno.Kv;
  path: string;

  constructor(kv: Deno.Kv, path: string) {
    this.kv = kv;
    this.path = path;
  }

  async getFromHash(
    hash: string,
    inputHash: string,
    force?: boolean,
  ): Promise<string | null> {
    log.debug(
      `SassCache.getFromHash(hash=${hash}, inputHash=${inputHash}, force=${force})`,
    );
    // verify that the hash is a valid md5 hash
    if (hash.length !== 32 || !/^[0-9a-f]{32}$/.test(hash)) {
      throw new InternalError(`Invalid hash length: ${hash.length}`);
    }

    const result = await this.kv.get(["entry", hash]);
    if (result.value === null) {
      log.debug(`  cache miss`);
      return null;
    }
    if (typeof result.value !== "object") {
      throw new InternalError(
        `Unsupported SassCache entry type\nExpected SassCacheEntry, got ${typeof result
          .value}`,
      );
    }
    const v = result.value as Record<string, unknown>;
    if (typeof v.key !== "string" || typeof v.hash !== "string") {
      throw new InternalError(
        `Unsupported SassCache entry type\nExpected SassCacheEntry, got ${typeof result
          .value}`,
      );
    }
    const outputFilePath = join(this.path, `${hash}.css`);

    // if the hash doesn't match the key, return null
    if ((v.hash !== inputHash && !force) || !existsSync(outputFilePath)) {
      if (v.hash !== inputHash) {
        log.debug(`  hash mismatch: ${v.hash} !== ${inputHash}`);
      } else if (force) {
        log.debug(`  forcing recomputation`);
      } else {
        log.debug(`  output file missing: ${outputFilePath}`);
      }
      return null;
    }

    log.debug(`  cache hit`);
    return outputFilePath;
  }

  async setFromHash(
    identifierHash: string,
    inputHash: string,
    cacheIdentifier: string,
    compilationThunk: (outputFilePath: string) => Promise<void>,
  ): Promise<string> {
    log.debug(`SassCache.setFromHash(${identifierHash}, ${inputHash}), ...`);
    const outputFilePath = join(this.path, `${identifierHash}.css`);
    try {
      await compilationThunk(outputFilePath);
    } catch (error) {
      // Compilation failed, so clear out the output file (if exists)
      // which will be invalid CSS
      try {
        safeRemoveIfExists(outputFilePath);
      } finally {
        // doesn't matter
      }
      throw error;
    }
    await this.kv.set(["entry", identifierHash], {
      key: cacheIdentifier,
      hash: inputHash,
    });
    return outputFilePath;
  }

  async set(
    input: string,
    cacheIdentifier: string,
    compilationThunk: (outputFilePath: string) => Promise<void>,
  ): Promise<string> {
    const identifierHash = md5Hash(cacheIdentifier);
    const inputHash = md5Hash(input);
    return this.setFromHash(
      identifierHash,
      inputHash,
      cacheIdentifier,
      compilationThunk,
    );
  }

  async getOrSet(
    input: string,
    cacheIdentifier: string,
    compilationThunk: (outputFilePath: string) => Promise<void>,
  ): Promise<string> {
    log.debug(`SassCache.getOrSet(...)`);
    const identifierHash = md5Hash(cacheIdentifier);
    const inputHash = md5Hash(input);
    const existing = await this.getFromHash(identifierHash, inputHash);
    if (existing !== null) {
      log.debug(`  cache hit`);
      return existing;
    }
    log.debug(`  cache miss, setting`);
    return this.setFromHash(
      identifierHash,
      inputHash,
      cacheIdentifier,
      compilationThunk,
    );
  }

  // add a cleanup method to register a cleanup handler
  cleanup(temp: TempContext | undefined) {
    const registerCleanup = temp ? temp.onCleanup : onCleanup;
    registerCleanup(() => {
      try {
        this.kv.close();
        if (temp) safeRemoveIfExists(this.path);
      } catch (error) {
        log.info(
          `Error occurred during sass cache cleanup for ${this.path}: ${error}`,
        );
      }
    });
  }
}

const currentSassCacheVersion = 1;

const requiredQuartoVersions: Record<number, string> = {
  1: "1.6.0",
};

async function checkVersion(kv: Deno.Kv, path: string) {
  const version = await kv.get(["version"]);
  if (version.value === null) {
    await kv.set(["version"], 1);
  } else {
    if (typeof version.value !== "number") {
      throw new Error(
        `Unsupported SassCache version type in ${path}\nExpected number, got ${typeof version
          .value}`,
      );
    }
    if (version.value < currentSassCacheVersion) {
      // in the future we should clean this automatically, but this is v1 and there should be
      // no old data anywhere.
      throw new Error(
        `Found outdated SassCache version. Please clear ${path}.`,
      );
    }
    if (version.value > currentSassCacheVersion) {
      throw new Error(
        `Found a SassCache version that's newer than supported. Please clear ${path} or upgrade Quarto to ${
          requiredQuartoVersions[currentSassCacheVersion]
        } or later.`,
      );
    }
  }
}

const _sassCache: Record<string, SassCache> = {};

export async function sassCache(
  path: string,
  temp: TempContext | undefined,
): Promise<SassCache> {
  if (!_sassCache[path]) {
    log.debug(`Creating SassCache at ${path}`);
    ensureDirSync(path);
    const kvFile = join(path, "sass.kv");
    const kv = await Deno.openKv(kvFile);
    await checkVersion(kv, kvFile);
    _sassCache[path] = new SassCache(kv, path);
    // register cleanup for this cache
    _sassCache[path].cleanup(temp);
  }
  log.debug(`Returning SassCache at ${path}`);
  const result = _sassCache[path];
  return result;
}
