

import { logError, exitProcess, commandLineArgs } from './core/platform.ts';

import { render } from './command/render.ts';


// parse args
const parsedArgs = commandLineArgs();
const [ command, input ]  = parsedArgs['_'];

// dispatch command
try {

   if (command === 'render') {

      await render(input.toString());

   } else {

      logError('Unknown command ' + command);
      exitProcess(1);
   
   }

} catch(error) {

   logError(error.toString());
   exitProcess(1);
  
}


