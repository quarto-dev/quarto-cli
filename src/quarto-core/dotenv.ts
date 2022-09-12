/*
* dotenv.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { config, DotenvConfig, stringify } from "dotenv/mod.ts";
import { join } from "path/mod.ts";
import { safeExistsSync } from "../core/path.ts";
import { isEqual } from "../core/lodash.ts";
import { globalTempContext } from "../core/temp.ts";
import { existsSync } from "../vendor/deno.land/std@0.153.0/fs/exists.ts";
import { activeProfiles, kQuartoProfile } from "./profile.ts";

const kQuartoEnv = "_environment";
const kQuartoEnvLocal = `${kQuartoEnv}.local`;
const kQuartoEnvExample = `${kQuartoEnv}.example`;

// read the QUARTO_PROFILE from dotenv if it's there
export async function dotenvQuartoProfile(projectDir: string) {
  // read config
  const conf = await config({
    defaults: join(projectDir, kQuartoEnv),
    path: join(projectDir, kQuartoEnvLocal),
  });

  // return profile if we have it
  return conf[kQuartoProfile];
}

// process dotenv files -- note that we track the processing we have done
// previously and we back it out when we are called to re-process (as might
// occur on a re-render in quarto)
let dotenvVariablesSet: string[] | undefined;

export async function dotenvSetVariables(projectDir: string) {
  // record a snapshot of the previous environment
  const previousEnv = Deno.env.toObject();

  // back out any previous variables set (and note firstRun)
  const firstRun = dotenvVariablesSet === undefined;
  if (dotenvVariablesSet) {
    dotenvVariablesSet.forEach(Deno.env.delete);
  }
  dotenvVariablesSet = [];

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
    const conf = await config({ path: dotenvFile });
    for (const key in conf) {
      // set into environment (and track that we did so for reversing out later)
      if (Deno.env.get(key) === undefined) {
        Deno.env.set(key, conf[key]);
        dotenvVariablesSet.push(key);
      }
      // track all defined variables (for validation against example)
      if (!dotenvVariablesDefined[key] === undefined) {
        dotenvVariablesDefined[key] = conf[key];
      }
    }
  }

  // validate against example if it exists
  const dotenvExample = join(projectDir, kQuartoEnvExample);
  if (existsSync(dotenvExample)) {
    const definedEnvTempPath = globalTempContext().createFile({
      suffix: ".yml",
    });
    Deno.writeTextFileSync(
      definedEnvTempPath,
      stringify(dotenvVariablesDefined),
    );
    await config({
      path: definedEnvTempPath,
      example: dotenvExample,
      safe: true,
      allowEmptyValues: true,
    });
  }

  // check to see if the environment changed and emit an event if it did
  const currentEnv = Deno.env.toObject();
  if (!firstRun && !isEqual(currentEnv, previousEnv)) {
    fireDotenvChanged();
  }

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
