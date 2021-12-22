/*
* lua.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";

import { dirname, extname } from "path/mod.ts";
import { execProcess } from "../process.ts";
import { pandocBinaryPath } from "../resources.ts";
import { RunHandler } from "./run.ts";

export const luaRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".lua"].includes(extname(script).toLowerCase());
  },
  run: async (script: string, args: string[]) => {
    // append boilerplate "do nothing" pandoc format code to temporary copy of the script
    script = Deno.realPathSync(script);
    const tempScript = Deno.makeTempFileSync({
      dir: dirname(script),
      prefix: ".run-",
      suffix: ".lua",
    });
    Deno.writeTextFileSync(
      tempScript,
      Deno.readTextFileSync(script) + `\n
local meta = {}
meta.__index =
function(_, key)
return function() return '' end
end
setmetatable(_G, meta)      
`,
    );

    // call pandoc w/ temp script as --to
    try {
      return await execProcess({
        cmd: [
          pandocBinaryPath(),
          "--from",
          "markdown",
          "--to",
          tempScript,
          ...args,
        ],
      }, " ");
    } finally {
      // remove temp script
      if (tempScript) {
        Deno.removeSync(tempScript);
      }
    }
  },
};

export function isLuaScript(file?: string) {
  return file && [".lua"].includes(extname(file).toLowerCase());
}

export async function runLua(args: string[]) {
  // extract first lua script from args and append boilerplate
  // "do nothing" pandoc format code
  let tempScript: string | undefined;
  args = args.filter((arg) => {
    if (!tempScript && isLuaScript(arg)) {
      const script = Deno.realPathSync(arg);
      tempScript = Deno.makeTempFileSync({
        dir: dirname(script),
        prefix: ".run-",
        suffix: ".lua",
      });
      Deno.writeTextFileSync(
        tempScript,
        Deno.readTextFileSync(script) + `\n
local meta = {}
meta.__index =
  function(_, key)
    return function() return '' end
  end
setmetatable(_G, meta)      
`,
      );
      return false;
    } else {
      return true;
    }
  });

  // no script
  if (!tempScript) {
    info("No valid lua script provided");
    return Promise.resolve({ success: false, code: 127 });
  }

  // call pandoc w/ temp script as --to
  try {
    return await execProcess({
      cmd: [
        pandocBinaryPath(),
        "--from",
        "markdown",
        "--to",
        tempScript,
        ...args,
      ],
    }, " ");
  } finally {
    // remove temp script
    if (tempScript) {
      Deno.removeSync(tempScript);
    }
  }
}
