/*
* profile.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import * as colors from "fmt/colors.ts";

import { Args } from "flags/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { ProjectConfig } from "../project/types.ts";
import { logProgress } from "./log.ts";
import * as ld from "./lodash.ts";

export const kQuartoProfile = "QUARTO_PROFILE";
export const kQuartoProfileConfig = "profile";
export const kQuartoProjectProfileConfig = "config";
export const kQuartoProfileGroupsConfig = "profile-group";
export const kQuartoProfileDefaultConfig = "profile-default";

export function initializeProfile(args: Args) {
  // set profile if specified
  if (args.profile) {
    Deno.env.set(kQuartoProfile, args.profile);
  }
}

// deno-lint-ignore no-explicit-any
export function appendProfileOptions(cmd: Command<any>): Command<any> {
  return cmd.option(
    "--profile",
    "Project configuration profile",
    {
      global: true,
    },
  );
}

// cache original QUARTO_PROFILE env var
let baseQuartoProfile: string | undefined;

export function initActiveProfiles(config: ProjectConfig) {
  // read the original env var once
  if (baseQuartoProfile === undefined) {
    baseQuartoProfile = Deno.env.get(kQuartoProfile) || "";
  }

  // resolve any specified default or groups. this allows us to support
  // both embedded 'default' and 'group' values (as "reserved words")
  // and externalized ones (e.g. 'profile-default') for the time being
  const kEmbeddedFields = ["default", "group"];
  if (ld.isObject(config[kQuartoProfileConfig])) {
    // get key as object
    const profileConfig = config[kQuartoProfileConfig] as Record<
      string,
      unknown
    >;

    // hoist up embedded fields
    kEmbeddedFields.forEach((field) => {
      const value = profileConfig[field];
      if (value) {
        config[`profile-${field}`] = value;
        delete profileConfig[field];
      }
    });

    // promote 'config'
    const configurations = profileConfig[kQuartoProjectProfileConfig] as
      | Record<string, unknown>
      | undefined;
    if (configurations) {
      delete profileConfig[kQuartoProjectProfileConfig];
      config[kQuartoProfileConfig] = configurations;
    }
  }

  // if there is no profile defined see if the user has provided a default
  let quartoProfile = baseQuartoProfile;
  if (!quartoProfile) {
    const defaultConfig = config[kQuartoProfileDefaultConfig];
    if (Array.isArray(defaultConfig)) {
      quartoProfile = defaultConfig.map((value) => String(value)).join(",");
    } else if (typeof (defaultConfig) === "string") {
      quartoProfile = defaultConfig;
    }
  }
  delete config[kQuartoProfileDefaultConfig];

  // read any profile defined in the base environment
  const active = readProfile(quartoProfile);
  if (active.length === 0) {
    //  do some smart detection of connect
    if (Deno.env.get("RSTUDIO_PRODUCT") === "CONNECT") {
      active.push("connect");
    }
  }

  // read profile groups -- ensure that at least one member of each group is in the profile
  const groups = readProfileGroups(config);
  for (const group of groups) {
    if (!group.some((name) => active!.includes(name))) {
      active.push(group[0]);
    }
  }
  delete config[kQuartoProfileGroupsConfig];

  // set the environment variable for those that want to read it directly
  Deno.env.set(kQuartoProfile, active.join(","));

  // print profile if not quiet
  if (active.length > 0) {
    logProgress(`Profile: ${active.join(",")}\n`);
  }

  return active;
}

export function activeProfiles(): string[] {
  return readProfile(Deno.env.get(kQuartoProfile));
}

function readProfile(profile?: string) {
  if (profile) {
    return profile.split(/[ ,]+/);
  } else {
    return [];
  }
}

function readProfileGroups(config: ProjectConfig): Array<string[]> {
  // read all the groups
  const groups: Array<string[]> = [];
  const configGroups = config[kQuartoProfileGroupsConfig];
  if (Array.isArray(configGroups)) {
    // array of strings is a single group
    if (configGroups.every((value) => typeof (value) === "string")) {
      groups.push(configGroups);
    } else if (configGroups.every(Array.isArray)) {
      groups.push(...configGroups);
    }
  }
  return groups;
}
