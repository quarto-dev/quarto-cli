/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import * as colors from "fmt/colors.ts";
import { Confirm, Select } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { info, warning } from "log/mod.ts";

import {
  allTools,
  installTool,
  toolSummary,
  updateTool,
} from "../tools/tools.ts";

import { withSpinner } from "../../core/console.ts";
import {
  InstallableTool,
  RemotePackageInfo,
  ToolSummaryData,
} from "../tools/types.ts";

interface ToolInfo {
  tool: InstallableTool;
  installed: boolean;
  version?: string;
  latest: RemotePackageInfo;
}

export async function outputTools() {
  const toolRows: string[][] = [];
  const statusMsgs: string[] = [];

  // Reads the status
  const installStatus = (summary: ToolSummaryData): string => {
    if (summary.installed) {
      if (summary.installedVersion) {
        if (summary.installedVersion === summary.latestRelease.version) {
          return "Up to date";
        } else {
          return "Update available";
        }
      } else {
        return "External Installation";
      }
    } else {
      return "Not installed";
    }
  };

  // The column widths for output (in chars)
  const tools = await loadTools();
  for (const tool of tools) {
    const summary = await toolSummary(tool.tool.name);
    if (summary) {
      const toolDetails = [
        tool.tool.name,
        installStatus(summary),
        summary.installedVersion || "---",
        summary.latestRelease.version,
      ];
      toolRows.push(toolDetails);

      if (summary.configuration.status !== "ok") {
        statusMsgs.push(
          `${summary.configuration.message}`,
        );
      }
    }
  }

  info("");
  // Write the output
  const table = new Table().header([
    colors.bold("Tool"),
    colors.bold("Status"),
    colors.bold("Installed"),
    colors.bold("Latest"),
  ]).body(
    toolRows,
  ).padding(5);
  info(table.toString());
  statusMsgs.forEach((msg) => {
    warning(msg);
  });
}

export async function loadTools(): Promise<ToolInfo[]> {
  let sorted: ToolInfo[] = [];
  await withSpinner({ message: "Inspecting tools" }, async () => {
    const all = await allTools();
    const toolsWithInstall = [{
      tools: all.installed,
      installed: true,
    }, {
      tools: all.notInstalled,
      installed: false,
    }];

    const toolInfos = [];
    for (const toolWithInstall of toolsWithInstall) {
      for (const tool of toolWithInstall.tools) {
        const version = await tool.installedVersion();
        const latest = await tool.latestRelease();
        toolInfos.push({
          tool,
          version,
          installed: toolWithInstall.installed,
          latest,
        });
      }
    }

    sorted = toolInfos.sort((tool1, tool2) => {
      return tool1.tool.name.localeCompare(tool2.tool.name);
    });
  });
  return sorted;
}

export async function updateOrInstallTool(
  tool: string,
  action: "update" | "install",
) {
  const summary = await toolSummary(tool);

  if (action === "update") {
    if (!summary?.installed) {
      const confirmed: boolean = await Confirm.prompt(
        {
          message: `${tool} is not installed. Do you want to install it now?`,
          default: true,
        },
      );
      if (confirmed) {
        return installTool(tool);
      } else {
        return Promise.resolve();
      }
    } else {
      if (summary.installedVersion === summary.latestRelease.version) {
        info(`${tool} is already up to date.`);
      } else {
        return updateTool(tool);
      }
    }
  } else {
    if (summary && summary.installed) {
      if (summary.installedVersion === summary.latestRelease.version) {
        info(`${tool} is already installed and up to date.`);
      } else {
        const confirmed: boolean = await Confirm.prompt(
          {
            message:
              `${tool} is already installed. Do you want to update to ${summary.latestRelease.version}?`,
            default: true,
          },
        );
        if (confirmed) {
          return updateTool(tool);
        } else {
          return Promise.resolve();
        }
      }
    } else {
      return installTool(tool);
    }
  }
}

export async function selectTool(
  toolsInfo: ToolInfo[],
  action: "install" | "update" | "remove",
) {
  const name = (toolInfo: ToolInfo) => {
    if (action === "install" || action == "update") {
      if (toolInfo.installed) {
        return `${toolInfo.tool.name}${
          toolInfo.version ? " (" + toolInfo.version + " installed)" : ""
        }`;
      } else {
        return `${toolInfo.tool.name}${
          toolInfo.latest.version ? " (" + toolInfo.latest.version + ")" : ""
        }`;
      }
    } else {
      if (!toolInfo.installed) {
        return `${toolInfo.tool.name} (not installed)`;
      } else {
        return `${toolInfo.tool.name}${
          toolInfo.version ? " (" + toolInfo.version + " installed)" : ""
        }`;
      }
    }
  };

  const toolTarget: string = await Select.prompt({
    message: `Select a tool to ${action}`,
    options: toolsInfo.map((toolInfo) => {
      return {
        name: name(toolInfo),
        value: toolInfo.tool.name,
        disabled: action === "install" || action === "update"
          ? toolInfo.installed
          : !toolInfo.installed,
      };
    }),
  });
  return toolTarget;
}
