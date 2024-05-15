import juice from "https://cdn.skypack.dev/juice";

const input = await Deno.readTextFile(Deno.args[0])
console.log(juice(input));

// not available in skypack version 
// juice.juiceResources(input, {}, (err, output) => console.log(output))