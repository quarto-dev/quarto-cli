import { toArrayBuffer } from "https://deno.land/std/streams/mod.ts";
import juice from "https://cdn.skypack.dev/juice";

const input = new TextDecoder().decode(await toArrayBuffer(Deno.stdin.readable))

console.log(juice(input));

// not available in skypack version 
// juice.juiceResources(input, {}, (err, output) => console.log(output))