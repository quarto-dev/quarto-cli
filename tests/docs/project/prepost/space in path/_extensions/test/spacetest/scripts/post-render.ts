import { join } from "stdlib/path";

// Create a marker file to prove the post-render script executed
Deno.writeTextFileSync(join(Deno.cwd(), "extension-post-render-executed.txt"), "success");
console.log("extension post-render script executed successfully");
