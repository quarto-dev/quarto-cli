


// https://dev.to/unorthodev/build-a-simple-cli-tool-with-deno-1fmk

import { parse } from 'flags/mod.ts';

const { args } = Deno;

const parsedArgs = parse(args);
console.log(parsedArgs);


const mdOutput = 'docs/output.md';
const knitArgs = [args[0], mdOutput];

// knit
const knit = Deno.run({
   cmd: ["Rscript", "../src/preprocess/knitr.R", "--args", ...knitArgs],
});
await knit.status();

// run pandoc
const pandoc = Deno.run({
   cmd: ["pandoc", mdOutput]
});
await pandoc.status();





