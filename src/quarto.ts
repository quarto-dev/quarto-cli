import { parse, Args } from "flags/mod.ts";

import { logError } from "./core/log.ts";

import { render } from "./command/render.ts";

export async function quarto(args: Args) {
  const [command, input] = args["_"];
  if (command === "render") {
    await render(input.toString());
  } else {
    throw new Error("Unknown command " + command);
  }
}

// main
if (import.meta.main) {
  try {
    await quarto(parse(Deno.args));
  } catch (error) {
    logError(error.toString());
    Deno.exit(1);
  }
}
