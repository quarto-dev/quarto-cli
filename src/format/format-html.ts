/*
* format-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { renderEjs } from "../core/ejs.ts";
import { mergeConfigs } from "../core/config.ts";
import { formatResourcePath } from "../core/resources.ts";
import { sessionTempFile } from "../core/temp.ts";

import {
  kFilters,
  kHeaderIncludes,
  kHtmlMathMethod,
  kSectionDivs,
  kTableOfContents,
  kToc,
  kTocTitle,
  kVariables,
} from "../config/constants.ts";
import {
  DependencyFile,
  Format,
  FormatExtras,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  SassBundle,
} from "../config/format.ts";
import { PandocFlags } from "../config/flags.ts";
import { Metadata } from "../config/metadata.ts";
import { baseHtmlFormat } from "./formats.ts";

export const kTheme = "theme";
export const kTocFloat = "toc-float";
export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kPageLayout = "page-layout";

export const kDocumentCss = "document-css";
export const kBootstrapDependencyName = "bootstrap";
const kDefaultTheme = "default";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    baseHtmlFormat(figwidth, figheight),
    {
      metadata: {
        [kTheme]: kDefaultTheme,
      },
      pandoc: {
        [kHtmlMathMethod]: "mathjax",
      },
    },
    {
      formatExtras: (flags: PandocFlags, format: Format) => {
        return mergeConfigs(
          themeFormatExtras(flags, format),
          htmlFormatExtras(format),
        );
      },
    },
  );
}

function themeFormatExtras(flags: PandocFlags, format: Format) {
  if (format.metadata[kTheme]) {
    const themeRaw = format.metadata[kTheme];
    if (typeof (themeRaw) === "string" && themeRaw === "pandoc") {
      // 'pandoc' theme means include default pandoc document css
      return Promise.resolve(pandocExtras(format.metadata));
    } else {
      // other themes are bootswatch themes or bootstrap css files
      return boostrapExtras(flags, format);
    }

    // theme: null means no default document css at all
  } else {
    return Promise.resolve({
      pandoc: {
        [kVariables]: {
          [kDocumentCss]: false,
        },
      },
    });
  }
}

function htmlFormatExtras(format: Format): FormatExtras {
  // lists of scripts and ejs data for the orchestration script
  const scripts: DependencyFile[] = [];
  const ejsData: Record<string, unknown> = {};

  // anchors if requested
  if (format.metadata[kAnchorSections] !== false) {
    scripts.push({
      name: "anchor.min.js",
      path: formatResourcePath("html", join("anchor", "anchor.min.js")),
    });
    const anchors = format.metadata[kAnchorSections];
    ejsData.anchors = typeof (anchors) === "string" ? anchors : true;
  } else {
    ejsData.anchors = false;
  }

  // add main orchestion script
  const quartoHtmlScript = sessionTempFile({ suffix: ".html" });
  Deno.writeTextFileSync(
    quartoHtmlScript,
    renderEjs(
      formatResourcePath("html", join("templates", "quarto-html.ejs.js")),
      ejsData,
    ),
  );

  scripts.push({
    name: "quarto-html.js",
    path: quartoHtmlScript,
  });

  // return extras
  return {
    [kDependencies]: [{
      name: "quarto-html",
      scripts,
    }],
  };
}

export function formatHasBootstrap(format: Format) {
  const theme = format.metadata["theme"];
  return theme && theme !== "pandoc";
}

export function hasTableOfContents(flags: PandocFlags, format: Format) {
  return !!((flags[kToc] || format.pandoc[kToc] ||
    format.pandoc[kTableOfContents]) && (format.metadata[kTocFloat] !== false));
}

export function hasTableOfContentsTitle(flags: PandocFlags, format: Format) {
  return flags[kTocTitle] !== undefined ||
    format.metadata[kTocTitle] !== undefined;
}

export function bootstrapFormatDependency(format: Format) {
  const boostrapResource = (resource: string) =>
    formatResourcePath(
      "html",
      `bootstrap/themes/default/${resource}`,
    );
  const bootstrapDependency = (resource: string) => ({
    name: resource,
    path: boostrapResource(resource),
  });

  return {
    name: kBootstrapDependencyName,
    version: "v5.0.0-beta2",
    stylesheets: [
      bootstrapDependency("bootstrap-icons.css"),
    ],
    scripts: [
      bootstrapDependency("bootstrap.bundle.min.js"),
    ],
    resources: [
      bootstrapDependency("bootstrap-icons.woff"),
    ],
  };
}

const kThemeScopeRegex =
  /^\/\/[ \t]*theme:(variables|rules|declarations)[ \t]*$/;

function resolveThemeScss(
  themes: string[],
  quartoThemesDir: string,
): Array<{ variables?: string; rules?: string; declarations?: string }> {
  const themeScss: Array<
    { variables?: string; rules?: string; declarations?: string }
  > = [];

  themes.forEach((theme) => {
    const resolvedThemeDir = join(quartoThemesDir, theme);
    const read = (
      path: string,
    ) => {
      if (existsSync(path)) {
        return Deno.readTextFileSync(path);
      } else {
        return undefined;
      }
    };

    if (theme === kDefaultTheme) {
      // The default theme doesn't require any additional boostrap variables or styles
      return [];
    } else if (existsSync(resolvedThemeDir)) {
      // It's a built in theme, just read and return the data
      themeScss.push({
        variables: read(join(resolvedThemeDir, "_variables.scss")),
        rules: read(join(resolvedThemeDir, "_bootswatch.scss")),
      });
    } else if (existsSync(theme)) {
      if (Deno.statSync(theme).isFile) {
        // It is not a built in theme, so read the theme file and parse it.
        const rawContents = Deno.readTextFileSync(theme);
        const lines = rawContents.split("\n");

        const vars: string[] = [];
        const rules: string[] = [];
        const declarations: string[] = [];
        let accum = vars;
        lines.forEach((line) => {
          const scopeMatch = line.match(kThemeScopeRegex);
          if (scopeMatch) {
            const scope = scopeMatch[1];
            switch (scope) {
              case "variables":
                accum = vars;
                break;
              case "rules":
                accum = rules;
                break;
              case "declarations":
                accum = declarations;
                break;
            }
          } else {
            accum.push(line);
          }
        });

        themeScss.push({
          variables: vars.join("\n"),
          rules: rules.join("\n"),
          declarations: declarations.join("\n"),
        });
      } else {
        // It's a directory, look for names files instead
        themeScss.push({
          variables: read(join(theme, "_variables.scss")),
          rules: read(join(theme, "_rules.scss")),
          declarations: read(join(theme, "_declarations.scss")),
        });
      }
    }
  });
  return themeScss;
}

export interface ScssVariable {
  name: string;
  value: string;
}

function mapPandocVariables(metadata: Metadata) {
  const explicitVars: ScssVariable[] = [];

  const addVariable = (cssVar?: ScssVariable) => {
    if (cssVar) {
      explicitVars.push(cssVar);
    }
  };

  // Map some variables to bootstrap vars
  addVariable(scssVarFromMetadata(
    metadata,
    "linestretch",
    "line-height-base",
    (val) => {
      return asCssNumber(val);
    },
  ));
  addVariable(scssVarFromMetadata(metadata, "font-size", "font-size-root"));
  addVariable(scssVarFromMetadata(
    metadata,
    "backgroundcolor",
    "body-bgr",
  ));
  addVariable(scssVarFromMetadata(metadata, "fontcolor", "body-color"));
  addVariable(scssVarFromMetadata(metadata, "linkcolor", "link-color"));
  addVariable(
    scssVarFromMetadata(metadata, "mainfont", "font-family-base", asCssFont),
  );
  addVariable(
    scssVarFromMetadata(metadata, "monofont", "font-family-code", asCssFont),
  );

  // Special case for Body width and margins
  const explicitSizes = [
    "max-width",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
  ];
  explicitSizes.forEach((attrib) => {
    if (metadata[attrib]) {
      const size = asCssSize(metadata[attrib]);
      if (size) {
        explicitVars.push({ name: attrib, value: size });
      }
    }
  });

  // Special case for mono background
  const monoBackground = scssVarFromMetadata(
    metadata,
    "monobackgroundcolor",
    "mono-background-color",
  );
  if (monoBackground) {
    // if we have a monobackground color then add padding
    explicitVars.push(monoBackground);
    explicitVars.push({ name: "mono-padding", value: "0.2em" });
  } else {
    // otherwise provide a default code block border treatment
    explicitVars.push({ name: "codeblock-padding-left", value: "0.6rem" });
    explicitVars.push({ name: "codeblock-border-left", value: "3px solid" });
  }
  return explicitVars;
}

function resolveBootstrapSass(metadata: Metadata): SassBundle {
  // Quarto built in css
  const quartoThemesDir = formatResourcePath("html", `bootstrap/themes`);

  // The core bootstrap styles
  const boostrapRules = join(
    quartoThemesDir,
    "default/scss/bootstrap.scss",
  );

  // Resolve the provided themes to a set of variables and styles
  const themeRaw = metadata[kTheme];
  const themes = Array.isArray(themeRaw)
    ? themeRaw
    : [String(metadata[kTheme])];
  const themeScss = resolveThemeScss(themes, quartoThemesDir);

  const themeVariables: string[] = [];
  const themeRules: string[] = [];
  const themeDeclarations: string[] = [];
  themeScss.forEach((theme) => {
    if (theme.variables) {
      themeVariables.push(theme.variables);
    }

    if (theme.rules) {
      themeRules.push(theme.rules);
    }

    if (theme.declarations) {
      themeDeclarations.push(theme.declarations);
    }
  });

  // Quarto variables and styles
  const quartoVariables = formatResourcePath(
    "html",
    "_quarto-variables.scss",
  );
  const quartoRules = formatResourcePath("html", "_quarto.scss");

  // If any pandoc specific variables were provided, just pile them in here
  let documentVariables;
  const pandocVariables = mapPandocVariables(metadata);
  if (pandocVariables) {
    documentVariables = pandocVariables.map((variable) =>
      `$${variable.name}: ${variable.value};`
    ).join("\n");
  }

  return {
    dependency: kBootstrapDependencyName,
    key: themes.join("|"),
    loadPath: dirname(boostrapRules),
    variables: [
      documentVariables,
      ...themeVariables,
      Deno.readTextFileSync(quartoVariables),
    ].join(
      "\n\n",
    ),
    declarations: "",
    rules: [
      Deno.readTextFileSync(boostrapRules),
      ...themeRules,
      Deno.readTextFileSync(quartoRules),
    ].join("\n\n"),
  };
}

function pandocExtras(metadata: Metadata) {
  // see if there is a max-width
  const maxWidth = metadata["max-width"];
  const headerIncludes = maxWidth
    ? `<style type="text/css">body { max-width: ${
      asCssSize(maxWidth)
    };}</style>`
    : undefined;

  return {
    pandoc: {
      [kVariables]: {
        [kDocumentCss]: true,
        [kHeaderIncludes]: headerIncludes,
      },
    },
  };
}

function boostrapExtras(
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  const toc = hasTableOfContents(flags, format);

  const renderTemplate = (template: string) => {
    return renderEjs(formatResourcePath("html", `templates/${template}`), {
      toc,
    });
  };

  const bodyEnvelope = format.metadata[kPageLayout] !== "none"
    ? {
      before: renderTemplate("before-body.ejs"),
      after: renderTemplate("after-body.ejs"),
    }
    : undefined;

  return {
    pandoc: {
      [kSectionDivs]: true,
      [kVariables]: {
        [kDocumentCss]: false,
      },
    },
    [kTocTitle]: !hasTableOfContentsTitle(flags, format)
      ? "Table of contents"
      : undefined,
    [kSassBundles]: [resolveBootstrapSass(format.metadata)],
    [kDependencies]: [bootstrapFormatDependency(format)],
    [kBodyEnvelope]: bodyEnvelope,
    [kFilters]: {
      pre: [
        formatResourcePath("html", "html.lua"),
      ],
    },
    [kHtmlPostprocessors]: [bootstrapHtmlPostprocessor(format)],
  };
}

function bootstrapHtmlPostprocessor(format: Format) {
  // read options
  const codeCopy = format.metadata[kCodeCopy] === true;

  return (doc: Document): string[] => {
    // use display-6 style for title
    const title = doc.querySelector("header > .title");
    if (title) {
      title.classList.add("display-6");
    }

    // add 'lead' to subtitle
    const subtitle = doc.querySelector("header > .subtitle");
    if (subtitle) {
      subtitle.classList.add("lead");
    }

    // move the toc if there is a sidebar
    const toc = doc.querySelector('nav[role="doc-toc"]');
    const tocSidebar = doc.getElementById("quarto-toc-sidebar");
    if (toc && tocSidebar) {
      tocSidebar.appendChild(toc);
      // add scroll spy to the body
      const body = doc.body;
      body.setAttribute("data-bs-spy", "scroll");
      body.setAttribute("data-bs-target", "#" + tocSidebar.id);

      // add nav-link class to the TOC links
      const tocLinks = doc.querySelectorAll('nav[role="doc-toc"] a');
      for (let i = 0; i < tocLinks.length; i++) {
        // Mark the toc links as nav-links
        const tocLink = tocLinks[i] as Element;
        tocLink.classList.add("nav-link");

        // move the raw href to the target attribute (need the raw value, not the full path)
        if (!tocLink.hasAttribute("data-bs-target")) {
          tocLink.setAttribute("data-bs-target", tocLink.getAttribute("href"));
        }
      }
    }

    // add .table class to pandoc tables
    const tableHeaders = doc.querySelectorAll("tr.header");
    for (let i = 0; i < tableHeaders.length; i++) {
      const th = tableHeaders[i];
      if (th.parentNode?.parentNode) {
        (th.parentNode.parentNode as Element).classList.add("table");
      }
    }

    // move ids from section to headers
    const sections = doc.querySelectorAll('section[class^="level"]');
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] as Element;
      const heading = section.querySelector("h2") ||
        section.querySelector("h3") || section.querySelector("h4") ||
        section.querySelector("h5") || section.querySelector("h6");
      if (heading) {
        heading.setAttribute("id", section.id);
        section.removeAttribute("id");
      }
    }

    // insert code copy button
    if (codeCopy) {
      const codeBlocks = doc.querySelectorAll("pre.sourceCode");
      for (let i = 0; i < codeBlocks.length; i++) {
        const code = codeBlocks[i];
        const copyButton = doc.createElement("button");
        copyButton.classList.add("code-copy-button");
        copyButton.innerHTML = "Copy";
        const copyDiv = doc.createElement("div");
        copyDiv.classList.add("code-copy");
        copyDiv.appendChild(copyButton);
        code.appendChild(copyDiv);
      }
    }

    // no resource refs
    return [];
  };
}

function scssVarFromMetadata(
  metadata: Metadata,
  name: string,
  cssName: string,
  formatter?: (val: string) => string | undefined,
): ScssVariable | undefined {
  if (metadata[name]) {
    const value = typeof (metadata[name]) === "string"
      ? metadata[name]
      : undefined;
    if (value) {
      const formattedValue = formatter
        ? formatter(value as string)
        : value as string;

      if (formattedValue) {
        return {
          name: cssName,
          value: formattedValue,
        };
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

function asCssFont(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  } else {
    const fontFamily = String(value)
      .split(",")
      .map((font) => {
        font = font.trim();
        if (font.includes(" ")) {
          font = `"${font}"`;
        }
        return font;
      })
      .filter((font) => font.length > 0)
      .join(", ");
    return `${fontFamily}`;
  }
}

function asCssNumber(value: unknown): string | undefined {
  if (typeof (value) === "number") {
    return String(value);
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    const match = str.match(/(^[0-9]*)/);
    if (match) {
      return match[1];
    } else {
      return undefined;
    }
  }
}

function asCssSize(value: unknown): string | undefined {
  if (typeof (value) === "number") {
    if (value === 0) {
      return "0";
    } else {
      return value + "px";
    }
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    if (str !== "0" && !str.match(/\w$/)) {
      return str + "px";
    } else {
      return str;
    }
  }
}
