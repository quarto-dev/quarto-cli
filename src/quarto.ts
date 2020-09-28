
import { parse } from "https://deno.land/std/flags/mod.ts";

import { render } from './command/render.ts';
import { logError } from './core/log.ts';

// parse args
const parsedArgs = parse(Deno.args);
const [ command, input ]  = parsedArgs['_'];

// dispatch command
try {

   if (command === 'render') {

      await render(input.toString());

   } else {

      logError('Unknown command ' + command);
   
   }

} catch(error) {

   logError(error.toString());
  
}


