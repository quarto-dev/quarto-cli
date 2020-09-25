


// https://dev.to/unorthodev/build-a-simple-cli-tool-with-deno-1fmk

import { parse } from 'https://deno.land/std@0.71.0/flags/mod.ts';

const { args } = Deno;

const parsedArgs = parse(args);

console.log(parsedArgs);
