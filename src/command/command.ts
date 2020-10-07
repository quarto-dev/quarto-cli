import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/render.ts";

export function commands(): Command[] {
  return [
    renderCommand,
  ];
}
