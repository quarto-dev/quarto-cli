import type { Args } from "flags/mod.ts";

import { render } from "../command/render.ts";

export async function quarto(args: Args) {
  const [command, input] = args["_"];
  if (command === "render") {
    await render(input.toString());
  } else {
    throw new Error("Unknown command " + command);
  }
}
