/*
 * cache.ts
 *
 * A persistent cache for projects
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { ensureDirSync } from "../../deno_ral/fs.ts";
import { join } from "../../deno_ral/path.ts";
import { md5HashBytes } from "../hash.ts";
import { satisfies } from "semver/mod.ts";
import { quartoConfig } from "../quarto.ts";
import { CacheIndexEntry, ProjectCache } from "./cache-types.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  type DiskCacheEntry,
  type ImmediateBufferCacheEntry,
  type ImmediateStringCacheEntry,
} from "./cache-types.ts";
import { Cloneable } from "../safe-clone-deep.ts";
export { type ProjectCache } from "./cache-types.ts";

const currentCacheVersion = "1";
const requiredQuartoVersions: Record<string, string> = {
  "1": ">1.7.0",
};

class ProjectCacheImpl implements Cloneable<ProjectCacheImpl> {
  projectScratchDir: string;
  index: Deno.Kv | null;

  constructor(_projectScratchDir: string) {
    this.projectScratchDir = _projectScratchDir;
    this.index = null;
  }

  clone() {
    return this;
  }

  close() {
    if (this.index) {
      this.index.close();
      this.index = null;
    }
  }

  async clear(): Promise<void> {
    assert(this.index);
    const entries = this.index.list({ prefix: [] });
    for await (const entry of entries) {
      const diskValue = entry.value;
      if (entry.key[0] !== "version") {
        Deno.removeSync(
          join(this.projectScratchDir, "project-cache", diskValue as string),
        );
      }
      await this.index.delete(entry.key);
    }
  }

  async createOnDisk(): Promise<void> {
    assert(this.index);
    this.index.set(["version"], currentCacheVersion);
  }

  async init(): Promise<void> {
    const indexPath = join(this.projectScratchDir, "project-cache");
    ensureDirSync(indexPath);
    this.index = await Deno.openKv(join(indexPath, "deno-kv-file"));
    let version = await this.index.get(["version"]);
    if (version.value === null) {
      await this.createOnDisk();
      version = await this.index.get(["version"]);
    }
    assert(typeof version.value === "string");
    const requiredVersion = requiredQuartoVersions[version.value];
    if (
      !requiredVersion || !satisfies(quartoConfig.version(), requiredVersion)
    ) {
      console.warn("Unknown project cache version.");
      console.warn(
        "Project cache was likely created by a newer version of Quarto.",
      );
      console.warn("Quarto will clear the project cache.");
      await this.clear();
      await this.createOnDisk();
    }
  }

  async addBuffer(key: string[], value: Uint8Array): Promise<void> {
    assert(this.index);
    const hash = await md5HashBytes(value);
    Deno.writeFileSync(
      join(this.projectScratchDir, "project-cache", hash),
      value,
    );
    const result = await this.index.set(key, {
      hash,
      type: "buffer",
    });
    assert(result.ok);
  }

  async addString(key: string[], value: string): Promise<void> {
    assert(this.index);
    const buffer = new TextEncoder().encode(value);
    const hash = await md5HashBytes(buffer);
    Deno.writeTextFileSync(
      join(this.projectScratchDir, "project-cache", hash),
      value,
    );
    const result = await this.index.set(key, {
      hash,
      type: "string",
    });
    assert(result.ok);
  }

  async addSmallBuffer(key: string[], value: Uint8Array): Promise<void> {
    assert(this.index);
    const result = await this.index.set(key, {
      value,
      type: "buffer-immediate",
    });
    assert(result.ok);
  }

  async addSmallString(key: string[], value: string): Promise<void> {
    assert(this.index);
    const result = await this.index.set(key, {
      value,
      type: "string-immediate",
    });
    assert(result.ok);
  }

  async get(key: string[]): Promise<CacheIndexEntry | null> {
    assert(this.index);
    const kvResult = await this.index.get(key);
    if (kvResult.value === null) {
      return null;
    }
    return kvResult.value as CacheIndexEntry;
  }

  async _getAs<T>(
    key: string[],
    getter: (hash: CacheIndexEntry) => T,
  ): Promise<T | null> {
    assert(this.index);
    const result = await this.get(key);
    if (result === null) {
      return null;
    }
    try {
      return getter(result);
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        throw e;
      }
      console.warn(
        `Entry ${result} not found -- clearing entry in index`,
      );
      await this.index.delete(key);
      return null;
    }
  }

  async getSmallString(key: string[]): Promise<string | null> {
    return this._getAs(key, (result) => {
      assert(result.type === "string-immediate", "Expected string");
      return (result as ImmediateStringCacheEntry).value;
    });
  }

  async getSmallBuffer(key: string[]): Promise<Uint8Array | null> {
    return this._getAs(key, (result) => {
      assert(result.type === "buffer-immediate", "Expected buffer");
      return (result as ImmediateBufferCacheEntry).value;
    });
  }

  async getBuffer(key: string[]): Promise<Uint8Array | null> {
    return this._getAs(key, (result) => {
      assert(result.type === "buffer", "Expected buffer");
      const { hash } = result as DiskCacheEntry;
      return Deno.readFileSync(
        join(this.projectScratchDir, "project-cache", hash),
      );
    });
  }

  async getString(key: string[]): Promise<string | null> {
    return this._getAs(key, (result) => {
      assert(result.type === "string", "Expected string");
      const { hash } = result as DiskCacheEntry;
      return Deno.readTextFileSync(
        join(this.projectScratchDir, "project-cache", hash),
      );
    });
  }

  memoizeStringFunction(
    key: string[],
    fn: (param: string) => Promise<string>,
  ): (param: string) => Promise<string> {
    return async (param: string) => {
      const paramHash = await md5HashBytes(new TextEncoder().encode(param));
      const memoizationKey = [...key, paramHash];
      const cached = await this.getString(memoizationKey);
      if (cached !== null) {
        return cached;
      }
      const result = await fn(param);
      await this.addString(memoizationKey, result);
      return result;
    };
  }
}

export const createProjectCache = async (
  projectScratchDir: string,
): Promise<ProjectCache> => {
  const result = new ProjectCacheImpl(projectScratchDir);
  await result.init();
  return result as ProjectCache;
};

export const memoizeStringFunction = (
  key: string[],
  fn: (param: string) => Promise<string>,
): (project: ProjectContext, param: string) => Promise<string> => {
  return async (project: ProjectContext, param: string) => {
    return (project.diskCache as ProjectCacheImpl).memoizeStringFunction(
      key,
      fn,
    )(param);
  };
};
