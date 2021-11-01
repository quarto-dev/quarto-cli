/*
* book-bibliography.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";
import { stringify } from "encoding/yaml.ts";
import { error } from "log/mod.ts";

import { Document, DOMParser, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { pathWithForwardSlashes } from "../../../core/path.ts";
import { execProcess } from "../../../core/process.ts";
import { pandocBinaryPath } from "../../../core/resources.ts";

import { kBibliography, kCsl } from "../../../config/constants.ts";
import { Metadata } from "../../../config/types.ts";

import { kProjectRender, ProjectContext } from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { inputTargetIndex, resolveInputTarget } from "../../project-index.ts";
import { WebsiteProjectOutputFile } from "../website/website.ts";
import { bookMultiFileHtmlOutputs } from "./book-extension.ts";

export async function bookBibliographyPostRender(
  context: ProjectContext,
  incremental: boolean,
  outputFiles: WebsiteProjectOutputFile[],
) {
  // make sure the references file exists and compute it's path
  const renderFiles = context.config?.project[kProjectRender] || [];

  let refsHtml: string | undefined;
  for (const file of renderFiles) {
    const index = await inputTargetIndex(context, file);
    if (index?.markdown.containsRefs) {
      const target = await resolveInputTarget(context, file, false);
      if (target) {
        refsHtml = join(projectOutputDir(context), target.outputHref);
      }
      break;
    }
  }

  // bail if there is no target refs file
  if (refsHtml && outputFiles.length > 0) {
    // determine the bibliography and the csl based on the first file
    const file = outputFiles[0];
    const bibliography = file.format.metadata[kBibliography];
    const csl = file.format.metadata[kCsl];
    if (!bibliography) {
      return;
    }

    // find all of the refs in each document and fixup their links to point
    // to the shared bibliography output. note these refs so we can generate
    // a global bibliography. also hide the refs div in each document (as it's
    // still used by citations-hover)
    const citeIds: string[] = [];
    outputFiles.forEach((file) => {
      // relative path to refs html
      const refsRelative = pathWithForwardSlashes(
        relative(dirname(file.file), refsHtml!),
      );
      // check each citation
      forEachCite(file.doc, (cite: Element) => {
        // record ids
        citeIds.push(...citeIdsFromCite(cite));
        // fix hrefs
        const citeLinks = cite.querySelectorAll("a[role='doc-biblioref']");
        for (let l = 0; l < citeLinks.length; l++) {
          const link = citeLinks[l] as Element;
          link.setAttribute("href", refsRelative + link.getAttribute("href"));
        }
      });

      // hide the bibliography
      const refsDiv = file.doc.getElementById("refs");
      if (refsDiv) {
        refsDiv.setAttribute("style", "display: none");
      }
    });

    // is the refs one of our output files?
    const refsOutputFile = outputFiles.find((file) => file.file === refsHtml);
    if (refsOutputFile) {
      // if it's incremental and the references file is the target, then we actually
      // need to additionally collect citeIds from any file not in the list of outputFiles
      if (incremental) {
        // find all the html output files for the book and add their cite ids if they
        // aren't already included in the cite ids passed to us (this would happen e.g.
        // in an incremental render by the dev server)
        const bookHtmlOutputs = await bookMultiFileHtmlOutputs(context);
        bookHtmlOutputs.forEach((htmlOutput) => {
          if (
            outputFiles.findIndex((file) => file.file === htmlOutput) === -1
          ) {
            if (existsSync(htmlOutput)) {
              const doc = new DOMParser().parseFromString(
                Deno.readTextFileSync(htmlOutput),
                "text/html",
              );
              if (doc) {
                forEachCite(doc, (cite: Element) => {
                  citeIds.push(...citeIdsFromCite(cite));
                });
              }
            }
          }
        });
      }

      if (citeIds.length > 0) {
        // either append this to the end of the references file or replace an explicit
        // refs div in the references file

        // genereate bibliography html
        const biblioHtml = await generateBibliographyHTML(
          context,
          bibliography,
          csl,
          citeIds,
        );

        const newRefsDiv = refsOutputFile.doc.createElement("div");
        newRefsDiv.innerHTML = biblioHtml;
        const refsDiv = refsOutputFile.doc.getElementById("refs") as Element;
        if (refsDiv) {
          refsDiv.replaceWith(newRefsDiv.firstChild);
        } else {
          const mainEl = refsOutputFile.doc.querySelector("main");
          if (mainEl) {
            mainEl.appendChild(newRefsDiv.firstChild);
          }
        }
      }
    }
  }
}

async function generateBibliographyHTML(
  context: ProjectContext,
  bibliography: unknown,
  csl: unknown,
  citeIds: string[],
) {
  // make the aggregated bibliography
  const yaml: Metadata = {
    bibliography,
    nocite: ld.uniq(citeIds).map((id) => "@" + id).join(", "),
  };
  if (csl) {
    yaml[kCsl] = csl;
  }
  const frontMatter = `---\n${stringify(yaml, { indent: 2 })}\n---\n`;
  const result = await execProcess({
    cmd: [
      pandocBinaryPath(),
      "--from",
      "markdown",
      "--to",
      "html",
      "--citeproc",
    ],
    cwd: context.dir,
    stdout: "piped",
  }, frontMatter);
  if (result.success) {
    return result.stdout!;
    // read
  } else {
    error(result.stderr);
    throw new Error();
  }
}

function forEachCite(doc: Document, f: (cite: Element) => void) {
  const cites = doc.querySelectorAll(".citation");
  for (let i = 0; i < cites.length; i++) {
    const cite = cites[i] as Element;
    f(cite);
  }
}

function citeIdsFromCite(cite: Element): string[] {
  const citeTarget = cite.getAttribute("data-cites");
  if (citeTarget) {
    return citeTarget.split(" ");
  } else {
    return [];
  }
}
