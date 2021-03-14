/*
* website-search.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { join, relative } from "path/mod.ts";

// currently not building the index here so not using fuse
// @deno-types="fuse/dist/fuse.d.ts"
// import Fuse from "fuse/dist/fuse.esm.min.js";

import { DOMParser, Element } from "deno_dom/deno-dom-wasm.ts";

import { ProjectContext, projectOutputDir } from "../../project-context.ts";

interface SearchDoc {
  href: string;
  title: string;
  text: string;
}

export function updateSearchIndex(
  context: ProjectContext,
  outputFiles: string[],
  incremental: boolean,
) {
  // calculate output dir and search.json path
  const outputDir = projectOutputDir(context);
  const searchJsonPath = join(outputDir, "search.json");
  const searchJson = existsSync(searchJsonPath)
    ? Deno.readTextFileSync(searchJsonPath)
    : undefined;

  // start with a set of search docs if this is incremental
  const searchDocs = new Array<SearchDoc>();
  if (incremental && searchJson) {
    searchDocs.push(...(JSON.parse(searchJson) as SearchDoc[]));
  }

  // create search docs
  const updatedSearchDocs: SearchDoc[] = outputFiles.reduce(
    (searchDocs: SearchDoc[], file) => {
      // add or update search doc
      const updateDoc = (doc: SearchDoc) => {
        const idx = searchDocs.findIndex((d) => d.href === doc.href);
        if (idx !== -1) {
          searchDocs[idx] = doc;
        } else {
          searchDocs.push(doc);
        }
      };

      // parse doc
      const href = relative(outputDir, file);
      const contents = Deno.readTextFileSync(file);
      const doc = new DOMParser().parseFromString(contents, "text/html")!;

      // determine title
      const titleEl = doc.querySelector("h1.title");
      const title = titleEl
        ? titleEl.textContent
        : (context.metadata?.project?.title || "");

      // remove pandoc generated header and toc
      const header = doc.getElementById("title-block-header");
      if (header) {
        header.remove();
      }
      const toc = doc.querySelector(`nav[role="doc-toc"]`);
      if (toc) {
        toc.remove();
      }

      // if there are level 2 sections then create sub-docs for them
      const sections = doc.querySelectorAll("section.level2");
      if (sections.length > 0) {
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i] as Element;
          const id = section.id;
          if (id) {
            const h2 = section.querySelector("h2");
            if (h2) {
              const sectionTitle = h2.textContent;
              h2.remove();
              updateDoc({
                href: `${href}#${id}`,
                title: `${title}: ${sectionTitle}`,
                text: section.textContent.trim(),
              });
            }
          }
        }
      } else { // otherwise a single doc
        const main = doc.querySelector("main");
        if (main) {
          updateDoc({
            href,
            title,
            text: main.textContent.trim(),
          });
        }
      }

      return searchDocs;
    },
    searchDocs,
  );

  // write search docs if they have changed
  const updatedSearchJson = JSON.stringify(updatedSearchDocs);
  if (searchJson !== updatedSearchJson) {
    Deno.writeTextFileSync(searchJsonPath, updatedSearchJson);
  }
}
