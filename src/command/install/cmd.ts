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
  installableTool,
  installableTools,
  installTool,
  toolSummary,
  uninstallTool,
  updateTool,
} from "./install.ts";

// The quarto install command
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

// The quarto uninstall command
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

// The quarto update command
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
    const summary = await toolSummary(name);
    if (
      summary && summary.installed &&
      summary.installedVersion !== summary.latestRelease.version
    ) {
      // Get the current version info and confirm update
      const confirmed: boolean = await Confirm.prompt(
        `This will update ${name} from ${summary.installed} to ${summary.latestRelease.version}. Are you sure?`,
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
  const toolRows: string[] = [];
  for (const tool of installableTools()) {
    const summary = await toolSummary(tool);
    if (summary) {
      const status = summary.installed
        ? summary.installedVersion === summary.latestRelease.version
          ? "up to date"
          : "update available"
        : "not installed";

      toolRows.push(
        formatLine(
          [
            tool,
            status,
            summary.installedVersion || "---",
            summary.latestRelease.version,
          ],
          cols,
        ),
      );
    }
  }

  // Write the output
  message(
    formatLine(["Tool", "Status", "Installed", "Latest"], cols),
    { bold: true },
  );
  if (toolRows.length === 0) {
    message("nothing installed", { indent: 2 });
  } else {
    toolRows.forEach((row) => message(row));
  }
}
