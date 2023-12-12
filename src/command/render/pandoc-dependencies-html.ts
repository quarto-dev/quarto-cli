/*
 * pandoc-dependencies-html.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, dirname, join } from "path/mod.ts";

import * as ld from "../../core/lodash.ts";

import { Document, Element, NodeType } from "../../core/deno-dom.ts";

import { pathWithForwardSlashes, safeExistsSync } from "../../core/path.ts";

import {
  DependencyFile,
  DependencyServiceWorker,
  FormatDependency,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
import { kIncludeAfterBody, kIncludeInHeader } from "../../config/constants.ts";
import { TempContext } from "../../core/temp.ts";
import { lines } from "../../core/lib/text.ts";
import { copyFileIfNewer } from "../../core/copy.ts";
import {
  appendDependencies,
  HtmlAttachmentDependency,
  HtmlFormatDependency,
} from "./pandoc-dependencies.ts";
import { fixupCssReferences, isCssFile } from "../../core/css.ts";

import { ensureDirSync } from "fs/mod.ts";
import { ProjectContext } from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { insecureHash } from "../../core/hash.ts";

export async function writeDependencies(
  dependenciesFile: string,
  extras: FormatExtras,
) {
  if (extras.html?.[kDependencies]) {
    const dependencies: HtmlFormatDependency[] = extras.html[kDependencies]!
      .map((dep) => {
        return {
          type: "html",
          content: dep,
        };
      });

    await appendDependencies(dependenciesFile, dependencies);
  }
}

export function readAndInjectDependencies(
  dependenciesFile: string,
  inputDir: string,
  libDir: string,
  doc: Document,
  project?: ProjectContext,
) {
  const dependencyJsonStream = Deno.readTextFileSync(dependenciesFile);
  const htmlDependencies: FormatDependency[] = [];
  const htmlAttachments: HtmlAttachmentDependency[] = [];
  lines(dependencyJsonStream).forEach((json) => {
    if (json) {
      const dependency = JSON.parse(json);
      if (dependency.type === "html") {
        htmlDependencies.push(dependency.content);
      } else if (dependency.type === "html-attachment") {
        htmlAttachments.push(dependency);
      }
    }
  });

  const injectedDependencies = [];
  if (htmlDependencies.length > 0) {
    const injector = domDependencyInjector(doc);
    const injected = processHtmlDependencies(
      htmlDependencies,
      inputDir,
      libDir,
      injector,
      project,
    );
    injectedDependencies.push(...injected);
    // Finalize the injection
    injector.finalizeInjection();
  }

  if (htmlAttachments.length > 0) {
    for (const attachment of htmlAttachments) {
      // Find the 'parent' dependencies for this attachment
      const parentDependency = injectedDependencies.find((dep) => {
        return dep.name === attachment.content.name;
      });

      if (parentDependency) {
        // Compute the target directory
        const directoryInfo = targetDirectoryInfo(
          inputDir,
          libDir,
          parentDependency,
        );

        // copy the file
        copyDependencyFile(
          attachment.content.file,
          directoryInfo.absolute,
          !!parentDependency.external,
        );
      }
    }
  }

  // See if there are any script elements that must be relocated
  // If so, they will be relocated to the top of the list of scripts that
  // are present in the document
  const relocateScripts = doc.querySelectorAll("script[data-relocate-top]");
  if (relocateScripts.length > 0) {
    // find the idea insertion point
    const nextSiblingEl = doc.querySelector("head script:first-of-type");
    if (nextSiblingEl) {
      for (const relocateScript of relocateScripts) {
        (relocateScript as Element).removeAttribute("data-relocate-top");
        nextSiblingEl.parentElement?.insertBefore(
          relocateScript,
          nextSiblingEl,
        );
      }
    }
  }

  return Promise.resolve({
    resources: [],
    supporting: [],
  });
}

export function resolveDependencies(
  extras: FormatExtras,
  inputDir: string,
  libDir: string,
  temp: TempContext,
  project?: ProjectContext,
) {
  // deep copy to not mutate caller's object
  extras = ld.cloneDeep(extras);

  const lines: string[] = [];
  const afterBodyLines: string[] = [];

  if (extras.html?.[kDependencies]) {
    const injector = lineDependencyInjector(lines, afterBodyLines);
    processHtmlDependencies(
      extras.html[kDependencies]!,
      inputDir,
      libDir,
      injector,
      project,
    );
    // Finalize the injection
    injector.finalizeInjection();

    delete extras.html?.[kDependencies];

    // write to external file
    const dependenciesHead = temp.createFile({
      prefix: "dependencies",
      suffix: ".html",
    });
    Deno.writeTextFileSync(dependenciesHead, lines.join("\n"));
    extras[kIncludeInHeader] = [dependenciesHead].concat(
      extras[kIncludeInHeader] || [],
    );

    // after body
    if (afterBodyLines.length > 0) {
      const dependenciesAfter = temp.createFile({
        prefix: "dependencies-after",
        suffix: ".html",
      });
      Deno.writeTextFileSync(dependenciesAfter, afterBodyLines.join("\n"));
      extras[kIncludeAfterBody] = [dependenciesAfter].concat(
        extras[kIncludeAfterBody] || [],
      );
    }
  }

  return extras;
}

interface HtmlInjector {
  injectScript(
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ): void;

  injectStyle(
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ): void;

  injectLink(
    href: string,
    rel: string,
    type?: string,
  ): void;

  injectHtml(html: string): void;

  injectMeta(meta: Record<string, string>): void;

  finalizeInjection(): void;
}

function processHtmlDependencies(
  dependencies: FormatDependency[],
  inputDir: string,
  libDir: string,
  injector: HtmlInjector,
  project?: ProjectContext,
) {
  const copiedDependencies: FormatDependency[] = [];
  for (const dependency of dependencies) {
    // Ensure that we copy (and render HTML for) each named dependency only once
    if (
      copiedDependencies.find((copiedDep) => {
        return copiedDep.name === dependency.name;
      })
    ) {
      continue;
    }

    // provide a format libs (i.e. freezer protected) scope for injected deps
    const directoryInfo = targetDirectoryInfo(
      inputDir,
      libDir,
      dependency,
    );

    const copyFile = (
      file: DependencyFile,
      attribs?: Record<string, string>,
      afterBody?: boolean,
      inject?: (
        href: string,
        attribs?: Record<string, string>,
        afterBody?: boolean,
      ) => void,
    ) => {
      copyDependencyFile(
        file,
        directoryInfo.absolute,
        dependency.external || false,
      );
      if (inject) {
        const href = join(directoryInfo.relative, file.name);
        inject(href, attribs, afterBody);
      }
    };

    // Process scripts
    if (dependency.scripts) {
      dependency.scripts.forEach((script) =>
        copyFile(
          script,
          script.attribs,
          script.afterBody,
          injector.injectScript,
        )
      );
    }

    // Process CSS
    if (dependency.stylesheets) {
      dependency.stylesheets.forEach((stylesheet) => {
        copyFile(
          stylesheet,
          stylesheet.attribs,
          stylesheet.afterBody,
          injector.injectStyle,
        );
      });
    }

    // Process Service Workers
    if (dependency.serviceworkers) {
      dependency.serviceworkers.forEach((serviceWorker) => {
        const resolveDestination = (
          worker: DependencyServiceWorker,
          inputDir: string,
          project?: ProjectContext,
        ) => {
          // First make sure there is a destination. If omitted, provide
          // a default based upon the context
          if (!worker.destination) {
            if (project) {
              worker.destination = `/${basename(worker.source)}`;
            } else {
              worker.destination = `${basename(worker.source)}`;
            }
          }

          // Now return either a project path or an input
          // relative path
          if (worker.destination.startsWith("/")) {
            if (project) {
              // This is a project relative path
              const projectDir = projectOutputDir(project);
              return join(projectDir, worker.destination.slice(1));
            } else {
              throw new Error(
                "A service worker is being provided with a project relative destination path but no valid Quarto project was found.",
              );
            }
          } else {
            // this is an input relative path
            return join(inputDir, worker.destination);
          }
        };

        // Compute the path to the destination
        const destinationFile = resolveDestination(
          serviceWorker,
          inputDir,
          project,
        );
        const destinationDir = dirname(destinationFile);

        // Ensure the directory exists and copy the source file
        // to the destination
        ensureDirSync(destinationDir);
        copyFileIfNewer(
          serviceWorker.source,
          destinationFile,
        );
      });
    }

    // Process head HTML
    if (dependency.head) {
      injector.injectHtml(dependency.head);
    }

    // Link tags
    if (dependency.links) {
      dependency.links.forEach((link) => {
        injector.injectLink(link.href, link.rel, link.type);
      });
    }

    // Process meta tags
    if (dependency.meta) {
      injector.injectMeta(dependency.meta);
    }

    // Process Resources
    if (dependency.resources) {
      dependency.resources.forEach((resource) => copyFile(resource));
    }

    copiedDependencies.push(dependency);
  }
  return copiedDependencies;
}

function copyDependencyFile(
  file: DependencyFile,
  targetDir: string,
  external: boolean,
) {
  const targetPath = join(targetDir, file.name);
  // If this is a user resource, treat it as a resource (resource ref discovery)
  // if this something that we're injecting, just copy it
  ensureDirSync(dirname(targetPath));
  copyFileIfNewer(file.path, targetPath);

  if (external && isCssFile(file.path)) {
    processCssFile(dirname(file.path), targetPath);
  }
}

function targetDirectoryInfo(
  inputDir: string,
  libDir: string,
  dependency: FormatDependency,
) {
  // provide a format libs (i.e. freezer protected) scope for injected deps
  const targetLibDir = dependency.external
    ? join(libDir, "quarto-contrib")
    : libDir;

  // Directory information for the dependency
  const dir = dependency.version
    ? `${dependency.name}-${dependency.version}`
    : dependency.name;

  const relativeTargetDir = join(targetLibDir, dir);
  const absoluteTargetDir = join(inputDir, relativeTargetDir);
  return {
    absolute: absoluteTargetDir,
    relative: relativeTargetDir,
  };
}

// fixup root ('/') css references and also copy references to other
// stylesheet or resources (e.g. images) to alongside the destFile
function processCssFile(
  srcDir: string,
  file: string,
) {
  // read the css
  const css = Deno.readTextFileSync(file);
  const destCss = fixupCssReferences(css, (ref: string) => {
    // If the reference points to a real file that exists, go ahead and
    // process it
    const refPath = join(srcDir, ref);
    if (safeExistsSync(refPath)) {
      // Just use the current ref path, unless the path includes '..'
      // which would allow the path to 'escape' this dependency's directory.
      // In that case, generate a unique hash of the path and use that
      // as the target folder for the resources
      const refDir = dirname(ref);
      const targetRef = refDir && refDir !== "." && refDir.includes("..")
        ? join(insecureHash(dirname(ref)), basename(ref))
        : ref;

      // Copy the file and provide the updated href target
      const refDestPath = join(dirname(file), targetRef);
      copyFileIfNewer(refPath, refDestPath);
      return pathWithForwardSlashes(targetRef);
    } else {
      // Since this doesn't appear to point to a real file, just
      // leave it alone
      return ref;
    }
  });

  // write the css if necessary
  if (destCss !== css) {
    Deno.writeTextFileSync(file, destCss);
  }
}

const kDependencyTarget = "htmldependencies:E3FAD763";

function domDependencyInjector(
  doc: Document,
): HtmlInjector {
  // Locates the placeholder target for inserting content
  const findTargetComment = () => {
    for (const node of doc.head.childNodes) {
      if (node.nodeType === NodeType.COMMENT_NODE) {
        if (
          node.textContent &&
          node.textContent.trim() === kDependencyTarget
        ) {
          return node;
        }
      }
    }

    // We couldn't find a placeholder comment, just insert
    // the nodes at the front of the head
    return doc.head.firstChild;
  };
  const targetComment = findTargetComment();

  const injectEl = (
    el: Element,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    if (attribs) {
      for (const key of Object.keys(attribs)) {
        el.setAttribute(key, attribs[key]);
      }
    }
    if (!afterBody) {
      doc.head.insertBefore(doc.createTextNode("\n"), targetComment);
      doc.head.insertBefore(el, targetComment);
    } else {
      doc.body.appendChild(el);
      doc.body.appendChild(doc.createTextNode("\n"));
    }
  };

  const injectScript = (
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    const scriptEl = doc.createElement("script");
    scriptEl.setAttribute("src", pathWithForwardSlashes(href));
    injectEl(scriptEl, attribs, afterBody);
  };

  const injectStyle = (
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    const linkEl = doc.createElement("link");
    linkEl.setAttribute("href", pathWithForwardSlashes(href));
    linkEl.setAttribute("rel", "stylesheet");
    injectEl(linkEl, attribs, afterBody);
  };

  const injectLink = (
    href: string,
    rel: string,
    type?: string,
  ) => {
    const linkEl = doc.createElement("link");
    linkEl.setAttribute("href", pathWithForwardSlashes(href));
    linkEl.setAttribute("rel", rel);
    if (type) {
      linkEl.setAttribute("type", type);
    }
    injectEl(linkEl);
  };

  const injectHtml = (html: string) => {
    const container = doc.createElement("div");
    container.innerHTML = html;
    for (const childEl of container.children) {
      injectEl(childEl);
    }
  };

  const injectMeta = (meta: Record<string, string>) => {
    Object.keys(meta).forEach((key) => {
      const metaEl = doc.createElement("meta");
      metaEl.setAttribute("name", key);
      metaEl.setAttribute("content", meta[key]);
      injectEl(metaEl);
    });
  };

  const finalizeInjection = () => {
    // Remove the target comment
    if (targetComment) {
      targetComment._remove();
    }
  };

  return {
    injectScript,
    injectStyle,
    injectLink,
    injectMeta,
    injectHtml,
    finalizeInjection,
  };
}

function lineDependencyInjector(
  lines: string[],
  afterBodyLines: string[],
): HtmlInjector {
  const metaTemplate = ld.template(
    `<meta name="<%- name %>" content="<%- value %>"/>`,
  );

  const scriptTemplate = ld.template(
    `<script <%= attribs %> src="<%- href %>"></script>`,
  );

  const stylesheetTempate = ld.template(
    `<link <%= attribs %> href="<%- href %>" rel="stylesheet" />`,
  );
  const rawLinkTemplate = ld.template(
    `<link href="<%- href %>" rel="<%- rel %>"<% if (type) { %> type="<%- type %>"<% } %> />`,
  );

  const inject = (content: string, afterBody?: boolean) => {
    if (afterBody) {
      afterBodyLines.push(content);
    } else {
      lines.push(content);
    }
  };

  const formatAttribs = (attribs?: Record<string, string>) => {
    return attribs
      ? Object.entries(attribs).map((entry) => {
        const attrib = `${entry[0]}="${entry[1]}"`;
        return attrib;
      }).join(" ")
      : "";
  };

  const injectScript = (
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    inject(
      scriptTemplate(
        { href: pathWithForwardSlashes(href), attribs: formatAttribs(attribs) },
        afterBody,
      ),
    );
  };

  const injectStyle = (
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    inject(
      stylesheetTempate(
        { href: pathWithForwardSlashes(href), attribs: formatAttribs(attribs) },
        afterBody,
      ),
    );
  };

  const injectLink = (
    href: string,
    rel: string,
    type?: string,
  ) => {
    if (!type) {
      type = "";
    }
    lines.push(
      rawLinkTemplate({ href: pathWithForwardSlashes(href), type, rel }),
    );
  };

  const injectHtml = (html: string) => {
    lines.push(html + "\n");
  };

  const injectMeta = (meta: Record<string, string>) => {
    Object.keys(meta).forEach((name) => {
      lines.push(metaTemplate({ name, value: meta[name] }));
    });
  };

  const finalizeInjection = () => {
  };

  return {
    injectScript,
    injectStyle,
    injectLink,
    injectMeta,
    injectHtml,
    finalizeInjection,
  };
}
