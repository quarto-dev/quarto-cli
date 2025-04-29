import { join } from "stdlib/path";

try {
  Deno.removeSync(join(Deno.cwd(), "i-exist.txt"));
  console.log("post-render ok");
} catch (e) {
  if (e instanceof Deno.errors.NotFound) {
    throw new Error("File should exist.");
  } else {
    throw e;
  }
}
