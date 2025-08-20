/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { quartoCacheDir } from "../../../core/appdirs.ts";
import { quartoConfig } from "../../../core/quarto.ts";
import {
  ensureDir,
  moveSync,
  safeRemoveDirSync,
} from "../../../deno_ral/fs.ts";
import { basename, dirname, join } from "../../../deno_ral/path.ts";
import { copy } from "fs/copy";
import { resourcePath } from "../../../core/resources.ts";
import { execProcess } from "../../../core/process.ts";

const ensureTracingToolsCopied = async () => {
  const cacheDir = quartoCacheDir();
  const tracingDir = `${cacheDir}/ast-tracing`;
  await ensureDir(tracingDir);
  safeRemoveDirSync(join(tracingDir, "qmd"), cacheDir);
  await copy(
    resourcePath(join("tools", "ast-tracing")),
    join(tracingDir, "qmd"),
  );
  return join(tracingDir, "qmd");
};

export const showAstTraceCommand = new Command()
  .name("show-ast-trace")
  .hidden()
  .arguments("<arguments...>")
  .description(
    "Renders the document with AST tracing enabled and then shows the debugging output.\n\n",
  )
  .action(async (_options: unknown, input: string, ...args: string[]) => {
    const toolsPath = await ensureTracingToolsCopied();

    const dir = dirname(input);
    const base = basename(input, ".qmd");
    const traceName = join(dir, `${base}-quarto-ast-trace.json`);

    const renderOpts = {
      cmd: quartoConfig.cliPath(),
      env: {
        "QUARTO_TRACE_FILTERS": traceName,
      },
      args: [
        "render",
        input,
        ...args,
        "--quiet",
      ],
    };
    const _renderResult = await execProcess(renderOpts);
    // we don't check for errors here because we want to show the trace even if
    // the render fails

    moveSync(traceName, join(toolsPath, basename(traceName)));

    const _previewResult = await execProcess({
      cmd: quartoConfig.cliPath(),
      cwd: toolsPath,
      args: [
        "preview",
        "trace-viewer.qmd",
        "-M",
        `trace_1:${basename(traceName)}`,
      ],
    });
  });
