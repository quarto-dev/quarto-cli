import { extname, join } from "path/mod.ts";

import { readYamlFromMarkdownFile } from "../core/yaml.ts";

import { dirAndStem } from "../core/path.ts";

import { Metadata } from "../config/metadata.ts";

import type {
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  PostProcessOptions,
} from "./engine.ts";
import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";
import { message } from "../core/console.ts";

const kJmdExtensions = [".jmd"];
const kEngineExtensions = [...kJmdExtensions];

export const juliaEngine: ExecutionEngine = {
  name: "julia",

  handle: async (file: string, _quiet: boolean) => {
    if (kEngineExtensions.includes(extname(file).toLowerCase())) {
      return { input: file };
    }
  },

  metadata: async (target: ExecutionTarget): Promise<Metadata> => {
    return readYamlFromMarkdownFile(target.input);
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    // --params and --root-dir are not supported
    if (options.params) {
      return Promise.reject(
        new Error("--params is not supported for Julia Markdown"),
      );
    }
    if (options.cwd) {
      return Promise.reject(
        new Error("--root-dir is not supported for Julia Markdown"),
      );
    }

    // show progress
    if (!options.quiet) {
      message(`Weaving ${options.target.input}\n`);
    }

    const result = await execProcess(
      {
        cmd: ["julia", resourcePath("julia.jl")],
        stdout: "piped",
      },
      JSON.stringify(options),
    );
    if (result.success) {
      return JSON.parse(result.stdout!) as ExecuteResult;
    } else {
      return Promise.reject();
    }
  },

  postprocess: async (options: PostProcessOptions) => {
  },

  keepMd: (input: string) => {
    const [inputDir, inputStem] = dirAndStem(input);
    return join(inputDir, inputStem + ".md");
  },
};
