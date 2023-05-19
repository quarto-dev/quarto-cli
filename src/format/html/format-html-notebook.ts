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
  kClearHiddenClasses,
  kDownloadUrl,
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
import { Format, NotebookPreviewDescriptor } from "../../config/types.ts";

import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";

import { basename, dirname, isAbsolute, join, relative } from "path/mod.ts";
import { renderFiles } from "../../command/render/render-files.ts";
import { kNotebookViewStyleNotebook } from "./format-html-constants.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { kAppendixStyle } from "./format-html-shared.ts";
import { ProjectContext } from "../../project/types.ts";
import { StringReader } from "https://deno.land/std@0.185.0/io/string_reader.ts";

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
export async function emplaceNotebookPreviews(
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

  const notebookViewStyle = format.render[kNotebookViewStyle];

  // Embedded notebooks don't currently resolve notebooks
  if (notebookViewStyle === "notebook") {
    return { resources: [], supporting: [] };
  }

  const addInlineLineNotebookLink = inlineLinkGenerator(doc, format);

  if (notebookView !== false) {
    const previewer = nbPreviewer(notebookView, format, services, project);

    // Look for computational cells provided by this document itself and if
    // needed, synthesize a notebook for them (only do this if this is a root document
    // and input itself is in the list of notebooks)
    const inputNbPath = basename(input);
    const computationalNodes = doc.querySelectorAll("div.cell");
    for (const computationalNode of computationalNodes) {
      const computeEl = computationalNode as Element;
      const cellId = computeEl.getAttribute("id");
      const nbPreview = await previewer.preview(
        input,
        inputNbPath,
      );
      if (inline) {
        addInlineLineNotebookLink(
          computeEl,
          nbPreview,
          cellId,
        );
      }
    }

    // Emit links to the notebooks inline (where the embedded content is located)
    const notebookDivNodes = doc.querySelectorAll("[data-notebook]");
    for (const nbDivNode of notebookDivNodes) {
      const nbDivEl = nbDivNode as Element;
      const notebookPath = nbDivEl.getAttribute("data-notebook");
      nbDivEl.removeAttribute("data-notebook");

      const notebookCellId = nbDivEl.getAttribute("data-notebook-cellId");
      nbDivEl.removeAttribute("data-notebook-cellId");

      const title = nbDivEl.getAttribute("data-notebook-title");
      nbDivEl.removeAttribute("data-notebook-title");

      const notebookPreviewFile = nbDivEl.getAttribute(
        "data-notebook-preview-file",
      );
      nbDivEl.removeAttribute("data-notebook-preview-file");

      if (notebookPath) {
        const nbPreview = await previewer.preview(
          input,
          notebookPath,
          title === null ? undefined : title,
          notebookPreviewFile === null ? undefined : notebookPreviewFile,
        );

        // Add a decoration to this div node
        if (inline) {
          addInlineLineNotebookLink(nbDivEl, nbPreview, notebookCellId);
        }
      }
    }

    // For any notebooks explicitly provided, ensure they are rendered
    if (typeof (notebookView) !== "boolean") {
      const nbs = Array.isArray(notebookView) ? notebookView : [notebookView];
      for (const nb of nbs) {
        if (nb.url === undefined) {
          await previewer.preview(input, nb.notebook, nb.title);
        }
      }
    }

    // Emit global links to the notebooks
    const previewNotebooks = Object.values(previewer.previews);
    if (global && previewNotebooks.length > 0) {
      const containerEl = doc.createElement("div");
      containerEl.classList.add("quarto-alternate-notebooks");

      const heading = doc.createElement("h2");
      if (format.language[kRelatedNotebooksTitle]) {
        heading.innerText = format.language[kRelatedNotebooksTitle];
      }
      containerEl.appendChild(heading);

      const formatList = doc.createElement("ul");
      containerEl.appendChild(formatList);
      ld.uniqBy(
        previewNotebooks,
        (nbPath: { href: string; title?: string }) => {
          return nbPath.href;
        },
      ).forEach((nbPath) => {
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

    const supporting: string[] = [];
    const resources: string[] = [];
    for (const notebookPath of Object.keys(previewer.previews)) {
      const nbPath = previewer.previews[notebookPath];
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

const inlineLinkGenerator = (doc: Document, format: Format) => {
  let count = 1;
  return (
    nbDivEl: Element,
    nbPreview: NotebookPreview,
    cellId?: string | null,
  ) => {
    const id = "nblink-" + count++;

    const nbLinkEl = doc.createElement("a");
    nbLinkEl.classList.add("quarto-notebook-link");
    nbLinkEl.setAttribute("id", `${id}`);

    if (nbPreview.filename) {
      nbLinkEl.setAttribute("download", nbPreview.filename);
      nbLinkEl.setAttribute("href", nbPreview.href);
    } else {
      if (cellId) {
        nbLinkEl.setAttribute(
          "href",
          `${nbPreview.href}#${cellId}`,
        );
      } else {
        nbLinkEl.setAttribute("href", `${nbPreview.href}`);
      }
    }
    nbLinkEl.appendChild(
      doc.createTextNode(
        `${format.language[kSourceNotebookPrefix]}: ${nbPreview.title}`,
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
  };
};

interface NotebookPreview {
  title: string;
  href: string;
  filename?: string;
  supporting?: string[];
}

const nbPreviewer = (
  nbView: boolean | NotebookPreviewDescriptor | NotebookPreviewDescriptor[],
  format: Format,
  services: RenderServices,
  project?: ProjectContext,
) => {
  const nbPreviews: Record<
    string,
    { href: string; title: string; supporting?: string[]; filename?: string }
  > = {};

  const nbDescriptors: Record<string, NotebookPreviewDescriptor> = {};
  if (nbView) {
    if (typeof (nbView) !== "boolean") {
      asArray(nbView).forEach((view) => {
        const existingView = nbDescriptors[view.notebook];
        nbDescriptors[view.notebook] = {
          ...existingView,
          ...view,
        };
      });
    }
  }
  const renderPreview = nbView !== false;

  const preview = async (
    input: string,
    nbPath: string,
    title?: string,
    nbPreviewFile?: string,
  ): Promise<NotebookPreview> => {
    // Renders the notebook preview
    const renderNotebook = async () => {
      const nbDir = dirname(nbPath);
      const filename = basename(nbPath);
      const inputDir = dirname(input);
      if (renderPreview) {
        // Read options for this notebook
        const descriptor: NotebookPreviewDescriptor | undefined =
          nbDescriptors[nbPath];
        const nbAbsPath = isAbsolute(nbPath) ? nbPath : join(inputDir, nbPath);
        const htmlPreview = await renderHtmlView(
          inputDir,
          nbAbsPath,
          {
            title: title || descriptor?.title || basename(nbPath),
            previewFileName: nbPreviewFile || `${basename(nbPath)}.html`,
            url: descriptor?.url,
            downloadUrl: descriptor?.[kDownloadUrl],
          },
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
          href: pathWithForwardSlashes(join(nbDir, filename)),
          title: title || filename,
          filename,
        };
      }
    };

    // Render each notebook only once
    if (!nbPreviews[nbPath]) {
      nbPreviews[nbPath] = await renderNotebook();
    }
    return nbPreviews[nbPath];
  };

  return {
    preview,
    previews: nbPreviews,
  };
};

export interface HtmlNotebookPreviewOptions {
  title: string;
  url?: string;
  previewFileName: string;
  downloadUrl?: string;
}

// Renders an HTML preview of a notebook
async function renderHtmlView(
  inputDir: string,
  nbAbsPath: string,
  options: HtmlNotebookPreviewOptions,
  format: Format,
  services: RenderServices,
  project?: ProjectContext,
): Promise<NotebookView> {
  // Compute the preview title
  if (options.url === undefined) {
    // Use the special `embed` template for this render
    const embedHtmlEjs = formatResourcePath(
      "html",
      join("embed", "template.ejs.html"),
    );
    const embedTemplate = renderEjs(embedHtmlEjs, {
      title: options.title,
      path: options.downloadUrl || basename(nbAbsPath),
      filename: options.downloadUrl ? undefined : basename(nbAbsPath),
    });
    const templatePath = services.temp.createFile({ suffix: ".html" });
    Deno.writeTextFileSync(templatePath, embedTemplate);

    // Render the notebook and update the path
    const rendered = await renderFiles(
      [{ path: nbAbsPath, formats: ["html"] }],
      {
        services,
        flags: {
          metadata: {
            [kTo]: "html",
            [kTheme]: format.metadata[kTheme],
            [kOutputFile]: options.previewFileName,
            [kTemplate]: templatePath,
            [kNotebookViewStyle]: kNotebookViewStyleNotebook,
            [kAppendixStyle]: "none",
            [kClearHiddenClasses]: true,
          },
          quiet: true,
        },
        echo: true,
        warning: true,
      },
      [],
      undefined,
      project,
    );
    if (rendered.error) {
      throw new Error(`Failed to render preview for notebook ${nbAbsPath}`, {
        cause: rendered.error,
      });
    }

    const nbRelPath = relative(inputDir, nbAbsPath);
    const nbPreviewPath = join(
      inputDir,
      dirname(nbRelPath),
      options.previewFileName,
    );
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
      href: pathWithForwardSlashes(
        join(dirname(nbRelPath), options.previewFileName),
      ),
      // notebook to be included as supporting file
      supporting,
    };
  } else {
    return {
      title: options.title,
      href: options.url,
    };
  }
}
