/*
* profile.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Args } from "flags/mod.ts";

import { Command } from "cliffy/command/mod.ts";

export const kQuartoProfile = "QUARTO_PROFILE";
const kQuartoDefaultProfile = "default";

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

export function activeProfiles() {
  const profile = Deno.env.get(kQuartoProfile);
  if (!profile) {
    return [kQuartoDefaultProfile];
  } else {
    return profile.split(/[ ,]+/);
  }
}
