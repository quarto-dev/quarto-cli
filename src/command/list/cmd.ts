/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */
import { Command } from "cliffy/command/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";

import { info } from "log/mod.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import { extensionIdString } from "../../extension/extension-shared.ts";
import { Extension, ExtensionContext } from "../../extension/types.ts";
import { projectContext } from "../../project/project-context.ts";
import { outputTools } from "../../tools/tools-console.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";

export const listCommand = new Command()
  .hidden()
  .name("list")
  .arguments("<type:string>")
  .description(
    "Lists an extension or global dependency.",
  )
  .example(
    "List installed extensions",
    "quarto list extensions",
  )
  .example(
    "List global tools",
    "quarto list tools",
  )
  .action(
    async (_options: unknown, type: string) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      const extensionContext = createExtensionContext();
      try {
        if (type.toLowerCase() === "extensions") {
          await outputExtensions(Deno.cwd(), extensionContext);
        } else if (type.toLowerCase() === "tools") {
          await outputTools();
        } else {
          // This is an unrecognized type option
          info(
            `Unrecognized option '${type}' - please choose 'tools' or 'extensions'.`,
          );
        }
      } finally {
        temp.cleanup();
      }
    },
  );

async function outputExtensions(
  path: string,
  extensionContext: ExtensionContext,
) {
  const nbContext = notebookContext();
  // Provide the with with a list
  const project = await projectContext(path, nbContext);
  const extensions = await extensionContext.extensions(
    path,
    project?.config,
    project?.dir,
    { builtIn: false },
  );
  if (extensions.length === 0) {
    info(
      `No extensions are installed in this ${
        project ? "project" : "directory"
      }.`,
    );
  } else {
    const extensionEntries: string[][] = [];
    const provides = (extension: Extension) => {
      const contribs: string[] = [];
      if (
        extension.contributes.filters &&
        extension.contributes.filters?.length > 0
      ) {
        contribs.push("filters");
      }

      if (
        extension.contributes.shortcodes &&
        extension.contributes.shortcodes?.length > 0
      ) {
        contribs.push("shortcodes");
      }

      if (
        extension.contributes.formats &&
        Object.keys(extension.contributes.formats).length > 0
      ) {
        contribs.push("formats");
      }
      return contribs.join(", ");
    };

    extensions.forEach((ext) => {
      const row = [
        extensionIdString(ext.id),
        ext.version?.toString() || "(none)",
        `${provides(ext)}`,
      ];
      extensionEntries.push(row);
    });

    const table = new Table().header(["Id", "Version", "Contributes"]).body(
      extensionEntries,
    ).padding(4);
    info(table.toString());
  }
}
