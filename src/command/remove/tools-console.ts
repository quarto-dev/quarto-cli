/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Select } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { allTools, toolSummary } from "../tools/tools.ts";

import { withSpinner } from "../../core/console.ts";
import {
  InstallableTool,
  RemotePackageInfo,
  ToolSummaryData,
} from "../tools/types.ts";
import { info, warning } from "log/mod.ts";

interface ToolInfo {
  tool: InstallableTool;
  installed: boolean;
  version?: string;
  latest: RemotePackageInfo;
}

export async function outputTools() {
  const toolRows: string[][] = [];
  const statusMsgs: string[] = [];

  await withSpinner({
    message: "Reading Tool Data",
  }, async () => {
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
          summary.installedVersion || "",
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
  });
  // Write the output
  const table = new Table().header([
    "Tool",
    "Status",
    "Installed",
    "Latest",
  ]).body(
    toolRows,
  ).padding(4);
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

export async function selectTool(
  toolsInfo: ToolInfo[],
  action: "install" | "remove",
) {
  const name = (toolInfo: ToolInfo) => {
    if (action === "install") {
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
        disabled: action === "install"
          ? toolInfo.installed
          : !toolInfo.installed,
      };
    }),
  });
  return toolTarget;
}
