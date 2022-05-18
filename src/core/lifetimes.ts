/*
* lifetimes.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

export interface ObjectWithLifetime {
  cleanup(): Promise<void> | void;
}

const _globalLifetimes: Record<string, Lifetime> = {};

export function createNamedLifetime(name: string): Lifetime {
  if (_globalLifetimes[name] !== undefined) {
    throw new Error(
      `Internal Error: cannot recreate existing named lifetime ${name}`,
    );
  }
  const lifetime = new Lifetime();
  lifetime.attach({
    cleanup: () => {
      delete _globalLifetimes[name];
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
