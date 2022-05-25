/*
* pandoc-html-dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import * as ld from "../../core/lodash.ts";

import { Document, Element } from "../../core/deno-dom.ts";

import { pathWithForwardSlashes } from "../../core/path.ts";

import {
  DependencyFile,
  FormatDependency,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
import { kIncludeAfterBody, kIncludeInHeader } from "../../config/constants.ts";
import { TempContext } from "../../core/temp.ts";
import { copyFileIfNewer } from "../../core/copy.ts";
import { lines } from "../../core/lib/text.ts";

export function writeDependencies(
  htmlDependenciesFile: string,
  extras: FormatExtras,
) {
  if (extras.html?.[kDependencies]) {
    const dependencyLines: string[] = [];
    for (const dependency of extras.html?.[kDependencies]!) {
      dependencyLines.push(
        JSON.stringify({ type: "html", content: dependency }),
      );
    }

    if (dependencyLines.length > 0) {
      Deno.writeTextFileSync(
        htmlDependenciesFile,
        `${dependencyLines.join("\n")}\n`,
      );
    }
  }
}

export function readAndInjectDependencies(
  htmlDependenciesFile: string,
  inputDir: string,
  libDir: string,
  doc: Document,
) {
  const dependencyJsonStream = Deno.readTextFileSync(htmlDependenciesFile);
  const htmlDependencies: FormatDependency[] = [];
  lines(dependencyJsonStream).forEach((json) => {
    if (json) {
      const dependency = JSON.parse(json);
      if (dependency.type === "html") {
        htmlDependencies.push(dependency.content);
      }
    }
  });

  if (htmlDependencies.length > 0) {
    const injector = domDependencyInjector(doc);
    processHtmlDependencies(htmlDependencies, inputDir, libDir, injector);
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
    );

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
}

function processHtmlDependencies(
  dependencies: FormatDependency[],
  inputDir: string,
  libDir: string,
  injector: HtmlInjector,
) {
  const copiedDependencies: string[] = [];
  for (const dependency of dependencies) {
    // Ensure that we copy (and render HTML for) each named dependency only once
    if (copiedDependencies.includes(dependency.name)) {
      continue;
    }

    // Directory information for the dependency
    const dir = dependency.version
      ? `${dependency.name}-${dependency.version}`
      : dependency.name;
    const targetDir = join(inputDir, libDir, dir);

    const copyFile = (
      file: DependencyFile,
      inject?: (
        href: string,
        attribs?: Record<string, string>,
        afterBody?: boolean,
      ) => void,
    ) => {
      const targetPath = join(targetDir, file.name);
      copyFileIfNewer(file.path, targetPath);
      const href = join(libDir, dir, file.name);
      if (inject) {
        inject(href, file.attribs, file.afterBody);
      }
    };

    // Process scripts
    if (dependency.scripts) {
      dependency.scripts.forEach((script) =>
        copyFile(
          script,
          injector.injectScript,
        )
      );
    }

    // Process CSS
    if (dependency.stylesheets) {
      dependency.stylesheets.forEach((stylesheet) => {
        copyFile(
          stylesheet,
          injector.injectStyle,
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
  }
}

function domDependencyInjector(
  doc: Document,
): HtmlInjector {
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
      doc.head.appendChild(el);
    } else {
      doc.body.appendChild(el);
    }
  };

  const injectScript = (
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    const scriptEl = doc.createElement("script");
    scriptEl.setAttribute("src", href);
    injectEl(scriptEl, attribs, afterBody);
  };

  const injectStyle = (
    href: string,
    attribs?: Record<string, string>,
    afterBody?: boolean,
  ) => {
    const linkEl = doc.createElement("link");
    linkEl.setAttribute("href", href);
    linkEl.setAttribute("rel", "stylesheet");
    injectEl(linkEl, attribs, afterBody);
  };

  const injectLink = (
    href: string,
    rel: string,
    type?: string,
  ) => {
    const linkEl = doc.createElement("link");
    linkEl.setAttribute("href", href);
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

  return {
    injectScript,
    injectStyle,
    injectLink,
    injectMeta,
    injectHtml,
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
    lines.push(rawLinkTemplate({ href, type, rel }));
  };

  const injectHtml = (html: string) => {
    lines.push(html + "\n");
  };

  const injectMeta = (meta: Record<string, string>) => {
    Object.keys(meta).forEach((name) => {
      lines.push(metaTemplate({ name, value: meta[name] }));
    });
  };

  return {
    injectScript,
    injectStyle,
    injectLink,
    injectMeta,
    injectHtml,
  };
}
