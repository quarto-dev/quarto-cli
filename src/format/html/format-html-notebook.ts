/*
* format-html-embed.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { formatResourcePath } from "../../core/resources.ts";
import { renderEjs } from "../../core/ejs.ts";
import { asArray } from "../../core/array.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import * as ld from "../../core/lodash.ts";

import {
  kNotebookLinks,
  kNotebookView,
  kNotebookViewStyle,
  kOutputFile,
  kRelatedNotebooksTitle,
  kSourceNotebookPrefix,
  kTemplate,
  kTheme,
} from "../../config/constants.ts";
import { Format, NotebookPublishOptions } from "../../config/types.ts";

import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";

import { basename, dirname, join, relative } from "path/mod.ts";
import { renderFiles } from "../../command/render/render-files.ts";

interface NotebookView {
  title: string;
  href: string;
}

interface NotebookViewOptions {
  title: string;
  href?: string;
}

export const kNotebookViewStyleNotebook = "notebook";

const kQuartoNbClass = "quarto-notebook";
const kQuartoCellContainerClass = "cell-container";
const kQuartoCellDecoratorClass = "cell-decorator";

// Post processes the notebook and adds 'notebook' style affordances
export function notebookViewPostProcessor() {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    doc.body.classList.add(kQuartoNbClass);
    const cells = doc.querySelectorAll("div.cell[data-execution_count]");
    for (const cell of cells) {
      const cellEl = cell as Element;
      const count = cellEl.getAttribute("data-execution_count");
      if (count) {
        const containerNode = doc.createElement("div");
        containerNode.classList.add(kQuartoCellContainerClass);
        containerNode.classList.add("column-page-left");

        const decoratorNode = doc.createElement("div");
        decoratorNode.classList.add(kQuartoCellDecoratorClass);

        const contentsEl = doc.createElement("pre");
        contentsEl.appendChild(doc.createTextNode(`In [${count}]:`));
        decoratorNode.appendChild(contentsEl);

        containerNode.appendChild(decoratorNode);
        cell.parentElement?.insertBefore(containerNode, cell);
        containerNode.appendChild(cell);
      }
    }

    const resources: string[] = [];
    const supporting: string[] = [];
    return Promise.resolve({
      resources,
      supporting,
    });
  };
}

// Processes embeds within an HTML page and emits notebook previews as apprpriate
export async function processNotebookEmbeds(
  input: string,
  doc: Document,
  format: Format,
  resources: string[],
  services: RenderServices,
) {
  const inline = format.render[kNotebookLinks] === "inline" ||
    format.render[kNotebookLinks] === true;
  const global = format.render[kNotebookLinks] === "global" ||
    format.render[kNotebookLinks] === true;
  const notebookView = format.render[kNotebookView] ?? true;
  const nbViewConfig = notebookViewConfig(notebookView);

  const notebookDivNodes = doc.querySelectorAll("[data-notebook]");
  if (notebookDivNodes.length > 0) {
    const nbPaths: { href: string; title: string; filename?: string }[] = [];
    let count = 1;

    // Emit links to the notebooks inline (where the embedded content is located)
    const linkedNotebooks: string[] = [];
    for (const nbDivNode of notebookDivNodes) {
      const nbDivEl = nbDivNode as Element;
      const notebookPath = nbDivEl.getAttribute("data-notebook");
      if (notebookPath) {
        linkedNotebooks.push(notebookPath);
        const title = nbDivEl.getAttribute("data-notebook-title");
        const nbDir = dirname(notebookPath);
        const filename = basename(notebookPath);
        const inputDir = dirname(input);

        const nbView = async () => {
          if (nbViewConfig) {
            // Read options for this notebook
            const nbPreviewOptions = nbViewConfig.options(notebookPath);

            const nbAbsPath = join(inputDir, notebookPath);
            const htmlPreview = await renderHtmlView(
              inputDir,
              nbAbsPath,
              nbPreviewOptions,
              format,
              services,
            );
            return {
              title: htmlPreview.title,
              href: htmlPreview.href,
            };
          } else {
            return {
              href: join(nbDir, filename),
              title: title || filename,
              filename,
            };
          }
        };
        const nbPath = await nbView();
        nbPaths.push(nbPath);

        // Add a decoration to this div node
        if (inline) {
          const id = "nblink-" + count++;

          const nbLinkEl = doc.createElement("a");
          nbLinkEl.classList.add("quarto-notebook-link");
          nbLinkEl.setAttribute("id", `${id}`);
          nbLinkEl.setAttribute("href", nbPath.href);
          if (nbPath.filename) {
            nbLinkEl.setAttribute("download", nbPath.filename);
          }
          nbLinkEl.appendChild(
            doc.createTextNode(
              `${format.language[kSourceNotebookPrefix]}: ${nbPath.title}`,
            ),
          );

          // If there is a figure caption, place the source after that
          // otherwise just place it at the bottom of the notebook div
          const nbParentEl = nbDivEl.parentElement;
          if (nbParentEl?.tagName.toLocaleLowerCase() === "figure") {
            const figCapEl = nbDivEl.parentElement?.querySelector("figcaption");
            if (figCapEl) {
              figCapEl.after(nbLinkEl);
            } else {
              nbDivEl.appendChild(nbLinkEl);
            }
          } else {
            nbDivEl.appendChild(nbLinkEl);
          }
        }
      }
    }

    // Emit global links to the notebooks
    if (global) {
      const containerEl = doc.createElement("div");
      containerEl.classList.add("quarto-alternate-notebooks");

      const heading = doc.createElement("h2");
      if (format.language[kRelatedNotebooksTitle]) {
        heading.innerText = format.language[kRelatedNotebooksTitle];
      }
      containerEl.appendChild(heading);

      const formatList = doc.createElement("ul");
      containerEl.appendChild(formatList);
      ld.uniqBy(nbPaths, (nbPath: { href: string; title?: string }) => {
        return nbPath.href;
      }).forEach((nbPath) => {
        const li = doc.createElement("li");

        const link = doc.createElement("a");
        link.setAttribute("href", nbPath.href);
        if (nbPath.filename) {
          link.setAttribute("download", nbPath.filename);
        }

        const icon = doc.createElement("i");
        icon.classList.add("bi");
        icon.classList.add(`bi-journal-code`);
        link.appendChild(icon);
        link.appendChild(
          doc.createTextNode(nbPath.title),
        );

        li.appendChild(link);
        formatList.appendChild(li);

        resources.push(nbPath.href);
      });
      let dlLinkTarget = doc.querySelector(`nav[role="doc-toc"]`);
      if (dlLinkTarget === null) {
        dlLinkTarget = doc.querySelector("#quarto-margin-sidebar");
      }

      if (dlLinkTarget) {
        dlLinkTarget.appendChild(containerEl);
      }
    }

    // Validate that there are no unused notebooks in the front matter
    if (nbViewConfig) {
      nbViewConfig.unused(linkedNotebooks);
    }

    const inputDir = dirname(input);
    return nbPaths.map((nbPath) => {
      return join(inputDir, nbPath.href);
    });
  }
}

function notebookViewConfig(
  notebookPublish?: boolean | NotebookPublishOptions | NotebookPublishOptions[],
) {
  const nbOptions: Record<string, NotebookViewOptions> = {};
  if (notebookPublish) {
    if (typeof (notebookPublish) !== "boolean") {
      asArray(notebookPublish).forEach((pub) => {
        nbOptions[pub.notebook] = {
          title: pub.title || basename(pub.notebook),
          href: pub.url,
        };
      });
    }
    return {
      options: (notebook: string) => {
        return nbOptions[notebook] || { title: basename(notebook) };
      },
      unused: (notebooks: string[]) => {
        Object.keys(nbOptions).forEach((nb) => {
          if (!notebooks.includes(nb)) {
            throw new Error(
              `The notebook ${nb} is included in 'notebook-view' but isn't used to embed content. Please remove it from 'notebook-view'.`,
            );
          }
        });
      },
    };
  } else {
    return undefined;
  }
}

// Renders an HTML preview of a notebook
async function renderHtmlView(
  inputDir: string,
  nbAbsPath: string,
  options: NotebookViewOptions,
  format: Format,
  services: RenderServices,
): Promise<NotebookView> {
  const filename = basename(nbAbsPath);
  const href = relative(inputDir, nbAbsPath);

  if (options.href === undefined) {
    // Use the special `embed` template for this render
    const embedHtmlEjs = formatResourcePath(
      "html",
      join("embed", "template.ejs.html"),
    );
    const embedTemplate = renderEjs(embedHtmlEjs, {
      title: options.title,
      path: href,
      filename,
    });
    const templatePath = services.temp.createFile({ suffix: "html" });
    Deno.writeTextFileSync(templatePath, embedTemplate);

    // Render the notebook and update the path
    const nbPreviewFile = `${filename}.html`;
    await renderFiles([{ path: nbAbsPath }], {
      services,
      flags: {
        metadata: {
          [kTheme]: format.metadata[kTheme],
          [kOutputFile]: nbPreviewFile,
          [kTemplate]: templatePath,
          [kNotebookViewStyle]: kNotebookViewStyleNotebook,
        },
        quiet: true,
      },
    });

    return {
      title: options.title,
      href: join(dirname(href), nbPreviewFile),
    };
  } else {
    return {
      title: options.title,
      href: options.href,
    };
  }
}
