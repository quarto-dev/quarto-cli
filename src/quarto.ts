import {
  logError,
  exitProcess,
  commandLineArgs,
  CommandLineArgs,
} from "./core/platform.ts";

import { render } from "./command/render.ts";

export async function quarto(args: CommandLineArgs) {
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
    await quarto(commandLineArgs());
  } catch (error) {
    logError(error.toString());
    exitProcess(1);
  }
}
