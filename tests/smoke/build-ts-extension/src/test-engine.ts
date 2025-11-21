import type {
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  QuartoAPI,
  EngineProjectContext,
  MappedString,
  ExecutionTarget,
  ExecuteOptions,
  ExecuteResult,
  DependenciesOptions,
  DependenciesResult,
  PostProcessOptions,
  PartitionedMarkdown,
} from "@quarto/types";
import { extname } from "path";

let quarto: QuartoAPI;

const testEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI: QuartoAPI) => {
    quarto = quartoAPI;
  },

  name: "test",

  defaultExt: ".qmd",

  defaultYaml: () => ["engine: test"],

  defaultContent: () => ["# Test Engine Document", "", "This is a test."],

  validExtensions: () => [".qmd"],

  claimsFile: (_file: string, _ext: string) => false,

  claimsLanguage: (language: string) => language === "test",

  canFreeze: false,

  generatesFigures: false,

  launch: (context: EngineProjectContext): ExecutionEngineInstance => {
    return {
      name: "test",
      canFreeze: false,

      markdownForFile: async (file: string): Promise<MappedString> => {
        return quarto.mappedString.fromFile(file);
      },

      target: async (
        file: string,
        _quiet?: boolean,
        markdown?: MappedString,
      ): Promise<ExecutionTarget | undefined> => {
        if (!markdown) {
          markdown = await quarto.mappedString.fromFile(file);
        }
        const metadata = quarto.markdownRegex.extractYaml(markdown.value);
        return {
          source: file,
          input: file,
          markdown,
          metadata,
        };
      },

      partitionedMarkdown: async (
        file: string,
      ): Promise<PartitionedMarkdown> => {
        const markdown = await quarto.mappedString.fromFile(file);
        return quarto.markdownRegex.partition(markdown.value);
      },

      execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
        // Simple passthrough - no actual execution
        // Use extname to ensure it gets bundled
        const _ext = extname(options.target.input);
        return {
          markdown: options.target.markdown.value,
          supporting: [],
          filters: [],
        };
      },

      dependencies: async (
        _options: DependenciesOptions,
      ): Promise<DependenciesResult> => {
        return {
          includes: {},
        };
      },

      postprocess: async (_options: PostProcessOptions): Promise<void> => {
        // No post-processing needed
      },
    };
  },
};

export default testEngineDiscovery;
