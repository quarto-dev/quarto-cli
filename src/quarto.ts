import {
  logError,
  exitProcess,
  commandLineArgs,
  CommandLineArgs,
} from "./core/platform.ts";

import { render } from "./command/render.ts";

export async function quarto(args: CommandLineArgs) {
  const [command, input] = args["_"];

  // dispatch command
  try {
    if (command === "render") {
      await render(input.toString());
    } else {
      logError("Unknown command " + command);
      exitProcess(1);
    }
  } catch (error) {
    logError(error.toString());
    exitProcess(1);
  }
}

// main
if (import.meta.main) {
  quarto(commandLineArgs());
}
