/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { Checkbox, Confirm, Select } from "cliffy/prompt/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { allTools, uninstallTool } from "../tools/tools.ts";

import { info } from "log/mod.ts";
import { removeExtension } from "../../extension/remove.ts";
import { withSpinner } from "../../core/console.ts";
import { InstallableTool, RemotePackageInfo } from "../tools/types.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import {
  Extension,
  extensionIdString,
} from "../../extension/extension-shared.ts";
import { projectContext } from "../../project/project-context.ts";

interface AllTools {
  installed: InstallableTool[];
  notInstalled: InstallableTool[];
}

interface ToolInfo {
  tool: InstallableTool;
  installed: boolean;
  version?: string;
  latest: RemotePackageInfo;
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
