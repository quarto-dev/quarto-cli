/*
* profile.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Args } from "flags/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { ProjectConfig } from "../project/types.ts";

export const kQuartoProfile = "QUARTO_PROFILE";
const kQuartoProfileGroups = "profile-group";

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

  // read any profile defined in the base environment
  const active = readProfile(baseQuartoProfile);
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

  // remove
  delete config[kQuartoProfileGroups];

  // set the environment variable for those that want to read it directly
  Deno.env.set(kQuartoProfile, active.join(","));

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
  const groups: Array<string[]> = [];
  const configGroups = config[kQuartoProfileGroups];
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
