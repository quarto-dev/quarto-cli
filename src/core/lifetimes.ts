/*
 * lifetimes.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { InternalError } from "./lib/error.ts";

export interface ObjectWithLifetime {
  cleanup(): Promise<void> | void;
}

type PromiseResolver = (value: Lifetime | PromiseLike<Lifetime>) => void;
const _globalLifetimes: Record<string, Lifetime> = {};
const _globalAwaitQueues: Record<string, PromiseResolver[]> = {};

export function waitUntilNamedLifetime(name: string): Promise<Lifetime> {
  const lt = getNamedLifetime(name);
  if (lt === undefined) {
    return Promise.resolve(createNamedLifetime(name));
  }

  // let reject: any; FIXME figure out what to do with rejects
  const promise = new Promise<Lifetime>((resolve) => {
    if (_globalAwaitQueues[name] === undefined) {
      _globalAwaitQueues[name] = [];
    }
    _globalAwaitQueues[name].push(resolve);
  });
  return promise;
}

export function createNamedLifetime(name: string): Lifetime {
  if (_globalLifetimes[name] !== undefined) {
    throw new InternalError(`Lifetime ${name} already exists.`);
  }
  const lifetime = new Lifetime();
  lifetime.attach({
    cleanup: () => {
      delete _globalLifetimes[name];
      if (_globalAwaitQueues[name] && _globalAwaitQueues[name].length) {
        const resolver = _globalAwaitQueues[name].shift()!;
        const newLifetime = createNamedLifetime(name);
        resolver(newLifetime);
      }
    },
  });
  _globalLifetimes[name] = lifetime;
  return lifetime;
}

export function getNamedLifetime(name: string): Lifetime | undefined {
  return _globalLifetimes[name];
}

export class Lifetime {
  _namedObjs: Record<string, ObjectWithLifetime>;
  _unnamedObjs: ObjectWithLifetime[];

  constructor() {
    this._namedObjs = {};
    this._unnamedObjs = [];
  }

  attach(obj: ObjectWithLifetime, key?: string) {
    if (key === undefined) {
      this._unnamedObjs.push(obj);
    } else {
      this._namedObjs[key] = obj;
    }
  }

  get(key: string): ObjectWithLifetime | undefined {
    return this._namedObjs[key];
  }

  async cleanup() {
    await Promise.all(this._unnamedObjs.map((x) => x.cleanup()));
    await Promise.all(Object.values(this._namedObjs).map((x) => x.cleanup()));
    this._namedObjs = {};
    this._unnamedObjs = [];
  }
}
