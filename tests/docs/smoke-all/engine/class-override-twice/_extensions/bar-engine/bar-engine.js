// Engine to test priority-based engine override
// Claims {python.foo} blocks with priority 3 (higher than foo-engine's 2)

let quarto;

const barEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },

  name: "bar",
  defaultExt: ".qmd",
  defaultYaml: () => ["engine: bar"],
  defaultContent: () => ["# Bar Engine Document"],
  validExtensions: () => [".qmd"],

  claimsFile: (_file, _ext) => false,

  claimsLanguage: (language, firstClass) => {
    // Claim python.foo with priority 3 (overrides foo-engine's 2)
    if (language === "python" && firstClass === "foo") {
      return 3;
    }
    return false; // Don't claim
  },

  canFreeze: false,
  generatesFigures: false,

  launch: (context) => {
    return {
      name: "bar",
      canFreeze: false,

      markdownForFile: async (file) => {
        return quarto.mappedString.fromFile(file);
      },

      target: async (file, _quiet, markdown) => {
        if (!markdown) {
          markdown = quarto.mappedString.fromFile(file);
        }
        const metadata = quarto.markdownRegex.extractYaml(markdown.value);
        return {
          source: file,
          input: file,
          markdown,
          metadata,
        };
      },

      partitionedMarkdown: async (file) => {
        const markdown = quarto.mappedString.fromFile(file);
        return quarto.markdownRegex.partition(markdown.value);
      },

      execute: async (options) => {
        const chunks = await quarto.markdownRegex.breakQuartoMd(
          options.target.markdown,
        );

        const processedCells = [];
        for (const cell of chunks.cells) {
          if (
            typeof cell.cell_type === "object" &&
            cell.cell_type.language === "python"
          ) {
            const header = cell.sourceVerbatim.value.split(/\r?\n/)[0];
            const hasClassFoo = /\.foo\b/.test(header);
            if (hasClassFoo) {
              processedCells.push(`::: {#bar-engine-marker .bar-engine-output}
**BAR ENGINE PROCESSED THIS BLOCK**

Original code:
\`\`\`python
${cell.source.value.trim()}
\`\`\`
:::
`);
              continue;
            }
          }
          processedCells.push(cell.sourceVerbatim.value);
        }

        return {
          markdown: processedCells.join(""),
          supporting: [],
          filters: [],
        };
      },

      dependencies: async (_options) => {
        return { includes: {} };
      },

      postprocess: async (_options) => {},
    };
  },
};

export default barEngineDiscovery;
