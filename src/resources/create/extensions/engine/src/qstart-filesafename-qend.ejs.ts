/*
 * <%= filesafename %>.ts
 *
 * Example Quarto engine extension
 *
 * This is a minimal example based on the markdown engine.
 * It demonstrates the basic structure of an execution engine.
 */

// Type imports from Quarto via import map
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
} from "@quarto/types";

// Module-level quarto API reference
let quarto: QuartoAPI;

// Engine name constant
const kEngineName = "<%= filesafename %>";
const kCellLanguage = "<%= cellLanguage %>";

/**
 * Example engine implementation with discovery and launch capabilities
 */
const exampleEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI: QuartoAPI) => {
    quarto = quartoAPI;
  },

  name: kEngineName,
  defaultExt: ".qmd",
  defaultYaml: () => [],
  defaultContent: () => [
    "```{" + kCellLanguage + "}",
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
    // This engine claims cells with its own language name
    return language.toLowerCase() === kCellLanguage.toLowerCase();
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

      execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
        // Break markdown into cells to process code blocks individually
        const chunks = await quarto.markdownRegex.breakQuartoMd(
          options.target.markdown,
        );

        // Process each cell
        const processedCells: string[] = [];
        for (const cell of chunks.cells) {
          if (
            typeof cell.cell_type === "object" &&
            cell.cell_type.language === kCellLanguage
          ) {
            // CHANGE THIS: Add your custom processing here
            // This example adds the cell language name three times at the start of the cell
            const processed =
              [kCellLanguage, kCellLanguage, kCellLanguage].join(" ") +
              "\n" +
              cell.source.value;
            processedCells.push(
              cell.sourceVerbatim.value.replace(cell.source.value, processed),
            );
          } else {
            // Not our language - pass through unchanged
            processedCells.push(cell.sourceVerbatim.value);
          }
        }

        const processedMarkdown = processedCells.join("");

        return {
          engine: kEngineName,
          markdown: processedMarkdown,
          supporting: [],
          filters: [],
        };
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

export default exampleEngineDiscovery;
