import { join } from "https://deno.land/std/path/mod.ts";

try {
  Deno.statSync(join(Deno.cwd(), "i-exist.txt"));
  throw new Error("File should not exist.");
} catch (e) {
  if (e instanceof Deno.errors.NotFound) {
    Deno.writeTextFileSync(join(Deno.cwd(), "i-exist.txt"), "yes.");
    console.log("pre-render ok");
  } else {
    throw e;
  }
}
