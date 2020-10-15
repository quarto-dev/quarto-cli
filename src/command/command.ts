import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/render.ts";
import { runCommand } from "./run/run.ts";

export function commands(): Command[] {
  return [
    renderCommand,
    runCommand,
  ];
}
