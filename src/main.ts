import { parse } from "flags/mod.ts";

import { logError } from "./core/log.ts";
import { quarto } from "./quarto/quarto.ts";

if (import.meta.main) {
  try {
    await quarto(parse(Deno.args));
  } catch (error) {
    logError(error.toString());
    Deno.exit(1);
  }
}
