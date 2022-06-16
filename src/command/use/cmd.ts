/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext, TempContext } from "../../core/temp.ts";

import { error } from "log/mod.ts";
import { templateHandler } from "./handlers/template.ts";

export const useCommand = new Command()
  .hidden()
  .name("use")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .description(
    "Automate document or project setup tasks.",
  )
  .example(
    "Use a template from Github",
    "quarto use template <gh-org>/<gh-repo>",
  )
  .action(
    async (options: Options, type: string, target?: string) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        const typeHandler = typeHandlers.find((typeHandler) => {
          return typeHandler.type === type;
        });
        if (typeHandler) {
          await typeHandler.handler(options, temp, target);
        } else {
          const types = typeHandlers.map((t) => {
            return `       - ${t.type}`;
          });
          error(
            `Unknown type ${type}. Please use one of the following:\n${
              types.join("\n")
            }`,
          );
        }
      } finally {
        temp.cleanup();
      }
    },
  );

export type Options = {
  prompt?: boolean;
};

export interface TypeHandler {
  type: string;
  handler: (
    options: Options,
    tempContext: TempContext,
    target?: string,
  ) => Promise<void>;
}

const typeHandlers: TypeHandler[] = [templateHandler];
