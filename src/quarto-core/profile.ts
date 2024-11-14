/*
 * profile.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Option } from "npm:clipanion";
import { addCommandOptions } from "../command/options.ts";

export const kQuartoProfile = "QUARTO_PROFILE";

export function activeProfiles(): string[] {
  return readProfile(Deno.env.get(kQuartoProfile));
}

export function readProfile(profile?: string) {
  if (profile) {
    return profile.split(/[ ,]+/);
  } else {
    return [];
  }
}

const profileOptions = {
  profile: Option.String('--profile', { description: "Active project profile(s)" }),
};

export const addProfileOptions = addCommandOptions(profileOptions, async (commandWithOptions)  => {
  const { profile } = commandWithOptions;
  if (profile) {
    Deno.env.set(kQuartoProfile, profile);
  }
});
