/*
 * profile.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Args } from "flags";
import { Command } from "cliffy/command/mod.ts";

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

export function setProfileFromArg(args: Args) {
  // set profile if specified
  if (args.profile) {
    Deno.env.set(kQuartoProfile, args.profile);
    return true;
  } else {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
export function appendProfileArg(cmd: Command<any>): Command<any> {
  return cmd.option(
    "--profile",
    "Active project profile(s)",
    {
      global: true,
    },
  );
}
