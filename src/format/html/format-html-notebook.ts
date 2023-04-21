/*
 * format-html-embed.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
  kTo,
} from "../../config/constants.ts";
import { Format, NotebookPublishOptions } from "../../config/types.ts";

import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";

import { basename, dirname, isAbsolute, join, relative } from "path/mod.ts";
import { renderFiles } from "../../command/render/render-files.ts";
import { ProjectContext } from "../../project/types.ts";
import { kNotebookViewStyleNotebook } from "./format-html-constants.ts";
import { warning } from "log/mod.ts";

interface NotebookView {
  title: string;
  href: string;
  supporting?: string[];
}

interface NotebookViewOptions {
  title: string;
  href?: string;
}

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

        const prevSibling = cellEl.previousElementSibling;
        if (
          prevSibling &&
          prevSibling.tagName === "DIV" &&
          prevSibling.classList.contains("cell-code")
        ) {
          // If the previous sibling is a cell-code, that is the code cell
          // for this output and we should grab it too
          cell.parentElement?.insertBefore(containerNode, cell);

          // Grab the previous element too
          const wrapperDiv = doc.createElement("div");
          containerNode.appendChild(wrapperDiv);

          // move the cells
          wrapperDiv.appendChild(prevSibling.cloneNode(true));
          prevSibling.remove();

          wrapperDiv.appendChild(cell);
        } else {
          cell.parentElement?.insertBefore(containerNode, cell);
          containerNode.appendChild(cell);
        }
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
  services: RenderServices,
  project?: ProjectContext,
) {
  const inline = format.render[kNotebookLinks] === "inline" ||
    format.render[kNotebookLinks] === true;
  const global = format.render[kNotebookLinks] === "global" ||
    format.render[kNotebookLinks] === true;
  const notebookView = format.render[kNotebookView] ?? true;
  const nbViewConfig = notebookViewConfig(notebookView);

  const notebookDivNodes = doc.querySelectorAll("[data-notebook]");
  if (notebookDivNodes.length > 0) {
    const nbPaths: Record<
      string,
      { href: string; title: string; supporting?: string; filename?: string }
    > = {};
    let count = 1;

    // Emit links to the notebooks inline (where the embedded content is located)
    const linkedNotebooks: string[] = [];
    for (const nbDivNode of notebookDivNodes) {
      const nbDivEl = nbDivNode as Element;
      const notebookPath = nbDivEl.getAttribute("data-notebook");
      nbDivEl.removeAttribute("data-notebook");
      if (notebookPath) {
        linkedNotebooks.push(notebookPath);
        const title = nbDivEl.getAttribute("data-notebook-title");
        nbDivEl.removeAttribute("data-notebook-title");
        const nbDir = dirname(notebookPath);
        const filename = basename(notebookPath);
        const inputDir = dirname(input);

        const nbView = async () => {
          if (nbViewConfig) {
            // Read options for this notebook
            const nbPreviewOptions = nbViewConfig.options(notebookPath);

            const nbAbsPath = isAbsolute(notebookPath)
              ? notebookPath
              : join(inputDir, notebookPath);
            const htmlPreview = await renderHtmlView(
              inputDir,
              nbAbsPath,
              nbPreviewOptions,
              format,
              services,
              project,
            );
            return {
              title: htmlPreview.title,
              href: htmlPreview.href,
              supporting: htmlPreview.supporting,
            };
          } else {
            return {
              href: join(nbDir, filename),
              title: title || filename,
              filename,
            };
          }
        };
        const nbPath = nbPaths[notebookPath] || await nbView();
        nbPaths[notebookPath] = nbPath;

        // Add a decoration to this div node
        if (inline) {
          const id = "nblink-" + count++;

          // If the first element of the notebook cell is a cell div with an id
          // then use that as the hash
          let firstCellId;
          if (
            nbDivEl.firstElementChild &&
            nbDivEl.firstElementChild.classList.contains("cell")
          ) {
            firstCellId = nbDivEl.firstElementChild.getAttribute("id");
          }

          const nbLinkEl = doc.createElement("a");
          nbLinkEl.classList.add("quarto-notebook-link");
          nbLinkEl.setAttribute("id", `${id}`);

          if (nbPath.filename) {
            nbLinkEl.setAttribute("download", nbPath.filename);
            nbLinkEl.setAttribute("href", nbPath.href);
          } else {
            if (firstCellId) {
              nbLinkEl.setAttribute("href", `${nbPath.href}#${firstCellId}`);
            } else {
              nbLinkEl.setAttribute("href", `${nbPath.href}`);
            }
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
      const allPaths = Object.values(nbPaths);
      ld.uniqBy(allPaths, (nbPath: { href: string; title?: string }) => {
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

    const supporting: string[] = [];
    const resources: string[] = [];
    for (const notebookPath of Object.keys(nbPaths)) {
      const nbPath = nbPaths[notebookPath];
      // If there is a view configured for this, then
      // include it in the supporting dir
      if (nbPath.supporting) {
        supporting.push(...nbPath.supporting);
      }

      // This is the notebook itself
      resources.push(notebookPath);
    }

    return {
      resources,
      supporting,
    };
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
  project?: ProjectContext,
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
    const templatePath = services.temp.createFile({ suffix: ".html" });
    Deno.writeTextFileSync(templatePath, embedTemplate);

    // Render the notebook and update the path
    const nbPreviewFile = `${filename}.html`;
    const rendered = await renderFiles(
      [{ path: nbAbsPath, formats: ["html"] }],
      {
        services,
        flags: {
          metadata: {
            [kTo]: "html",
            [kTheme]: format.metadata[kTheme],
            [kOutputFile]: nbPreviewFile,
            [kTemplate]: templatePath,
            [kNotebookViewStyle]: kNotebookViewStyleNotebook,
          },
          quiet: true,
        },
      },
      undefined,
      undefined,
      project,
    );
    if (rendered.error) {
      // TODO: This should throw in future releases rather than warn
      // Only adding warning for now because of timing of release of 1.3
      warning(`Failed to render preview for notebook ${nbAbsPath}`);
    }

    const nbPreviewPath = join(inputDir, dirname(href), nbPreviewFile);
    const supporting = [nbPreviewPath];
    for (const renderedFile of rendered.files) {
      if (renderedFile.supporting) {
        supporting.push(...renderedFile.supporting.map((file) => {
          return isAbsolute(file) ? file : join(inputDir, file);
        }));
      }
    }

    return {
      title: options.title,
      href: join(dirname(href), nbPreviewFile),
      // notebook to be included as supporting file
      supporting,
    };
  } else {
    return {
      title: options.title,
      href: options.href,
    };
  }
}
