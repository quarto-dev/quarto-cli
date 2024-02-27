/*
 * profile.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { error } from "../deno_ral/log.ts";
import { basename, join } from "../deno_ral/path.ts";

import { ProjectConfig } from "../project/types.ts";
import * as ld from "../core/lodash.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { mergeProjectMetadata } from "../config/metadata.ts";
import { safeExistsSync } from "../core/path.ts";
import { Schema } from "../core/lib/yaml-schema/types.ts";
import {
  activeProfiles,
  kQuartoProfile,
  readProfile,
} from "../quarto-core/profile.ts";
import { dotenvQuartoProfile } from "../quarto-core/dotenv.ts";
import { Metadata } from "../config/types.ts";

const kQuartoProfileConfig = "profile";

type QuartoProfileConfig = {
  default?: string | string[] | undefined;
  group?: string[] | Array<string[]> | undefined;
};

// cache original QUARTO_PROFILE env var
let baseQuartoProfile: string | undefined;

export async function initializeProfileConfig(
  dir: string,
  config: ProjectConfig,
  schema: Schema,
) {
  // read the original env var once
  const firstRun = baseQuartoProfile === undefined;
  if (firstRun) {
    baseQuartoProfile = Deno.env.get(kQuartoProfile) || "";
  }

  // read the config then delete it
  const profileConfig = ld.isObject(config[kQuartoProfileConfig])
    ? config[kQuartoProfileConfig] as QuartoProfileConfig
    : undefined;
  delete config[kQuartoProfileConfig];

  // if there is no profile defined see if the user has provided a default
  // either with an external environment variable, a dotenv file, or within
  // a _quarto.yml.local (external definition takes precedence)
  let quartoProfile = baseQuartoProfile || await dotenvQuartoProfile(dir) ||
    await localConfigQuartoProfile(dir, schema) || "";

  // none-specified so read from the current profile file
  if (!quartoProfile) {
    if (Array.isArray(profileConfig?.default)) {
      quartoProfile = profileConfig!.default
        .map((value) => String(value)).join(",");
    } else if (typeof (profileConfig?.default) === "string") {
      quartoProfile = profileConfig.default;
    }
  }

  // read any profile defined (could be from base env or from the default)
  const active = readProfile(quartoProfile);
  if (active.length === 0) {
    //  do some smart detection of connect if there are no profiles defined
    if (Deno.env.get("RSTUDIO_PRODUCT") === "CONNECT") {
      active.push("connect");
    }
  }

  // read profile groups -- ensure that at least one member of each group is in the profile
  const groups = readProfileGroups(profileConfig);
  for (const group of groups) {
    if (!group.some((name) => active!.includes(name))) {
      active.push(group[0]);
    }
  }

  // if this isn't the first run and the active profile has changed then
  // notify any listeners of this
  const updatedQuartoProfile = active.join(",");
  if (!firstRun) {
    if (Deno.env.get(kQuartoProfile) !== updatedQuartoProfile) {
      fireActiveProfileChanged(updatedQuartoProfile);
    }
  }

  // set the environment variable for those that want to read it directly
  Deno.env.set(kQuartoProfile, active.join(","));

  return await mergeProfiles(
    dir,
    config,
    schema,
  );
}

// broadcast changes
const listeners = new Array<(profile: string) => void>();
function fireActiveProfileChanged(profile: string) {
  listeners.forEach((listener) => listener(profile));
}
export function onActiveProfileChanged(
  listener: (profile: string) => void,
) {
  listeners.push(listener);
}

async function localConfigQuartoProfile(dir: string, schema: Schema) {
  const localConfigPath = localProjectConfigFile(dir);
  if (localConfigPath) {
    const yaml = await readAndValidateYamlFromFile(
      localConfigPath,
      schema,
      `Validation of configuration profile file ${
        basename(localConfigPath)
      } failed.`,
      "{}",
    ) as Metadata;
    const profile = yaml[kQuartoProfileConfig] as
      | QuartoProfileConfig
      | undefined;
    if (Array.isArray(profile?.default)) {
      return profile?.default.join(",");
    } else if (typeof (profile?.default) === "string") {
      return profile?.default;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

async function mergeProfiles(
  dir: string,
  config: ProjectConfig,
  schema: Schema,
) {
  // config files to return
  const files: string[] = [];

  // function to merge a profile
  const mergeProfile = async (profilePath: string) => {
    try {
      const yaml = await readAndValidateYamlFromFile(
        profilePath,
        schema,
        `Validation of configuration profile file ${
          basename(profilePath)
        } failed.`,
        "{}",
      );
      config = mergeProjectMetadata(config, yaml);
      files.push(profilePath);
    } catch (e) {
      error(
        "\nError reading configuration profile file from " +
          basename(profilePath) +
          "\n",
      );
      throw e;
    }
  };

  // merge all active profiles (reverse order so first gets priority)
  for (const profileName of activeProfiles().reverse()) {
    const profilePath = [".yml", ".yaml"].map((
      ext,
    ) => join(dir, `_quarto-${profileName}${ext}`)).find(safeExistsSync);
    if (profilePath) {
      await mergeProfile(profilePath);
    }
  }
  // merge local config
  const localConfigPath = localProjectConfigFile(dir);
  if (localConfigPath) {
    await mergeProfile(localConfigPath);
  }

  return { config, files };
}

function localProjectConfigFile(dir: string) {
  return [".yml", ".yaml"].map((ext) => join(dir, `_quarto${ext}.local`))
    .find(safeExistsSync);
}

function readProfileGroups(
  profileConfig?: QuartoProfileConfig,
): Array<string[]> {
  // read all the groups
  const groups: Array<string[]> = [];
  const configGroup = profileConfig?.group as unknown;
  if (Array.isArray(configGroup)) {
    // array of strings is a single group
    if (configGroup.every((value) => typeof value === "string")) {
      groups.push(configGroup);
    } else if (configGroup.every(Array.isArray)) {
      groups.push(...configGroup);
    }
  }
  return groups;
}
