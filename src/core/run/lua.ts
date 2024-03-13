/*
 * lua.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";

import { dirname, extname } from "../../deno_ral/path.ts";
import { normalizePath } from "../path.ts";
import { isWindows } from "../platform.ts";
import { execProcess } from "../process.ts";
import { pandocBinaryPath, resourcePath } from "../resources.ts";
import { RunHandler, RunHandlerOptions } from "./types.ts";

export const luaRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".lua"].includes(extname(script).toLowerCase());
  },
  run: async (
    script: string,
    args: string[],
    stdin?: string,
    options?: RunHandlerOptions,
  ) => {
    // lua run handlers don't support stdin
    if (typeof stdin === "string") {
      throw new Error("Lua run handlers cannot be passed stdin");
    }

    // call pandoc w/ script as a filter
    const cmd = [
      pandocBinaryPath(),
      "--from",
      "markdown",
      "--to",
      "plain",
    ];
    cmd.push(
      "--lua-filter",
      script,
    );
    cmd.push(...args);

    return await execProcess({
      cmd,
      ...options,
    }, "");
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
      const script = normalizePath(arg);
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
