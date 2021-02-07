/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { formatLine, message } from "../../core/console.ts";

import {
  installableTools,
  installTool,
  toolInfo,
  toolInstalled,
  uninstallTool,
} from "./install.ts";

export const installCommand = new Command()
  .name("install")
  .arguments("[name:string]")
  .description(
    `Installs tools, extensions, and templates.\n\nTools that can be installed include:\n${
      installableTools().map((name) => "  " + name).join("\n")
    }`,
  )
  .option(
    "-l, --list",
    "List installable tools",
  )
  .example(
    "Install TinyTex",
    "quarto install tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, name: string) => {
    if (options.list) {
      const cols = [20, 20, 20];
      // Find the installed versions
      const installedVersions: string[] = [];
      for (const tool of installableTools()) {
        const isInstalled = await toolInstalled(tool);
        const info = await toolInfo(tool);
        if (info) {
          installedVersions.push(
            formatLine(
              [
                tool,
                info.latest.tag_name,
                isInstalled ? `installed ${info.version}` : "not installed",
              ],
              cols,
            ),
          );
        }
      }

      // Write the output
      message(
        formatLine(["Tool", "Version", "Installed"], cols),
        { bold: true },
      );
      if (installedVersions.length === 0) {
        message("nothing installed", { indent: 2 });
      } else {
        installedVersions.forEach((installedVersion) =>
          message(installedVersion)
        );
      }
    } else if (name) {
      await installTool(name);
    }
  });

export const uninstallCommand = new Command()
  .name("uninstall")
  .arguments("[name:string]")
  .description(
    `Uninstalls tools, extensions, and templates.\n\nTools that can be uninstalled include:\n${
      installableTools().map((name) => "  " + name).join("\n")
    }`,
  )
  .example(
    "Uninstall TinyTex",
    "quarto uninstall tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, name: string) => {
    const confirmed: boolean = await Confirm.prompt(
      `Are you sure you want to uninstall ${name}?`,
    );
    if (confirmed) {
      await uninstallTool(name);
    }
  });
