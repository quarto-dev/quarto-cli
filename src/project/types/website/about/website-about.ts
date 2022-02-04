/*
* website-about.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";
import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";
import { HtmlPostProcessResult } from "../../../../command/render/types.ts";
import { kToc } from "../../../../config/constants.ts";
import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  kSassBundles,
} from "../../../../config/types.ts";
import { renderEjs } from "../../../../core/ejs.ts";
import { dirAndStem } from "../../../../core/path.ts";
import { quartoConfig } from "../../../../core/quarto.ts";
import { projectTypeResourcePath } from "../../../../core/resources.ts";
import { sassLayerStr } from "../../../../core/sass.ts";
import { TempContext } from "../../../../core/temp.ts";
import { kBootstrapDependencyName } from "../../../../format/html/format-html-shared.ts";
import { NavItem } from "../../../project-config.ts";
import { ProjectContext } from "../../../types.ts";
import { kImage } from "../website-config.ts";
import { navigationItem } from "../website-navigation.ts";

const kAbout = "about";
const kTemplate = "template";
const kLinks = "links";

// TODO: navitems in md pipeline?

const kTemplates = [
  "jolla",
  "trestles",
  "solana",
  "marquee",
  "broadside",
];

type Href = string;
type AbsolutePath = string;

interface AboutPage {
  template: AbsolutePath;
  options: Record<string, unknown>;
  custom: boolean;
  image?: Href;
  links?: Array<NavItem>;
}

interface AboutPageEjsData {
  title: string;
  body: string;
  image?: string;
  links?: NavItem[];
  options: Record<string, unknown>;
}

export async function aboutHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  _temp: TempContext,
  _extras: FormatExtras,
) {
  // Compute the about page information
  const aboutPage = await readAbout(source, project, format);
  if (!aboutPage) {
    return undefined;
  }

  // About pages do not allow TOCs
  format.pandoc[kToc] = false;

  // Compute any scss that should be included
  const sassBundles = [];
  const templateBundle = templateScss(aboutPage);
  if (templateBundle) {
    sassBundles.push(templateBundle);
  }

  return {
    //    [kIncludeInHeader]: [scriptFileForScripts(scripts, temp)],
    [kHtmlPostprocessors]: aboutPagePostProcessor(aboutPage),
    //    [kMarkdownAfterBody]: pipeline.markdownAfterBody(),
    //    [kDependencies]: htmlDependencies,
    [kSassBundles]: sassBundles,
  };
}

async function readAbout(
  source: string,
  project: ProjectContext,
  format: Format,
): Promise<AboutPage | undefined> {
  const about = format.metadata[kAbout];
  if (about) {
    if (typeof (about) === "string") {
      // A string only about represents the template
      const [template, custom] = templatePath(about, source);
      const aboutPage: AboutPage = {
        template,
        custom,
        options: {},
      };

      // If the page has an image, use it
      if (format.metadata[kImage]) {
        aboutPage.image = format.metadata[kImage] as Href;
      }
      return aboutPage;
    } else if (typeof (about) === "object") {
      // This is an object, read the fields out of it
      const aboutObj = about as Record<string, unknown>;
      const aboutTemplate = aboutObj[kTemplate] as string;
      const [template, custom] = templatePath(aboutTemplate, source);
      const aboutPage: AboutPage = {
        template,
        custom,
        options: {},
      };

      const aboutImage = aboutObj[kImage];
      if (aboutImage) {
        aboutPage.image = aboutImage as Href;
      } else {
        if (format.metadata[kImage]) {
          aboutPage.image = format.metadata[kImage] as Href;
        }
      }

      const aboutLinks = aboutObj[kLinks] as Array<string | NavItem>;
      if (aboutLinks) {
        const links: NavItem[] = [];
        for (const aboutLink of aboutLinks) {
          links.push(await navigationItem(project, aboutLink, 0, false));
        }
        aboutPage.links = links;
      }

      const knownFieldList = ["image", "template", "links"];
      for (const key of Object.keys(aboutObj)) {
        if (!knownFieldList.includes(key)) {
          aboutPage.options[key] = aboutObj[key];
        }
      }

      return aboutPage;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

function templatePath(
  template: string,
  source: string,
): [AbsolutePath, boolean] {
  if (kTemplates.includes(template)) {
    return [
      join(
        projectTypeResourcePath("website"),
        `about/${template}.ejs.html`,
      ),
      false,
    ];
  } else {
    return [join(dirname(source), template), true];
  }
}

function templateScss(aboutPage: AboutPage) {
  const [dir, stem] = dirAndStem(aboutPage.template);
  const scssFileName = `${stem}.scss`;

  const scssPath = join(dir, scssFileName);
  if (existsSync(scssPath)) {
    const renderedScss = renderEjs(
      scssPath,
      { options: aboutPage.options },
      true,
      !aboutPage.custom && !quartoConfig.isDebug(),
    );

    const layer = sassLayerStr(renderedScss, scssPath);
    return {
      dependency: kBootstrapDependencyName,
      key: scssPath,
      quarto: {
        name: `quarto-about-${stem}.css`,
        ...layer,
      },
    };
  } else {
    return undefined;
  }
}

const aboutPagePostProcessor = (aboutPage: AboutPage) => {
  return (
    doc: Document,
  ): Promise<HtmlPostProcessResult> => {
    // Grab the title and remove it.
    const titleEl = doc.getElementById("title-block-header");
    titleEl?.remove();
    const title = titleEl?.outerHTML || "";

    // Grab the body
    const mainEl = doc.querySelector("main.content");
    const body = mainEl?.outerHTML || "";

    const ejsData: AboutPageEjsData = {
      title,
      body,
      image: aboutPage.image,
      links: aboutPage.links,
      options: aboutPage.options,
    };

    // Render the template
    // TODO Provide custom options from about yaml
    const aboutPageHtml = renderEjs(
      aboutPage.template,
      { about: ejsData },
      true,
      !aboutPage.custom && !quartoConfig.isDebug(),
    );

    // Replace the about page contents with the updated contents
    const aboutPageContainer = doc.createElement("div");
    aboutPageContainer.innerHTML = aboutPageHtml;
    mainEl?.after(...aboutPageContainer.childNodes);
    mainEl?.remove();

    const result: HtmlPostProcessResult = {
      resources: [],
      supporting: [],
    };
    if (aboutPage.image) {
      result.resources.push(aboutPage.image);
    }

    return Promise.resolve(result);
  };
};
