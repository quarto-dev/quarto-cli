/*
 * book-bibliography.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as ld from "../../../core/lodash.ts";
import { stringify } from "encoding/yaml.ts";
import { error } from "log/mod.ts";

import {
  Document,
  Element,
  initDenoDom,
  parseHtml,
  writeDomToHtmlFile,
} from "../../../core/deno-dom.ts";

import { pathWithForwardSlashes, safeExistsSync } from "../../../core/path.ts";
import { execProcess } from "../../../core/process.ts";
import { pandocBinaryPath } from "../../../core/resources.ts";

import { kBibliography, kCsl, kNoCite } from "../../../config/constants.ts";
import { Metadata } from "../../../config/types.ts";

import { kProjectRender, kProjectType, ProjectContext } from "../../types.ts";
import {
  projectFormatOutputDir,
  projectOutputDir,
} from "../../project-shared.ts";
import {
  inputFileForOutputFile,
  inputTargetIndex,
  resolveInputTarget,
} from "../../project-index.ts";
import { WebsiteProjectOutputFile } from "../website/website.ts";
import { bookMultiFileHtmlOutputs } from "./book-extension.ts";
import { ProjectOutputFile } from "../types.ts";
import { projectType } from "../project-types.ts";

export async function bookBibliography(
  outputFiles: ProjectOutputFile[],
  context: ProjectContext,
) {
  // determine the bibliography, csl, and nocite based on the first file
  const file = outputFiles[0];
  const bibliography = file.format.metadata[kBibliography] as string[];
  const nocite = typeof (file.format.metadata[kNoCite]) === "string"
    ? file.format.metadata[kNoCite] as string
    : undefined;
  const projType = projectType(context.config?.project?.[kProjectType]);

  if (!bibliography) {
    return {
      bibliographyPaths: [],
    };
  }

  // We need to be sure we're properly resolving the bibliography
  // path from the metadata using the path of the file that provided the
  // metadata (the same goes for the CSL file, if present)
  // The relative path to the output file
  const fileRelativePath = relative(
    projectFormatOutputDir(file.format, context, projType),
    file.file,
  );
  // The path to the input file
  const inputfile = await inputFileForOutputFile(context, fileRelativePath);
  const bibliographyPaths: string[] = [];
  let csl = file.format.metadata[kCsl] as string;
  if (inputfile) {
    // Use the dirname from the input file to resolve the bibliography paths
    const firstFileDir = dirname(inputfile);
    bibliographyPaths.push(
      ...bibliography.map((file) =>
        isAbsolute(file) ? file : join(firstFileDir, file)
      ),
    );

    // Fixes https://github.com/quarto-dev/quarto-cli/issues/2755
    if (csl) {
      const absPath = isAbsolute(csl) ? csl : join(firstFileDir, csl);
      const safeAbsPath = pathWithForwardSlashes(absPath);
      if (safeExistsSync(safeAbsPath)) {
        csl = safeAbsPath;
      }
    }

    return {
      csl,
      bibliographyPaths,
      nocite: nocite
        ? nocite.split(",").map((x) => x.trim().replace(/^@/, ""))
        : [],
    };
  } else {
    throw new Error(
      `Unable to determine proper path to use when computing bibliography path for ${fileRelativePath}.`,
    );
  }
}

export async function bookBibliographyPostRender(
  context: ProjectContext,
  incremental: boolean,
  outputFiles: WebsiteProjectOutputFile[],
) {
  await initDenoDom();

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
    const { bibliographyPaths, csl, nocite } = await bookBibliography(
      outputFiles,
      context,
    );

    // find all of the refs in each document and fixup their links to point
    // to the shared bibliography output. note these refs so we can generate
    // a global bibliography. also hide the refs div in each document (as it's
    // still used by citations-hover)
    const citeIds: string[] = [];
    for (const file of outputFiles) {
      let changed = false;

      // relative path to refs html
      const refsRelative = pathWithForwardSlashes(
        relative(dirname(file.file), refsHtml!),
      );
      // check each citation
      const doc = await parseHtml(Deno.readTextFileSync(file.file));
      forEachCite(doc, (cite: Element) => {
        // record ids
        citeIds.push(...citeIdsFromCite(cite));
        // fix hrefs
        const citeLinks = cite.querySelectorAll("a[role='doc-biblioref']");
        for (let l = 0; l < citeLinks.length; l++) {
          const link = citeLinks[l] as Element;
          link.setAttribute("href", refsRelative + link.getAttribute("href"));
          changed = true;
        }
      });

      // hide the bibliography
      const refsDiv = doc.getElementById("refs");
      if (refsDiv) {
        refsDiv.setAttribute("style", "display: none");
        changed = true;
      }

      if (changed) {
        await writeDomToHtmlFile(
          doc,
          file.file,
          file.doctype,
        );
      }
    }

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
        for (const htmlOutput of bookHtmlOutputs) {
          if (
            outputFiles.findIndex((file) => file.file === htmlOutput) === -1
          ) {
            if (existsSync(htmlOutput)) {
              const doc = await parseHtml(Deno.readTextFileSync(htmlOutput));
              if (doc) {
                forEachCite(doc, (cite: Element) => {
                  citeIds.push(...citeIdsFromCite(cite));
                });
              }
            }
          }
        }
      }

      // include citeids from nocite
      if (nocite) {
        citeIds.push(
          ...nocite,
        );
      }

      if (citeIds.length > 0) {
        // either append this to the end of the references file or replace an explicit
        // refs div in the references file

        // genereate bibliography html
        const biblioHtml = await generateBibliography(
          context,
          bibliographyPaths,
          citeIds,
          "html",
          csl,
        );
        const doc = await parseHtml(Deno.readTextFileSync(refsOutputFile.file));
        const newRefsDiv = doc.createElement("div");
        newRefsDiv.innerHTML = biblioHtml;
        const refsDiv = doc.getElementById("refs") as Element;
        let changed = false;
        if (refsDiv) {
          changed = true;
          refsDiv.replaceWith(newRefsDiv.firstChild);
        } else {
          const mainEl = doc.querySelector("main");
          if (mainEl) {
            changed = true;
            mainEl.appendChild(newRefsDiv.firstChild);
          }
        }
        if (changed) {
          await writeDomToHtmlFile(
            doc,
            refsOutputFile.file,
            refsOutputFile.doctype,
          );
        }
      }
    }
  }
}

export async function generateBibliography(
  context: ProjectContext,
  bibliography: string[],
  citeIds: string[],
  to: string,
  csl?: string,
) {
  const biblioPaths = bibliography.map((biblio) => {
    if (isAbsolute(biblio)) {
      return relative(context.dir, biblio);
    } else {
      return biblio;
    }
  });

  // make the aggregated bibliography
  const yaml: Metadata = {
    [kBibliography]: biblioPaths.map(pathWithForwardSlashes),
    [kNoCite]: ld.uniq(citeIds).map((id) => "@" + id).join(", "),
  };
  if (csl) {
    yaml[kCsl] = isAbsolute(csl)
      ? pathWithForwardSlashes(relative(context.dir, csl))
      : csl;
  }
  const frontMatter = `---\n${stringify(yaml, { indent: 2 })}\n---\n`;
  const result = await execProcess({
    cmd: [
      pandocBinaryPath(),
      "--from",
      "markdown",
      "--to",
      to,
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
