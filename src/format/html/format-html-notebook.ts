/*
 * format-html-notebook.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Document, Element } from "../../core/deno-dom.ts";
import * as ld from "../../core/lodash.ts";

import {
  kNotebookLinks,
  kNotebookView,
  kNotebookViewStyle,
  kRelatedNotebooksTitle,
  kSourceNotebookPrefix,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";

import { basename, dirname, isAbsolute, join, relative } from "../../deno_ral/path.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  NotebookPreview,
  notebookPreviewer,
} from "./format-html-notebook-preview.ts";
import { projectIsBook } from "../../project/project-shared.ts";

const kQuartoNbClass = "quarto-notebook";
const kQuartoCellContainerClass = "cell-container";
const kQuartoCellDecoratorClass = "cell-decorator";

// Post processes the notebook and adds 'notebook' style affordances
export function notebookViewPostProcessor() {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    doc.body.classList.add(kQuartoNbClass);
    const cells = doc.querySelectorAll("div.cell");
    let cellCount = 0;
    for (const cell of cells) {
      const cellEl = cell as Element;
      const count = cellEl.getAttribute("data-execution_count") || ++cellCount;
      const isMarkdown = cellEl.classList.contains("markdown");
      const hasCodeFolding = cellEl.querySelector("details.code-fold") !== null;

      if (!isMarkdown) {
        const containerNode = doc.createElement("div");
        containerNode.classList.add(kQuartoCellContainerClass);
        containerNode.classList.add("column-page-left");
        if (hasCodeFolding) {
          containerNode.classList.add("code-fold");
        }

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
// Perhaps in render services or elsewhere, we can pass a notebook renderer that will
// demand render a notebook (or use an already rendered notebook if it was discovered as a part of
// a project and rendered to the correct format)
//
export async function emplaceNotebookPreviews(
  input: string,
  doc: Document,
  format: Format,
  services: RenderServices,
  project: ProjectContext,
  output?: string,
  quiet?: boolean,
) {
  // The notebook view configuration data
  const notebookView = format.render[kNotebookView] ?? true;
  // The view style for the notebook
  const notebookViewStyle = format.render[kNotebookViewStyle];

  // Embedded notebooks don't currently resolve notebooks
  if (notebookViewStyle === "notebook") {
    return { resources: [], supporting: [] };
  }

  // Books don't currently support notebook previews
  const isBook = projectIsBook(project);
  if (notebookView !== false && !isBook) {
    // Utilities and settings for dealing with notebook links
    const inline = format.render[kNotebookLinks] === "inline" ||
      format.render[kNotebookLinks] === true;
    const global = format.render[kNotebookLinks] === "global" ||
      format.render[kNotebookLinks] === true;
    const addInlineLineNotebookLink = inlineLinkGenerator(doc, format);

    // Helper interface for creating notebook previews
    const previewer = notebookPreviewer(
      notebookView,
      format,
      services,
      project,
    );

    // Process the root document itself, looking for
    // computational cells provided by this document itself and if
    // needed, synthesizing a notebook for them
    // (only do this if this is a root document
    // and input itself is in the list of notebooks)
    const inputNbName = basename(input);
    if (previewer.descriptor(inputNbName)) {
      const computationalNodes = doc.querySelectorAll("div.cell");
      for (const computationalNode of computationalNodes) {
        const computeEl = computationalNode as Element;
        const cellId = computeEl.getAttribute("id");
        previewer.enQueuePreview(
          input,
          input,
          undefined, // title
          undefined, // order
          (nbPreview) => {
            // If this is a cell _in_ a source notebook, it will not be parented
            // by an embed cell
            if (inline) {
              if (
                !computeEl.parentElement?.classList.contains(
                  "quarto-embed-nb-cell",
                )
              ) {
                addInlineLineNotebookLink(
                  computeEl,
                  nbPreview,
                  cellId,
                );
              }
            }
          },
        );
      }
    }

    // For any notebooks explicitly provided, ensure they are rendered
    if (typeof notebookView !== "boolean") {
      const nbs = Array.isArray(notebookView) ? notebookView : [notebookView];
      for (const nb of nbs) {
        // Filter out the root article notebook, since that was resolved
        // above.
        if (nb.url === undefined && inputNbName !== nb.notebook) {
          const nbAbsPath = isAbsolute(nb.notebook)
            ? nb.notebook
            : join(dirname(input), nb.notebook);
          previewer.enQueuePreview(input, nbAbsPath, nb.title, nb.order);
        }
      }
    }

    // Process embedded notebook contents,
    // emitting links to the notebooks inline (where the embedded content is located)
    const notebookDivNodes = doc.querySelectorAll("[data-notebook]");
    for (const nbDivNode of notebookDivNodes) {
      const nbDivEl = nbDivNode as Element;
      const notebookPath = nbDivEl.getAttribute("data-notebook");
      nbDivEl.removeAttribute("data-notebook");

      const notebookCellId = nbDivEl.getAttribute("data-notebook-cellId");
      nbDivEl.removeAttribute("data-notebook-cellId");

      const title = nbDivEl.getAttribute("data-notebook-title");
      nbDivEl.removeAttribute("data-notebook-title");

      if (notebookPath) {
        previewer.enQueuePreview(
          input,
          nbAbsPath(input, notebookPath),
          title === null ? undefined : title,
          undefined, // order
          (nbPreview) => {
            // Add a decoration to this div node
            if (inline) {
              addInlineLineNotebookLink(nbDivEl, nbPreview, notebookCellId);
            }
          },
        );
      }
    }

    // Render the notebook previews
    const previews = await previewer.renderPreviews(output, quiet);

    // Get the preview notebooks in the correct order
    const previewNotebooks = Object.values(previews).sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      } else if (a.order !== undefined && b.order === undefined) {
        return -1;
      } else if (a.order === undefined && b.order !== undefined) {
        return 1;
      } else {
        return a.title.localeCompare(b.title);
      }
    });

    // Emit global links to the notebooks
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
    for (const notebookPath of Object.keys(previews)) {
      const nbPath = previews[notebookPath];
      // If there is a view configured for this, then
      // include it in the supporting dir
      if (nbPath.supporting) {
        supporting.push(...nbPath.supporting);
      }

      if (nbPath.resources) {
        resources.push(...nbPath.resources.map((file) => {
          return project ? relative(project?.dir, file) : file;
        }));
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

const nbAbsPath = (input: string, nbPath: string) => {
  if (isAbsolute(nbPath)) {
    return nbPath;
  }

  // Ensure that the input path is absolute
  const inputAbsPath = isAbsolute(input) ? input : join(Deno.cwd(), input);

  // Ensure that the notebook path is absolute
  return join(dirname(inputAbsPath), nbPath);
};

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
