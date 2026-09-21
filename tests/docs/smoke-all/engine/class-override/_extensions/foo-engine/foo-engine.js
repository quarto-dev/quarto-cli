// Minimal engine to test class-based engine override
// Claims {python.foo} blocks with priority 2 (higher than Jupyter's 1)

let quarto;

const fooEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },

  name: "foo",
  defaultExt: ".qmd",
  defaultYaml: () => ["engine: foo"],
  defaultContent: () => ["# Foo Engine Document"],
  validExtensions: () => [".qmd"],

  claimsFile: (_file, _ext) => false,

  claimsLanguage: (language, firstClass) => {
    // Claim python.foo with priority 2 (overrides Jupyter's 1)
    if (language === "python" && firstClass === "foo") {
      return 2;
    }
    return false; // Don't claim
  },

  canFreeze: false,
  generatesFigures: false,

  launch: (context) => {
    return {
      name: "foo",
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
              processedCells.push(`::: {#foo-engine-marker .foo-engine-output}
**FOO ENGINE PROCESSED THIS BLOCK**

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

export default fooEngineDiscovery;
