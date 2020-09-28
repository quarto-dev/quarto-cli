import type { Args } from "flags/mod.ts";

export interface Command {
  name: string;
  arguments: string[];
  exec: (args: Args) => Promise<void>;
}

export function findCommand(name: string) {
  return commands().find((command) => command.name === name);
}

export function commands(): Command[] {
  return [];
}
