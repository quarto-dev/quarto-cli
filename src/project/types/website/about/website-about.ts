/*
 * website-about.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { dirname, join } from "path/mod.ts";
import { HtmlPostProcessResult } from "../../../../command/render/types.ts";
import { kToc } from "../../../../config/constants.ts";
import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
} from "../../../../config/types.ts";
import { renderEjs } from "../../../../core/ejs.ts";
import { quartoConfig } from "../../../../core/quarto.ts";
import { projectTypeResourcePath } from "../../../../core/resources.ts";
import { sassLayerFile } from "../../../../core/sass.ts";
import { TempContext } from "../../../../core/temp.ts";
import {
  kAnchorSections,
  kBootstrapDependencyName,
} from "../../../../format/html/format-html-shared.ts";
import { NavItem, ProjectContext } from "../../../types.ts";
import { kImage } from "../website-constants.ts";
import { navigationItem } from "../website-navigation.ts";
import {
  createMarkdownPipeline,
  MarkdownPipeline,
  MarkdownPipelineHandler,
  PipelineMarkdown,
} from "../../../../core/markdown-pipeline.ts";

const kAbout = "about";
const kTemplate = "template";
const kType = "type";
const kLinks = "links";

const kImageWidth = "image-width";
const kImageAlt = "image-alt";
const kImageTitle = "image-title";
const kImageShape = "image-shape";
const kImageShapeRound = "round";
const kImageShapeRounded = "rounded";

// TODO: navitems in md pipeline?

const kTemplateJolla = "jolla";
const kTemplateTrestles = "trestles";
const kTemplateSolana = "solana";
const kTemplateMarquee = "marquee";
const kTemplateBroadside = "broadside";

const kTemplates = [
  kTemplateJolla,
  kTemplateTrestles,
  kTemplateSolana,
  kTemplateMarquee,
  kTemplateBroadside,
];

type Href = string;
type AbsolutePath = string;

interface AboutPage {
  id?: string;
  template: AbsolutePath;
  options: Record<string, unknown>;
  custom: boolean;
  image?: Href;
  [kImageAlt]?: string;
  [kImageTitle]?: string;
  links?: Array<NavItem>;
}

interface AboutPageEjsData {
  title: string;
  body: string;
  image?: string;
  [kImageAlt]?: string;
  [kImageTitle]?: string;
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

  if (aboutPage) {
    // About pages do not allow TOCs
    format.pandoc[kToc] = false;
    format.metadata[kAnchorSections] = false;
  }

  // Compute any scss that should be included
  const scssPath = join(
    projectTypeResourcePath("website"),
    `about/about.scss`,
  );
  const aboutLayer = sassLayerFile(scssPath);
  const sassBundles = [
    {
      dependency: kBootstrapDependencyName,
      key: scssPath,
      quarto: {
        name: `quarto-about.css`,
        ...aboutLayer,
      },
    },
  ];

  // Create the markdown pipeline for this set of about page links
  const markdownHandlers: MarkdownPipelineHandler[] = [];
  if (aboutPage) {
    markdownHandlers.push(aboutLinksMarkdownHandler(aboutPage));
  }
  const pipeline = createMarkdownPipeline(
    `quarto-about-pipeline`,
    markdownHandlers,
  );

  return {
    [kMarkdownAfterBody]: markdownHandlers.length > 0
      ? [pipeline.markdownAfterBody()]
      : [""],
    [kHtmlPostprocessors]: aboutPage
      ? aboutPagePostProcessor(aboutPage, pipeline)
      : undefined,
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
    const resolveOptions = (
      aboutTemplate: string,
      aboutObj: Record<string, unknown>,
      aboutPage: AboutPage,
    ) => {
      const knownFieldList = [
        "image",
        kImageAlt,
        kImageTitle,
        "template",
        "links",
      ];
      for (const key of Object.keys(aboutObj)) {
        if (!knownFieldList.includes(key)) {
          aboutPage.options[key] = aboutObj[key];
        }
      }

      if (aboutPage.options[kImageShape] === undefined) {
        if (aboutTemplate === kTemplateJolla) {
          aboutPage.options[kImageShape] = kImageShapeRound;
        } else if (aboutTemplate === kTemplateSolana) {
          aboutPage.options[kImageShape] = kImageShapeRounded;
        } else if (aboutTemplate === kTemplateTrestles) {
          aboutPage.options[kImageShape] = kImageShapeRounded;
        }
      }

      if (aboutPage.options[kImageWidth] === undefined) {
        if (aboutTemplate === kTemplateJolla) {
          aboutPage.options[kImageWidth] = "15em";
        } else if (aboutTemplate === kTemplateSolana) {
          aboutPage.options[kImageWidth] = "15em";
        } else if (aboutTemplate === kTemplateTrestles) {
          aboutPage.options[kImageWidth] = "20em";
        } else if (aboutTemplate === kTemplateMarquee) {
          aboutPage.options[kImageWidth] = "100%";
        } else if (aboutTemplate === kTemplateBroadside) {
          aboutPage.options[kImageWidth] = "15em";
        }
      }

      return aboutPage;
    };

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
      if (format.metadata[kImageAlt]) {
        aboutPage[kImageAlt] = format.metadata[kImageAlt] as string;
      }
      if (format.metadata[kImageTitle]) {
        aboutPage[kImageTitle] = format.metadata[kImageTitle] as string;
      }

      // Resolve any options
      resolveOptions(about, {}, aboutPage);
      return aboutPage;
    } else if (typeof (about) === "object") {
      // This is an object, read the fields out of it
      const aboutObj = about as Record<string, unknown>;
      const aboutTemplate = aboutObj[kType] as string ||
        aboutObj[kTemplate] as string;
      const [template, custom] = templatePath(aboutTemplate, source);
      const id = aboutObj.id as string;
      const aboutPage: AboutPage = {
        id,
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

      const aboutImageAlt = aboutObj[kImageAlt];
      if (aboutImageAlt) {
        aboutPage[kImageAlt] = aboutImageAlt as string;
      } else {
        if (format.metadata[kImageAlt]) {
          aboutPage[kImageAlt] = format.metadata[kImageAlt] as string;
        }
      }

      const aboutImageTitle = aboutObj[kImageTitle];
      if (aboutImageTitle) {
        aboutPage[kImageTitle] = aboutImageTitle as string;
      } else {
        if (format.metadata[kImageTitle]) {
          aboutPage[kImageTitle] = format.metadata[kImageTitle] as string;
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

      // Resolve any options
      resolveOptions(aboutTemplate, aboutObj, aboutPage);
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

const aboutPagePostProcessor = (
  aboutPage: AboutPage,
  pipeline: MarkdownPipeline,
) => {
  return (
    doc: Document,
  ): Promise<HtmlPostProcessResult> => {
    // Grab the title and remove it.
    const titleEl = doc.getElementById("title-block-header");
    titleEl?.remove();
    const title = titleEl?.outerHTML || "";

    // Grab the about element
    let aboutEl = aboutPage.id ? doc.getElementById(aboutPage.id) : undefined;
    if (!aboutEl) {
      aboutEl = doc.querySelector("main.content");
    }

    const body = aboutEl?.outerHTML || "";

    const ejsData: AboutPageEjsData = {
      title,
      body,
      image: aboutPage.image,
      [kImageAlt]: aboutPage[kImageAlt],
      [kImageTitle]: aboutPage[kImageTitle],
      links: aboutPage.links,
      options: aboutPage.options,
    };

    // Render the template
    const aboutPageHtml = renderEjs(
      aboutPage.template,
      { about: ejsData },
      true,
      !aboutPage.custom && !quartoConfig.isDebug(),
    );

    // Replace the about page contents with the updated contents
    const aboutPageContainer = doc.createElement("div");
    aboutPageContainer.innerHTML = aboutPageHtml;
    aboutEl?.after(...aboutPageContainer.childNodes);
    aboutEl?.remove();

    const result: HtmlPostProcessResult = {
      resources: [],
      supporting: [],
    };
    if (aboutPage.image) {
      result.resources.push(aboutPage.image);
    }

    // Update any rendered items
    pipeline.processRenderedMarkdown(doc);

    return Promise.resolve(result);
  };
};

const aboutLinksMarkdownHandler = (aboutPage: AboutPage) => {
  return {
    getUnrendered: (): PipelineMarkdown | undefined => {
      const pipelineMarkdown: PipelineMarkdown = {};
      aboutPage.links?.forEach((link) => {
        if (typeof link === "string") {
          pipelineMarkdown.inlines = pipelineMarkdown.inlines || {};
          pipelineMarkdown.inlines[link] = link;
        } else if (link.text) {
          pipelineMarkdown.inlines = pipelineMarkdown.inlines || {};
          pipelineMarkdown.inlines[link.text] = link.text;
        }
      });
      return pipelineMarkdown;
    },
    processRendered: (
      rendered: Record<string, Element>,
      doc: Document,
    ): void => {
      const aboutLinkNodes = doc.querySelectorAll(
        ".about-links .about-link .about-link-text",
      );
      for (const aboutLinkNode of aboutLinkNodes) {
        const aboutLinkEl = aboutLinkNode as Element;
        const aboutLinkRendered = rendered[aboutLinkEl.innerText.trim()];
        if (aboutLinkRendered) {
          aboutLinkEl.innerHTML = aboutLinkRendered.innerHTML;
        }
      }
    },
  };
};
