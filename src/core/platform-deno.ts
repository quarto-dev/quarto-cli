
import { parse } from 'flags/mod.ts';
import { basename, dirname, extname, join } from 'path/mod.ts';

import type { CommandLineArgs, ProcessExec, ProcessResult } from "./platform.ts";

export const path = {
   basename,
   dirname,
   extname,
   join,
 };

export function commandLineArgs(): CommandLineArgs {
   return parse(Deno.args);
}


export async function execProcess(exec: ProcessExec) : Promise<ProcessResult> {

   // define process
   const process = await Deno.run({
      cmd: exec.cmd,
      stdout: exec.stdout,
      stderr: exec.stderr
   });

   // await result
   const status = await process.status();
   const stdout = exec.stdout === 'piped' ? await process.output() : undefined;
   const stderr = exec.stderr === 'piped' ? await process.stderrOutput() : undefined;

   // return result
   const decoder = new TextDecoder();
   return {
      success: status.success,
      code: status.code,
      stdout: stdout ? decoder.decode(stdout) : undefined,
      stderr: stderr ? decoder.decode(stderr) : undefined
   };
}

export function exitProcess(status: number) {
   Deno.exit(1);
}

export function logError(msg: string) {
   Deno.stderr.writeSync(new TextEncoder().encode(msg + '\n'));
}


