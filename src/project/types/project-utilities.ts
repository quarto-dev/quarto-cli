/*
 * project-utilities.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { getDecodedAttribute } from "../../core/html.ts";
import { dirname, extname, join, relative } from "path/mod.ts";
import { resolveInputTarget } from "../project-index.ts";
import { pathWithForwardSlashes, safeExistsSync } from "../../core/path.ts";
import { projectOffset, projectOutputDir } from "../project-shared.ts";
import { engineValidExtensions } from "../../execute/engine.ts";
import { warning } from "log/mod.ts";
import { ProjectContext } from "../types.ts";

export async function resolveProjectInputLinks(
  source: string,
  project: ProjectContext,
  doc: Document,
) {
  const sourceRelative = relative(project.dir, source);
  const offset = projectOffset(project, source);

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
        ? await resolveInputTarget(project, projRelativeHref)
        : { outputHref: pathWithForwardSlashes(join("/", projRelativeHref)) };

      if (resolved) {
        link.setAttribute("href", offset + resolved.outputHref + hash);
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
