/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Command, Option } from "npm:clipanion";
import {
  outputTools,
  removeTool,
  updateOrInstallTool,
} from "../../tools/tools-console.ts";
import { printToolInfo } from "../../tools/tools.ts";
import { info } from "../../deno_ral/log.ts";

export class ToolsCommand extends Command {
    static name = 'tools';
    static paths = [[ToolsCommand.name]];

    static usage = Command.Usage({
        description: "Display the status of Quarto installed dependencies",
        examples: [
            [
                "Show tool status",
                `$0 ${ToolsCommand.name}`,
            ]
        ]
    });

    async execute() {
        await outputTools();
    }
}

export class InstallToolCommand extends Command {
    static paths = [[ToolsCommand.name, "install"]];

    static usage = Command.Usage({
        category: 'internal',
        description: "Display the status of Quarto installed dependencies",
        examples: [
            [
                "Show tool status",
                `$0 ${ToolsCommand.name}`,
            ]
        ]
    });

    tool = Option.String();

    async execute() {
        info(
            "This command has been superseded. Please use `quarto install` instead.\n",
        );
        await updateOrInstallTool(
            this.tool,
            "install",
        );
    }
}

export class ToolInfoCommand extends Command {
    static paths = [[ToolsCommand.name, "info"]];

    static usage = Command.Usage({
        category: 'internal',
    });

    tool = Option.String();

    async execute() {
        await printToolInfo(this.tool);
    }
}

export class UninstallToolCommand extends Command {
    static paths = [[ToolsCommand.name, "uninstall"]];

    static usage = Command.Usage({
        category: 'internal',
    });

    tool = Option.String();

    async execute() {
        info(
            "This command has been superseded. Please use `quarto uninstall` instead.\n",
        );
        await removeTool(this.tool);
    }
}

export class UpdateToolCommand extends Command {
    static paths = [[ToolsCommand.name, "update"]];

    static usage = Command.Usage({
        category: 'internal',
    });

    tool = Option.String();

    async execute() {
        info(
            "This command has been superseded. Please use `quarto update` instead.\n",
        );
        await updateOrInstallTool(
            this.tool,
            "update",
        );
    }
}

export class ListToolsCommand extends Command {
    static paths = [[ToolsCommand.name, "list"]];

    static usage = Command.Usage({
        category: 'internal',
    });

    async execute() {
        info(
            "This command has been superseded. Please use `quarto tools` with no arguments to list tools and status.\n",
        );
        await outputTools();
    }
}

export const toolsCommands = [
    ToolsCommand,
    InstallToolCommand,
    ToolInfoCommand,
    UninstallToolCommand,
    UpdateToolCommand,
    ListToolsCommand,
];
