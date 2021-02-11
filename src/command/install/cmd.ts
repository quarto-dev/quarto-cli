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
  updateTool,
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
    "-lt, --list-tools",
    "List installable tools and their status",
  )
  .example(
    "Install TinyTex",
    "quarto install tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, name: string) => {
    if (options.listTools) {
      outputTools();
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
      `This will permanently remove ${name} and all of its files. Are you sure?`,
    );
    if (confirmed) {
      await uninstallTool(name);
    }
  });

export const updateCommand = new Command()
  .name("update")
  .arguments("[name: string]")
  .description(
    `Updates tools, extensions, and templates.\n\nTools that can be updated include:\n${
      installableTools().map((name) => "  " + name).join("\n")
    }`,
  )
  .example(
    "Update TinyTex",
    "quarto update tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, name: string) => {
    const installed = await toolInstalled(name);
    const info = await toolInfo(name);
    if (installed && info) {
      // Get the current version info and confirm update
      const confirmed: boolean = await Confirm.prompt(
        `This will update ${name} from ${info?.version} to ${
          info
            ?.latest.tag_name
        }. Are you sure?`,
      );
      if (confirmed) {
        updateTool(name);
      }
    } else {
      message(`${name} isn't installed and so can't be updated.`);
    }
  });

async function outputTools() {
  const cols = [20, 20, 20, 20];
  // Find the installed versions
  const installedVersions: string[] = [];
  for (const tool of installableTools()) {
    const isInstalled = await toolInstalled(tool);
    const info = await toolInfo(tool);
    if (info) {
      const status = isInstalled
        ? info.version === info.latest.tag_name
          ? "up to date"
          : "update available"
        : "not installed";

      installedVersions.push(
        formatLine(
          [
            tool,
            status,
            info.latest.tag_name,
            info.version || "---",
          ],
          cols,
        ),
      );
    }
  }

  // Write the output
  message(
    formatLine(["Tool", "Status", "Latest", "Installed"], cols),
    { bold: true },
  );
  if (installedVersions.length === 0) {
    message("nothing installed", { indent: 2 });
  } else {
    installedVersions.forEach((installedVersion) => message(installedVersion));
  }
}
