/*
* website-resources.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
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
import { join, relative } from "../../../deno_ral/path.ts";
import { inputFileHref } from "./website-shared.ts";
import { websitePath } from "./website-config.ts";
import { HtmlPostProcessResult } from "../../../command/render/types.ts";
import { pathWithForwardSlashes } from "../../../core/path.ts";

export function htmlResourceResolverPostprocessor(
  source: string,
  project: ProjectContext,
  pathResolver?: (href: string, projectOffset: string) => string,
) {
  const sourceRelative = relative(project.dir, source);
  const offset = projectOffset(project, source);
  const href = inputFileHref(sourceRelative);

  return (doc: Document): Promise<HtmlPostProcessResult> => {
    const forceRoot = href === "/404.html" ? websitePath(project.config) : null;

    // If provided, use a path resolver, otherwise, just create a pass through path
    // resolver
    const resolver = pathResolver
      ? pathResolver
      : (href: string, projectOffset: string) => {
        return pathWithForwardSlashes(join(projectOffset, href));
      };

    // resolve resource refs
    const refs = resolveResourceRefs(
      doc,
      offset,
      forceRoot,
      pathResolver || resolver,
    );
    return Promise.resolve({ resources: refs, supporting: [] });
  };
}

export function resolveResourceRefs(
  doc: Document,
  projectOffset: string,
  forceRoot: string | null,
  resolvePath: (href: string, offset: string) => string,
) {
  // refs that need to be copied
  const refs: string[] = [];

  // resolve tags with resource refs
  Object.keys(kHtmlResourceTags).forEach((tag) => {
    for (const attrib of kHtmlResourceTags[tag]) {
      refs.push(
        ...resolveTag(doc, projectOffset, tag, attrib, forceRoot, resolvePath)
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
        projectOffset + "/",
        (ref) => {
          ref = resolvePath(ref, projectOffset);
          refs.push(ref);
          return ref;
        },
      );
    }
  }

  // return refs
  return refs;
}

function resolveTag(
  doc: Document,
  projectOffset: string,
  tag: string,
  attrib: string,
  forceRoot: string | null,
  resolvePath: (href: string, projectOffset: string) => string,
) {
  const refs: string[] = [];
  processFileResourceRefs(doc, tag, attrib, (tag: Element, href: string) => {
    if (forceRoot) {
      // forceroot is currently used by the 404.html page to force a site-url
      // prefix onto the path. Consequently, when doing this we will not
      // resolve any paths, since we know some url is being formed without the
      // expectation of resource resolution
      if (!href.startsWith("/")) {
        tag.setAttribute(attrib, forceRoot + href);
      } else if (!href.startsWith(forceRoot)) {
        tag.setAttribute(attrib, forceRoot + href.slice(1));
      }
    } else if (href.startsWith("/") && !href.startsWith("//")) {
      // This is a project path, offset it
      href = resolvePath(projectOffset + href, projectOffset);
      tag.setAttribute(attrib, href);
    } else {
      // This is not a project path, just pass it through
      href = resolvePath(href, projectOffset);
      tag.setAttribute(attrib, href);
    }
    refs.push(href!);
  });
  return refs;
}
