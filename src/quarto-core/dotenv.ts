/*
* dotenv.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { load, stringify } from "dotenv/mod.ts";
import { join } from "path/mod.ts";
import { safeExistsSync } from "../core/path.ts";
import { isEqual } from "../core/lodash.ts";
import { globalTempContext } from "../core/temp.ts";
import { existsSync } from "fs/exists.ts";
import { activeProfiles, kQuartoProfile } from "./profile.ts";

const kQuartoEnv = "_environment";
const kQuartoEnvLocal = `${kQuartoEnv}.local`;
const kQuartoEnvRequired = `${kQuartoEnv}.required`;

// read the QUARTO_PROFILE from dotenv if it's there
export async function dotenvQuartoProfile(projectDir: string) {
  // read config
  const conf = await load({
    defaultsPath: join(projectDir, kQuartoEnv),
    envPath: join(projectDir, kQuartoEnvLocal),
  });

  // return profile if we have it
  return conf[kQuartoProfile];
}

// process dotenv files -- note that we track the processing we have done
// previously and we back it out when we are called to re-process (as might
// occur on a re-render in quarto)
const dotenvVariablesSet: string[] = [];

// https://github.com/denoland/deno_std/pull/3134/files#diff-7d23db8c4e8837b2e3de75397b39d08efea4d5eddc00c7e0c36571d9c2514c8dL96
type DotenvConfig = Record<string, string>;

// track previous variables defined (used to trigger event indicating a change)
let prevDotenvVariablesDefined: DotenvConfig | undefined;

export async function dotenvSetVariables(projectDir: string) {
  // back out any previous variables set (and note firstRun)
  dotenvVariablesSet.forEach(Deno.env.delete);
  dotenvVariablesSet.splice(0, dotenvVariablesSet.length);

  // form a list of dotenv files we might read, filter by existence, then
  // reverse it (so we read and apply them in priority order)
  const dotenvFiles = [
    join(projectDir, kQuartoEnv),
    ...activeProfiles().reverse().map((profile) =>
      join(projectDir, `_environment-${profile}`)
    ),
    join(projectDir, kQuartoEnvLocal),
  ].filter(safeExistsSync).reverse();

  // read the dot env files in turn, track variables defined for validation
  const dotenvVariablesDefined: DotenvConfig = {};
  for (const dotenvFile of dotenvFiles) {
    const conf = await load({ envPath: dotenvFile });
    for (const key in conf) {
      // set into environment (and track that we did so for reversing out later)
      if (Deno.env.get(key) === undefined) {
        Deno.env.set(key, conf[key]);
        dotenvVariablesSet.push(key);
      }
      // track all defined variables (for validation against example)
      if (dotenvVariablesDefined[key] === undefined) {
        dotenvVariablesDefined[key] = conf[key];
      }
    }
  }

  // validate against example if it exists
  const dotenvRequired = join(projectDir, kQuartoEnvRequired);
  if (existsSync(dotenvRequired)) {
    const definedEnvTempPath = globalTempContext().createFile({
      suffix: ".yml",
    });
    Deno.writeTextFileSync(
      definedEnvTempPath,
      stringify(dotenvVariablesDefined),
    );
    await load({
      envPath: definedEnvTempPath,
      examplePath: dotenvRequired,
      // safe: true, FIXME we need to figure out how to handle this now that `safe:` was deprecated and removed
      allowEmptyValues: true,
    });
  }

  // check to see if the environment changed and emit an event if it did
  if (
    prevDotenvVariablesDefined &&
    !isEqual(dotenvVariablesDefined, prevDotenvVariablesDefined)
  ) {
    fireDotenvChanged();
  }

  // set last defined
  prevDotenvVariablesDefined = dotenvVariablesDefined;

  // return the files we processed
  return dotenvFiles;
}

// broadcast changes
const listeners = new Array<() => void>();
function fireDotenvChanged() {
  listeners.forEach((listener) => listener());
}
export function onDotenvChanged(
  listener: () => void,
) {
  listeners.push(listener);
}
