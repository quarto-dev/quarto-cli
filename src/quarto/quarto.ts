import type { Args } from "flags/mod.ts";

import { findCommand } from "../command/command.ts";

export async function quarto(args: Args) {
  const name = args["_"][0].toString();
  const command = findCommand(name);
  if (command) {
    await command.exec(args);
  } else {
    throw new Error("Unknown command " + command);
  }
}
