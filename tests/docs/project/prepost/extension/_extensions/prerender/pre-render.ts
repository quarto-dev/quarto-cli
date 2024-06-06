import { join } from "https://deno.land/std/path/mod.ts";

Deno.writeTextFileSync(join(Deno.cwd(), "i-exist.txt"), "yes.");
