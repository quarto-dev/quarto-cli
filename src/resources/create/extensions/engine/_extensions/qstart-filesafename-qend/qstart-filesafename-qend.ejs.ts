/*
 * <%= filesafename %>.ts
 *
 * Example Quarto engine extension
 *
 * This is a minimal example based on the markdown engine.
 * It demonstrates the basic structure of an execution engine.
 */

// Type imports from bundled quarto-types
import type {
  DependenciesOptions,
  EngineProjectContext,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngineDiscovery,
  ExecutionEngineInstance,
  ExecutionTarget,
  MappedString,
  PostProcessOptions,
  QuartoAPI,
} from "./types/quarto-types.d.ts";

// Module-level quarto API reference
let quarto: QuartoAPI;

// Engine name constant
const kExampleEngine = "<%= filesafename %>";

/**
 * Example engine implementation with discovery and launch capabilities
 */
export const exampleEngineDiscovery: ExecutionEngineDiscovery & {
  _discovery: boolean;
} = {
  _discovery: true,

  init: (quartoAPI: QuartoAPI) => {
    quarto = quartoAPI;
  },

  name: kExampleEngine,
  defaultExt: ".qmd",
  defaultYaml: () => [],
  defaultContent: () => [
    "```{example}",
    "# Example code cell",
    "print('Hello from <%= filesafename %>!')",
    "```",
  ],
  validExtensions: () => [],

  claimsFile: (_file: string, _ext: string) => {
    // Return true if this engine should handle the file based on extension
    return false;
  },

  claimsLanguage: (language: string) => {
    // This engine claims cells with language "example"
    return language.toLowerCase() === "example";
  },

  canFreeze: false,
  generatesFigures: false,

  /**
   * Launch a dynamic execution engine with project context
   */
  launch: (context: EngineProjectContext): ExecutionEngineInstance => {
    return {
      name: exampleEngineDiscovery.name,
      canFreeze: exampleEngineDiscovery.canFreeze,

      markdownForFile(file: string): Promise<MappedString> {
        return Promise.resolve(quarto.mappedString.fromFile(file));
      },

      target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
        const md = markdown ?? quarto.mappedString.fromFile(file);
        const target: ExecutionTarget = {
          source: file,
          input: file,
          markdown: md,
          metadata: quarto.markdownRegex.extractYaml(md.value),
        };
        return Promise.resolve(target);
      },

      partitionedMarkdown: (file: string) => {
        return Promise.resolve(
          quarto.markdownRegex.partition(Deno.readTextFileSync(file)),
        );
      },

      execute: (options: ExecuteOptions): Promise<ExecuteResult> => {
        // Read the markdown
        const markdown = options.target.markdown.value;

        // CHANGE THIS: Add your custom processing here
        // This example just prepends a heading to the document
        const processedMarkdown = "# Example Engine - <%= filesafename %>\n\n" +
          markdown;

        return Promise.resolve({
          engine: kExampleEngine,
          markdown: processedMarkdown,
          supporting: [],
          filters: [],
        });
      },

      dependencies: (_options: DependenciesOptions) => {
        return Promise.resolve({
          includes: {},
        });
      },

      postprocess: (_options: PostProcessOptions) => Promise.resolve(),
    };
  },
};
