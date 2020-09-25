


// https://dev.to/unorthodev/build-a-simple-cli-tool-with-deno-1fmk

import { parse } from 'flags/mod.ts';

const { args } = Deno;

const parsedArgs = parse(args);
console.log(parsedArgs);

const p = Deno.run({
   cmd: ["pandoc", ...args],
 });
 
 // await its completion
 await p.status();

 


