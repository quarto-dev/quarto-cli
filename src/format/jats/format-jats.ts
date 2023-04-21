/*
* format-jats.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import {
  kDefaultImageExtension,
  kLinkCitations,
  kNotebookSubarticles,
  kOutputExt,
  kQuartoInternal,
  kVariant,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { createFormat } from "../formats-shared.ts";

import { warning } from "log/mod.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { extname, join } from "path/mod.ts";
import { reformat } from "../../core/xml.ts";
import { RenderContext, RenderServices } from "../../command/render/types.ts";
import {
  kNoteBookExtension,
  NotebooksFormatExtension,
} from "../format-extensions.ts";
import {
  JupyterMarkdownOptions,
  notebookMarkdown,
} from "../../core/jupyter/jupyter-embed.ts";
import { jupyterAssets } from "../../core/jupyter/jupyter.ts";
import { runPandoc } from "../../command/render/pandoc.ts";
import { dirAndStem } from "../../core/path.ts";
import { renderFormats } from "../../command/render/render-contexts.ts";
import { kJatsSubarticle } from "./format-jats-types.ts";
import { inputExtensionDirs } from "../../extension/extension.ts";
import { JupyterCell } from "../../core/jupyter/types.ts";

const kJatsExtended = "jats-extended";
const kJatsDtd = "jats-dtd";
const kElementsVariant = "+element_citations";
const kLintXml = "_lint-jats-xml-output";

export function jatsFormat(displayName: string, ext: string): Format {
  return createFormat(displayName, ext, {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
    render: {
      [kVariant]: kElementsVariant,
    },
    formatExtras: (
      _input: string,
      _markdown: string,
      _flags: PandocFlags,
      format: Format,
      _libDir: string,
      _services: RenderServices,
      _offset?: string,
      _project?: ProjectContext,
    ) => {
      // Provide a template and partials
      const templateDir = formatResourcePath("jats", "pandoc");
      const partials = [
        "front.xml",
        "authors.xml",
        "institution.xml",
        "name.xml",
      ];
      const templateContext = {
        template: join(templateDir, "template.xml"),
        partials: partials.map((partial) => join(templateDir, partial)),
      };

      // Which tagset we're using
      const tagset = jatsTagset(format.identifier["base-format"] || "jats");

      const metadataOverride = {
        // Link citations produces `xrefs` for the citations to the references in the bibliography so
        // must be enabled
        [kLinkCitations]: true,
      };
      // If this has been explicitly disabled, warn the user that the setting is being ignored
      if (format.metadata[kLinkCitations] === false) {
        warning(
          "JATS formats require that `link-citations` is enabled to emit well formed JATS. Explicitly set value is being ignored.",
        );
      }

      const reformatXmlPostProcessor = async (output: string) => {
        await reformat(output);
      };

      return {
        metadata: {
          [kQuartoInternal]: {
            // These signal the template with flags controlling the tagset to be output
            [kJatsExtended]: tagset === "archiving" || tagset === "publishing",
            [kJatsDtd]: jatsDtd(tagset),
          },
        },
        templateContext,
        metadataOverride,
        postprocessors: format.metadata[kLintXml] !== false
          ? [reformatXmlPostProcessor]
          : [],
      };
    },
    extensions: {
      [kNoteBookExtension]: jatsNotebookExtension,
    },
  });
}

type JatsTagset = "archiving" | "publishing" | "authoring";
interface DTDInfo {
  name: string;
  location: string;
}

const kTagSets: Record<string, JatsTagset> = {
  "jats": "archiving",
  "jats_archiving": "archiving",
  "jats_publishing": "publishing",
  "jats_articleauthoring": "authoring",
};
function jatsTagset(to: string): JatsTagset {
  return kTagSets[to];
}

const kDJatsDtds: Record<JatsTagset, DTDInfo> = {
  "archiving": {
    name:
      "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2 20190208//EN",
    location: "JATS-archivearticle1.dtd",
  },
  "publishing": {
    name: "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.2 20190208//EN",
    location: "JATS-publishing1.dtd",
  },
  "authoring": {
    name: "-//NLM//DTD JATS (Z39.96) Article Authoring DTD v1.2 20190208//EN",
    location: "JATS-articleauthoring1.dtd",
  },
};

function jatsDtd(tagset: JatsTagset) {
  return kDJatsDtds[tagset];
}

const notebookPathForDocument = (path: string) => {
  if (extname(path) === ".ipynb") {
    return path;
  }
};

interface NotebookSubarticle {
  path: string;
  filter?: (cell: JupyterCell) => boolean;
}

export const jatsNotebookExtension: NotebooksFormatExtension = {
  processNotebooks: async function (
    input: string,
    format: Format,
    notebooks: string[],
    context: RenderContext,
  ) {
    if (format.render[kNotebookSubarticles] !== false) {
      // The working directory that we'll use for rendering
      const wd = context.options.services.temp.createDir();

      // Accumulate the subarticles and their resources
      const subarticlePaths: string[] = [];
      const subarticleResources: string[] = [];

      // See if the input itself should be processed-
      // if so, add it to the list of notebooks to render
      // and add a filter to include only code cells.
      const subarticleNotebooks = notebooks.map((nb) => {
        return {
          path: nb,
        };
      }) as NotebookSubarticle[];
      const notebookPath = notebookPathForDocument(input);
      if (notebookPath) {
        subarticleNotebooks.push({
          path: input,
          filter: (cell: JupyterCell) => {
            return cell.cell_type == "code";
          },
        });
      }

      // Accumulate markdown files that will be rendered
      // into JATS sub-articles
      for (const notebook of subarticleNotebooks) {
        // Render the notebook to a markdown file
        const inputMdFile = await writeNotebookMarkdown(
          input,
          notebook,
          format,
          context,
          wd,
        );

        // Render the notebook into a JATS subarticle
        if (inputMdFile) {
          const jatsResult = await renderJatsSubarticle(
            inputMdFile,
            format,
            context,
          );

          // Forward the rendered JATS and result along
          subarticlePaths.push(jatsResult.afterBody);
          if (jatsResult.supporting) {
            subarticleResources.push(...jatsResult.supporting);
          }
        }
      }

      return {
        includes: {
          afterBody: subarticlePaths,
        },
        supporting: subarticleResources,
      };
    } else {
      return {};
    }
  },
};

async function writeNotebookMarkdown(
  input: string,
  notebook: NotebookSubarticle,
  format: Format,
  context: RenderContext,
  workingDir: string,
) {
  // TODO: deal with subdir
  const [_nbDir, nbStem] = dirAndStem(notebook.path);
  const nbAddress = {
    path: notebook.path,
  };

  // TODO: ensure that echo forces code to be in notebook
  const nbOptions: JupyterMarkdownOptions = {
    echo: true,
    preserveCellMetadata: true,
    filter: notebook.filter,
  };

  // The assets target
  const assets = jupyterAssets(
    context.target.source,
    format.identifier["base-format"],
  );

  // Render the notebook markdown
  const nbMarkdown = await notebookMarkdown(
    input,
    nbAddress,
    assets,
    context,
    context.options.flags || {},
    nbOptions,
  );

  // The input file that we'll use to render
  // TODO: deal with subdir / ensure that there aren't name conflicts here
  if (nbMarkdown) {
    const inputMdFile = join(workingDir, `${nbStem}.md`);
    Deno.writeTextFileSync(inputMdFile, nbMarkdown);
    return inputMdFile;
  }
}

async function renderJatsSubarticle(
  inputMd: string,
  format: Format,
  context: RenderContext,
) {
  // Read the format from the input document
  const targetFormat = format.identifier["target-format"] || "jats";
  const formats = await renderFormats(inputMd, targetFormat);
  const nbFormat = formats[targetFormat];

  // Read the markdown
  const markdown = Deno.readTextFileSync(inputMd);

  // Compute the output file
  const [inputDir, inputStem] = dirAndStem(inputMd);
  const ext = format.render[kOutputExt] || "xml";
  const output = join(inputDir, `${inputStem}.${ext}`);

  // Use the subarticle template
  nbFormat.pandoc.template = formatResourcePath(
    "jats",
    join("pandoc", "subarticle", "template.xml"),
  );

  // Configure the JATS renderingats
  nbFormat.metadata[kLintXml] = false;
  nbFormat.metadata[kJatsSubarticle] = true;

  // Run pandoc to render the notebook
  const result = await runPandoc({
    markdown,
    source: inputMd,
    keepYaml: false,
    output,
    mediabagDir: "",
    libDir: "",
    format: nbFormat,
    args: [],
    services: context.options.services,
  }, []);

  // Run any post processors
  if (result?.postprocessors) {
    for (const postprocessor of result.postprocessors) {
      await postprocessor(output);
    }
  }

  return {
    afterBody: output,
    supporting: result?.resources,
  };
}
