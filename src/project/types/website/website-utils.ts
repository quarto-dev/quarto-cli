/*
 * website-utils.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { Document, Element } from "../../../core/deno-dom.ts";
import { getDecodedAttribute } from "../../../core/html.ts";
import { resolveInputTarget } from "../../project-index.ts";
import { pathWithForwardSlashes, safeExistsSync } from "../../../core/path.ts";
import { projectOffset, projectOutputDir } from "../../project-shared.ts";
import { engineValidExtensions } from "../../../execute/engine.ts";
import { ProjectContext } from "../../types.ts";

import { warning } from "log/mod.ts";
import { dirname, extname, join, relative } from "path/mod.ts";
import { websiteConfigArray, websiteConfigString } from "./website-config.ts";
import { kDraftMode, kDrafts } from "./website-constants.ts";

export function removeChapterNumber(item: Element) {
  const numberSpan = item.querySelector(".chapter-number");
  const titleSpan = item.querySelector(".chapter-title");
  if (numberSpan && titleSpan) {
    item.innerHTML = "";
    item.appendChild(titleSpan);
  }
}

export function isProjectDraft(
  input: string,
  project: ProjectContext,
): boolean {
  const drafts = websiteConfigArray(kDrafts, project.config);
  if (drafts) {
    // TODO: Convert to glob
    return drafts.includes(pathWithForwardSlashes(input));
  }
  return false;
}

export function projectDraftMode(project: ProjectContext) {
  const draftMode = websiteConfigString(kDraftMode, project.config);
  return draftMode || "unlinked";
}

export async function resolveProjectInputLinks(
  source: string,
  project: ProjectContext,
  doc: Document,
) {
  const sourceRelative = relative(project.dir, source);
  const offset = projectOffset(project, source);
  const draftMode = projectDraftMode(project);

  // resolve links to input (src) files
  const links = doc.querySelectorAll("a[href]");
  for (let i = 0; i < links.length; i++) {
    const link = links[i] as Element;
    const resolveInput = link.getAttribute("data-noresolveinput") === null;
    if (!resolveInput) {
      link.removeAttribute("data-noresolveinput");
    }
    const linkHref = getDecodedAttribute(link, "href");
    if (linkHref && !isExternalPath(linkHref)) {
      let projRelativeHref = linkHref.startsWith("/")
        ? linkHref.slice(1)
        : join(dirname(sourceRelative), linkHref);
      const hashLoc = projRelativeHref.indexOf("#");
      const hash = hashLoc !== -1 ? projRelativeHref.slice(hashLoc) : "";
      if (hash) {
        projRelativeHref = projRelativeHref.slice(0, hashLoc);
      }

      const resolved = resolveInput
        ? await resolveInputTarget(
          project,
          pathWithForwardSlashes(projRelativeHref),
        )
        : {
          outputHref: pathWithForwardSlashes(join("/", projRelativeHref)),
          draft: false,
        };

      if (resolved) {
        if (resolved.draft && draftMode !== "visible") {
          link.replaceWith(link.innerHTML);
        } else {
          link.setAttribute("href", offset + resolved.outputHref + hash);
        }
      } else {
        // if this is a unresolvable markdown/ipynb link then print a warning
        if (!safeExistsSync(join(project.dir, projRelativeHref))) {
          const targetFile = join(
            projectOutputDir(project),
            projRelativeHref,
          );
          if (
            engineValidExtensions().includes(extname(targetFile)) &&
            !safeExistsSync(join(projectOutputDir(project), projRelativeHref))
          ) {
            warning("Unable to resolve link target: " + projRelativeHref);
          }
        }
      }
    }
  }
}

function isExternalPath(path: string) {
  return /^\w+:/.test(path);
}
