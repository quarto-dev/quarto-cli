/*
* website-resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "../../../core/deno-dom.ts";
import {
  kHtmlResourceTags,
  processFileResourceRefs,
} from "../../../core/html.ts";

import { fixupCssReferences } from "../../project-resources.ts";
import { ProjectContext } from "../../types.ts";
import { projectOffset } from "../../project-shared.ts";
import { relative } from "path/mod.ts";
import { inputFileHref } from "./website-shared.ts";
import { websitePath } from "./website-config.ts";

export function htmlResourceResolverPostprocessor(
  source: string,
  project: ProjectContext,
) {
  const sourceRelative = relative(project.dir, source);
  const offset = projectOffset(project, source);
  const href = inputFileHref(sourceRelative);

  return (doc: Document) => {
    const forceRoot = href === "/404.html" ? websitePath(project.config) : null;
    // resolve resource refs
    const refs = resolveResourceRefs(doc, offset, forceRoot);
    return Promise.resolve(refs);
  };
}

export function resolveResourceRefs(
  doc: Document,
  offset: string,
  forceRoot: string | null,
) {
  // refs that need to be copied
  const refs: string[] = [];

  // resolve tags with resource refs
  Object.keys(kHtmlResourceTags).forEach((tag) => {
    for (const attrib of kHtmlResourceTags[tag]) {
      refs.push(
        ...resolveTag(doc, offset, tag, attrib, forceRoot)
          .map((ref) => ref.replace(/\/$/, "/index.html")),
      );
    }
  });

  // css references (import/url)
  const styles = doc.querySelectorAll("style");
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i] as Element;
    if (style.innerHTML) {
      style.innerHTML = fixupCssReferences(
        style.innerHTML,
        offset + "/",
        (ref) => refs.push(ref),
      );
    }
  }

  // return refs
  return refs;
}

function resolveTag(
  doc: Document,
  offset: string,
  tag: string,
  attrib: string,
  forceRoot: string | null,
) {
  const refs: string[] = [];
  processFileResourceRefs(doc, tag, attrib, (tag: Element, href: string) => {
    if (forceRoot) {
      if (!href.startsWith("/")) {
        tag.setAttribute(attrib, forceRoot + href);
      } else if (!href.startsWith(forceRoot)) {
        tag.setAttribute(attrib, forceRoot + href.slice(1));
      }
    } else if (href.startsWith("/")) {
      href = offset + href;
      tag.setAttribute(attrib, href);
    }
    refs.push(href!);
  });
  return refs;
}
