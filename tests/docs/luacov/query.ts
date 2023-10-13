import { getTestsCovering, processIncomingQueue } from "./covtools.ts";
import { resourcePath } from "../../../src/core/resources.ts";
import { join } from "path/mod.ts";

if (import.meta.main) {
  const quartoPath = resourcePath("../..");

  await processIncomingQueue();
  let path = Deno.args[0];
  if (!path.startsWith("/")) {
    path = join(Deno.cwd(), path);
  }
  path = path.replace(quartoPath, "");
  const line = Number(Deno.args[1]);
  const tests = await getTestsCovering(path, isNaN(line) ? undefined : line);
  for (const test of tests) {
    console.log(test);
  }
}
