
// path manipulation
export { path } from './platform-deno.ts';


// command line arguments
export interface CommandLineArgs {
   _: Array<string | number>;
   [key: string]: any;
} 
export { commandLineArgs } from './platform-deno.ts';

// environment variables
export { getenv } from './platform-deno.ts';

// process execution
export interface ProcessExec {
   cmd: string[];
   cwd?: string;
   env?: {
      [key: string]: string;
   };
   stdout?: "inherit" | "piped" | "null";
   stderr?: "inherit" | "piped" | "null";
   stdin?: "inherit" | "piped" | "null";
}

export interface ProcessResult {
   success: boolean;
   code: number;
   stdout?: string;
   stderr?: string;
}

export { execProcess } from './platform-deno.ts';
export { exitProcess } from './platform-deno.ts';


// error logging
export { logError } from './platform-deno.ts';

