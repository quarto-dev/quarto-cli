/*
* dart-sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { binaryPath } from "../core/resources.ts";

import { execProcess } from "../core/process.ts";

export async function compileScss(input: string, compressed?: boolean) : Promise<string | undefined> {

 const command = Deno.build.os === "windows" ? "sass.bat" : "sass";
 // Run the sas compiler
 const sass = binaryPath(join("dart-sass", command));
 const result = await execProcess(
   {
     cmd: [
       sass,
       "--stdin",
       "--style",
       compressed ? "compressed" : "expanded",
     ],
     stdout: "piped",
   },
   input,
 );

 if (result.success) {
   return result.stdout;
  } else {
    throw new Error("Sass compile failed");
  }
}

 