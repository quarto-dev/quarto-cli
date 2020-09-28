
import { parse } from "https://deno.land/std/flags/mod.ts";
import { CHAR_EXCLAMATION_MARK } from "https://deno.land/std@0.71.0/path/_constants.ts";

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
      Deno.exit(1);
   
   }

} catch(error) {

   logError(error.toString());
   Deno.exit(1);
  
}


