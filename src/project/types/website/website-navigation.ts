/*
 * website-navigation.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";
import * as ld from "../../../core/lodash.ts";

import { Document, Element } from "../../../core/deno-dom.ts";

import { pathWithForwardSlashes, safeExistsSync } from "../../../core/path.ts";
import { resourcePath } from "../../../core/resources.ts";
import { renderEjs } from "../../../core/ejs.ts";
import { warnOnce } from "../../../core/log.ts";
import { asHtmlId } from "../../../core/html.ts";
import { sassLayer } from "../../../core/sass.ts";
import { removeChapterNumber } from "./website-utils.ts";
import {
  breadCrumbs,
  itemHasNavTarget,
  sidebarForHref,
} from "./website-shared.ts";

import {
  Format,
  FormatDependency,
  FormatExtras,
  FormatLanguage,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
  PandocFlags,
  SassBundle,
} from "../../../config/types.ts";
import {
  disabledTableOfContents,
  hasTableOfContents,
} from "../../../config/toc.ts";

import { kBootstrapDependencyName } from "../../../format/html/format-html-shared.ts";
import { formatDarkMode } from "../../../format/html/format-html-info.ts";

import {
  formatHasArticleLayout,
  formatPageLayout,
} from "../../../format/html/format-html-shared.ts";

import { kDataQuartoSourceUrl } from "../../../command/render/codetools.ts";

import {
  kLogoAlt,
  kLogoHref,
  kProjectType,
  NavigationItemObject,
  ProjectConfig,
  ProjectContext,
} from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { resolveInputTarget } from "../../project-index.ts";
import {
  kCollapseBelow,
  kCollapseLevel,
  kSidebarMenus,
  LayoutBreak,
  Navbar,
  NavItem,
  Sidebar,
  SidebarItem,
  SidebarTool,
} from "../../types.ts";
import {
  normalizeSidebarItem,
  resolveHrefAttribute,
  SidebarContext,
  sidebarContext,
} from "../../project-config.ts";
import { projectType } from "../project-types.ts";

import {
  searchOptions,
  websiteSearchDependency,
  websiteSearchIncludeInHeader,
  websiteSearchSassBundle,
} from "./website-search.ts";

import {
  kBackToTopNavigation,
  kBreadCrumbNavigation,
  kSiteIssueUrl,
  kSiteNavbar,
  kSitePageNavigation,
  kSiteReaderMode,
  kSiteRepoActions,
  kSiteRepoLinkRel,
  kSiteRepoLinkTarget,
  kSiteRepoUrl,
  kSiteSidebar,
  kWebsite,
} from "./website-constants.ts";

import {
  repoUrlIcon,
  websiteConfigActions,
  websiteConfigBoolean,
  websiteConfigString,
  websiteHtmlFormat,
  websiteRepoBranch,
  WebsiteRepoInfo,
  websiteRepoInfo,
  websiteTitle,
} from "./website-config.ts";
import {
  flattenItems,
  inputFileHref,
  NavigationFooter,
  NavigationPagination,
  websiteNavigationConfig,
} from "./website-shared.ts";
import {
  kBackToTop,
  kIncludeInHeader,
  kNumberSections,
  kRepoActionLinksEdit,
  kRepoActionLinksIssue,
  kRepoActionLinksSource,
  kTocLocation,
} from "../../../config/constants.ts";
import { navigationMarkdownHandlers } from "./website-navigation-md.ts";
import {
  createMarkdownPipeline,
  MarkdownPipeline,
} from "../../../core/markdown-pipeline.ts";
import { TempContext } from "../../../core/temp.ts";
import { HtmlPostProcessResult } from "../../../command/render/types.ts";
import { isJupyterNotebook } from "../../../core/jupyter/jupyter.ts";
import { kHtmlEmptyPostProcessResult } from "../../../command/render/constants.ts";
import { expandAutoSidebarItems } from "./website-sidebar-auto.ts";
import { resolveProjectInputLinks } from "../project-utilities.ts";
import { dashboardScssLayer } from "../../../format/dashboard/format-dashboard-shared.ts";

import { navigation } from "./website-shared.ts";
import { isAboutPage } from "./about/website-about.ts";

export const kSidebarLogo = "logo";

export async function initWebsiteNavigation(project: ProjectContext) {
  // reset unique menu ids
  resetMenuIds();

  // read config
  const {
    navbar,
    sidebars,
    pageNavigation,
    footer,
    pageMargin,
    bodyDecorators,
  } = websiteNavigationConfig(
    project,
  );
  if (
    !navbar && !sidebars && !pageNavigation && !footer && !pageMargin &&
    !bodyDecorators
  ) {
    return;
  }

  // sidebars
  if (sidebars) {
    navigation.sidebars = await sidebarsEjsData(project, sidebars);
    navigation.sidebars = resolveNavReferences(
      navigation.sidebars,
    ) as Sidebar[];
  } else {
    navigation.sidebars = [];
  }

  // navbar
  if (navbar) {
    navigation.navbar = await navbarEjsData(project, navbar);
    navigation.navbar = resolveNavReferences(navigation.navbar) as Navbar;
  } else {
    navigation.navbar = undefined;
  }

  navigation.pageNavigation = pageNavigation;
  navigation.footer = await resolveFooter(project, footer);
  navigation.bodyDecorators = bodyDecorators;

  navigation.pageMargin = pageMargin;
}

export async function websiteNoThemeExtras(
  project: ProjectContext,
  source: string,
  _flags: PandocFlags,
  _format: Format,
  _temp: TempContext,
): Promise<FormatExtras> {
  return {
    html: {
      [kHtmlPostprocessors]: [
        async (doc: Document): Promise<HtmlPostProcessResult> => {
          await resolveProjectInputLinks(source, project, doc);
          return Promise.resolve({
            resources: [],
            supporting: [],
          });
        },
      ],
    },
  };
}

export async function websiteNavigationExtras(
  project: ProjectContext,
  source: string,
  flags: PandocFlags,
  format: Format,
  temp: TempContext,
): Promise<FormatExtras> {
  const usesCustomLayout = !formatHasArticleLayout(format);
  const hasToc = () => {
    // The user has explicitly disabled
    if (disabledTableOfContents(format)) {
      return false;
    } else if (hasTableOfContents(flags, format)) {
      // The user has explicitly enabled
      return true;
    } else if (usesCustomLayout) {
      // This is a custom layout or none
      return false;
    } else {
      return true;
    }
  };

  const tocLocation = () => {
    if (isAboutPage(format)) {
      return "right";
    } else {
      return format.metadata[kTocLocation] || "right";
    }
  };

  // find the relative path for this input
  const inputRelative = relative(project.dir, source);

  // determine dependencies (always include baseline nav dependency)
  const dependencies: FormatDependency[] = [
    websiteNavigationDependency(project),
  ];

  // the contents of anything before the head
  const includeInHeader = [];

  // Determine any sass bundles
  const sassBundles: SassBundle[] = [websiteNavigationSassBundle()];

  const searchDep = websiteSearchDependency(project, source);
  if (searchDep) {
    dependencies.push(...searchDep);
    sassBundles.push(websiteSearchSassBundle());
    includeInHeader.push(websiteSearchIncludeInHeader(project, format, temp));
  }

  // Inject dashboard dependencies so they are present if necessary
  sassBundles.push(dashboardScssLayer());

  // Check to see whether the navbar or sidebar have been disabled on this page
  const disableNavbar = format.metadata[kSiteNavbar] !== undefined &&
    format.metadata[kSiteNavbar] === false;
  const disableSidebar = format.metadata[kSiteSidebar] !== undefined &&
      format.metadata[kSiteSidebar] === false || usesCustomLayout;

  // determine body envelope
  const target = await resolveInputTarget(project, inputRelative);
  const href = target?.outputHref || inputFileHref(inputRelative);
  const sidebar = sidebarForHref(href, format);

  const nav: Record<string, unknown> = {
    hasToc: hasToc(),
    [kTocLocation]: tocLocation(),
    layout: formatPageLayout(format),
    navbar: disableNavbar ? undefined : navigation.navbar,
    sidebar: disableSidebar ? undefined : expandedSidebar(href, sidebar),
    sidebarStyle: sidebarStyle(),
    footer: navigation.footer,
    language: format.language,
    showBreadCrumbs: websiteConfigBoolean(
      kBreadCrumbNavigation,
      true,
      project.config,
    ),
  };

  // Determine the previous and next page
  const formatPageNav = format.metadata[kSitePageNavigation];
  const pageNavigation = nextAndPrevious(href, sidebar);
  if (
    formatPageNav !== false &&
    (navigation.pageNavigation || formatPageNav === true) &&
    !usesCustomLayout
  ) {
    nav.prevPage = pageNavigation.prevPage;
    nav.nextPage = pageNavigation.nextPage;

    // Inject link tags with rel nest/prev for the page
    const metaLinks = [];
    if (pageNavigation.nextPage?.href) {
      metaLinks.push(
        { rel: "next", href: pageNavigation.nextPage?.href },
      );
    }

    if (pageNavigation.prevPage?.href) {
      metaLinks.push(
        { rel: "prev", href: pageNavigation.prevPage?.href },
      );
    }

    if (metaLinks.length > 0) {
      dependencies.push({ name: "website-pagination", links: metaLinks });
    }
  }

  const crumbs = breadCrumbs(href, sidebar);
  navigation.breadCrumbs = crumbs;

  // forward the footer
  if (navigation.footer) {
    nav.footer = navigation.footer;
  }

  // determine whether to show the dark toggle
  const darkMode = formatDarkMode(format);
  if (darkMode !== undefined && nav.navbar) {
    (nav.navbar as Record<string, unknown>).darkToggle = true;
  } else if (darkMode !== undefined && nav.sidebar) {
    (nav.sidebar as Record<string, unknown>).darkToggle = true;
  }

  // determine whether to show the reader mode toggle
  const readerMode = websiteConfigBoolean(
    kSiteReaderMode,
    false,
    project.config,
  );
  if (readerMode && nav.navbar) {
    (nav.navbar as Record<string, unknown>).readerToggle = true;
  } else if (readerMode && nav.sidebar) {
    (nav.sidebar as Record<string, unknown>).readerToggle = true;
  }

  const projTemplate = (template: string) =>
    resourcePath(`projects/website/templates/${template}`);
  const bodyEnvelope = {
    before: renderEjs(projTemplate("nav-before-body.ejs"), { nav }),
    afterPreamble: renderEjs(projTemplate("nav-after-body-preamble.ejs"), {
      nav,
    }),
    afterPostamble: renderEjs(projTemplate("nav-after-body-postamble.ejs"), {
      nav,
    }),
  };

  const pipelineHandlers = navigationMarkdownHandlers({
    source,
    format,
    sidebar,
    navigation,
    pageNavigation,
    bodyDecorators: navigation.bodyDecorators,
    breadCrumbs: navigation.breadCrumbs,
  });
  const markdownPipeline = createMarkdownPipeline(
    "quarto-navigation-envelope",
    pipelineHandlers,
  );

  // return extras with bodyEnvelope
  return {
    [kIncludeInHeader]: includeInHeader,
    html: {
      [kSassBundles]: sassBundles,
      [kDependencies]: dependencies,
      [kBodyEnvelope]: bodyEnvelope,
      [kHtmlPostprocessors]: [
        navigationHtmlPostprocessor(
          project,
          format,
          source,
          markdownPipeline,
          format.language,
        ),
      ],
      [kMarkdownAfterBody]: [
        markdownPipeline.markdownAfterBody(),
      ],
    },
  };
}

export async function ensureIndexPage(project: ProjectContext) {
  const outputDir = projectOutputDir(project);
  const indexPage = join(outputDir, "index.html");
  if (!safeExistsSync(indexPage)) {
    const firstInput = project.files.input[0];
    if (firstInput) {
      const firstInputHref = relative(project.dir, firstInput);
      const resolved = await resolveInputTarget(project, firstInputHref, false);
      if (resolved) {
        writeRedirectPage(indexPage, resolved.outputHref);
      }
    }
  }
}

export function writeRedirectPage(path: string, href: string) {
  const redirectTemplate = resourcePath(
    "projects/website/templates/redirect-simple.ejs",
  );
  const redirectHtml = renderEjs(redirectTemplate, {
    url: href,
  });
  Deno.writeTextFileSync(path, redirectHtml);
}

function navigationHtmlPostprocessor(
  project: ProjectContext,
  format: Format,
  source: string,
  markdownPipeline: MarkdownPipeline,
  language: FormatLanguage,
) {
  const sourceRelative = relative(project.dir, source);
  const href = inputFileHref(sourceRelative);

  const showBreadCrumbs = websiteConfigBoolean(
    kBreadCrumbNavigation,
    true,
    project.config,
  );

  return async (doc: Document): Promise<HtmlPostProcessResult> => {
    // Process the breadcrumbs and collapsed title
    // This needs to happen before resolving the pipeline
    const secondaryNavTitleEl = doc.querySelector(
      ".quarto-secondary-nav .quarto-secondary-nav-title",
    );
    if (secondaryNavTitleEl) {
      if (showBreadCrumbs) {
        const navEl = makeBreadCrumbs(doc);
        if (secondaryNavTitleEl.parentElement) {
          secondaryNavTitleEl.parentElement.replaceChild(
            navEl,
            secondaryNavTitleEl,
          );
        }
      } else {
        // Process the title into the secondary nav bar
        const titleEl = doc.querySelector("h1.title");
        if (titleEl) {
          for (const child of titleEl.childNodes) {
            secondaryNavTitleEl.append(child.cloneNode(true));
          }
          // Decorate the title so we know to hide it
          titleEl.classList.add("d-none");
          titleEl.classList.add("d-lg-block");
        }
      }

      // hide the entire title block (encompassing code button) if we have it
      const titleBlock = doc.querySelector("header > .quarto-title-block");
      if (titleBlock) {
        // hide below lg
        titleBlock.classList.add("d-none");
        titleBlock.classList.add("d-lg-block");
      }
    }

    const titleBlockEl = doc.querySelector(".quarto-title-block");
    if (showBreadCrumbs && titleBlockEl) {
      if (navigation.breadCrumbs && navigation.breadCrumbs.length > 1) {
        const titleBreadCrumbEl = makeBreadCrumbs(
          doc,
          ["quarto-title-breadcrumbs", "d-none", "d-lg-block"],
        );
        titleBlockEl.prepend(titleBreadCrumbEl);
      }
    }

    // Process any markdown rendered through the render envelope
    markdownPipeline.processRenderedMarkdown(doc);

    // Mark the body with a sidebar, if present
    const sidebar = sidebarForHref(href, format);
    // Check whether the sidebar was explicitly hidden
    const sidebarHidden = format.metadata[kSiteSidebar] === false;

    // If there is a sidebar that isn't hidden
    if (sidebar && !sidebarHidden) {
      doc.body.classList.add("nav-sidebar");
    }

    // Note sidebar style on body
    // TODO: Should we compute this using the using project instead?
    // It is slightly complicated since we need to compute the sidebar
    const sidebarEl = doc.body.getElementById("quarto-sidebar");
    if (sidebarEl?.classList.contains("floating")) {
      doc.body.classList.add("floating");
    } else if (sidebarEl?.classList.contains("docked")) {
      doc.body.classList.add("docked");
    }

    // Note whether navbar is on (this is used)
    // to create initial padding to prevent a jerk/flash when
    // loading
    const headerEl = doc.body.querySelector(
      "#quarto-header.fixed-top nav.navbar",
    );
    if (headerEl) {
      doc.body.classList.add("nav-fixed");
    }

    // latch active nav link
    const navLinks = doc.querySelectorAll("a.nav-link");
    for (let i = 0; i < navLinks.length; i++) {
      const navLink = navLinks[i] as Element;
      const navLinkHref = navLink.getAttribute("href");

      const sidebarLink = doc.querySelector(
        '.sidebar-navigation a[href="' + navLinkHref + '"]',
      );
      // if the link is either for the current window href or appears on the
      // sidebar then set it to active
      if (sidebarLink || (navLinkHref === href)) {
        navLink.classList.add("active");
        navLink.setAttribute("aria-current", "page");
        // terminate (only one nav link should be active)
        break;
      }
    }

    // Resolve any links to project inputs
    await resolveProjectInputLinks(source, project, doc);

    // handle repo links
    handleRepoLinks(
      format,
      doc,
      pathWithForwardSlashes(sourceRelative),
      language,
      project.config,
    );

    // remove section numbers from sidebar if they have been turned off in the project file
    const numberSections =
      websiteHtmlFormat(project).pandoc[kNumberSections] !== false;
    if (numberSections === false) {
      // Look through sidebar items and remove the chapter number (and separator)
      // and replace with the title only
      const sidebarItems = doc.querySelectorAll(
        ".sidebar-item .sidebar-item-text",
      );
      for (let i = 0; i < sidebarItems.length; i++) {
        const sidebarItem = sidebarItems[i] as Element;
        removeChapterNumber(sidebarItem);
      }

      // remove the chapter number from the title, page-navigation
      const sels = [
        "h1.title",
        ".page-navigation .nav-page-next .nav-page-text",
        ".page-navigation .nav-page-previous .nav-page-text",
        "h1.quarto-secondary-nav-title",
        ".breadcrumb-item a",
      ];
      for (const sel of sels) {
        const nodes = doc.querySelectorAll(sel);
        if (nodes !== null) {
          for (const node of nodes) {
            removeChapterNumber(node as Element);
          }
        }
      }
    }

    const projBackToTop = websiteConfigBoolean(
      kBackToTopNavigation,
      false,
      project.config,
    );
    const formatBackToTop = format.metadata[kBackToTopNavigation];
    if (projBackToTop && formatBackToTop !== false) {
      // Add a return to top button, if needed
      const contentEl = doc.querySelector("main");
      const backToTopEl = doc.createElement("a");
      backToTopEl.setAttribute(
        "onclick",
        "window.scrollTo(0, 0); return false;",
      );

      const backText = language[kBackToTop];
      const backIcon = "arrow-up";
      backToTopEl.setAttribute("role", "button");
      backToTopEl.innerHTML = `<i class='bi bi-${backIcon}'></i> ${backText}`;
      backToTopEl.id = "quarto-back-to-top";
      contentEl?.appendChild(backToTopEl);
    }

    return Promise.resolve(kHtmlEmptyPostProcessResult);
  };
}

function handleRepoLinks(
  format: Format,
  doc: Document,
  source: string,
  language: FormatLanguage,
  config?: ProjectConfig,
) {
  // Don't process repo-actions if document disables it
  if (format.metadata[kSiteRepoActions] === false) {
    return;
  }

  const forceRepoActions = format.metadata[kSiteRepoActions] === true;

  const repoActions = websiteConfigActions(
    kSiteRepoActions,
    kWebsite,
    config,
  );
  const issueUrl = websiteConfigString(kSiteIssueUrl, config);
  if (issueUrl && !repoActions.includes("issue")) {
    repoActions.push("issue");
  }

  const elRepoSource = doc.querySelector(
    "[" + kDataQuartoSourceUrl + '="repo"]',
  );

  if (repoActions.length > 0 || elRepoSource) {
    const repoInfo = websiteRepoInfo(format, config);
    if (repoInfo || issueUrl) {
      if (repoActions.length > 0) {
        // find the toc

        // Collect the places to write the repo actions
        const repoTargets: Array<{ el: Element; clz?: string[] }> = [];
        const tocRepoTarget = doc.querySelector(`nav[role="doc-toc"]`);
        if (tocRepoTarget) {
          repoTargets.push({ el: tocRepoTarget });
        }
        if (repoTargets.length === 0 && forceRepoActions) {
          const sidebarRepoTarget = doc.querySelector("#quarto-margin-sidebar");
          if (sidebarRepoTarget) {
            repoTargets.push({ el: sidebarRepoTarget });
          }
        }

        const footerRepoTarget = doc.querySelector(
          ".nav-footer .nav-footer-center",
        );
        if (footerRepoTarget) {
          repoTargets.push({
            el: footerRepoTarget,
            clz: repoTargets.length > 0
              ? ["d-sm-block", "d-md-none"]
              : undefined,
          });
        } else {
          const ensureEl = (
            doc: Document,
            tagname: string,
            classname: string,
            parent: Element,
            afterEl?: Element | null,
          ) => {
            let el = parent.querySelector(`${tagname}.${classname}`);
            if (!el) {
              el = doc.createElement(tagname);
              el.classList.add(classname);
              if (afterEl !== null && afterEl && afterEl.nextElementSibling) {
                parent.insertBefore(el, afterEl.nextElementSibling);
              } else {
                parent.appendChild(el);
              }
            }
            return el;
          };

          const footerEl = ensureEl(
            doc,
            "footer",
            "footer",
            doc.body,
            doc.querySelector("div#quarto-content"),
          );
          const footerContainer = ensureEl(
            doc,
            "div",
            "nav-footer",
            footerEl,
          );
          const footerCenterEl = ensureEl(
            doc,
            "div",
            "nav-footer-center",
            footerContainer,
            footerContainer.querySelector(".nav-footer-left"),
          );
          repoTargets.push({
            el: footerCenterEl,
            clz: repoTargets.length > 0
              ? ["d-sm-block", "d-md-none"]
              : undefined,
          });
        }

        if (repoTargets.length > 0) {
          const linkTarget = websiteConfigString(kSiteRepoLinkTarget, config);
          const linkRel = websiteConfigString(kSiteRepoLinkRel, config);

          // get the action links
          const links = repoInfo
            ? repoActionLinks(
              repoActions,
              repoInfo,
              websiteRepoBranch(config),
              source,
              language,
              issueUrl,
            )
            : [{
              text: language[kRepoActionLinksIssue]!,
              url: issueUrl!,
              icon: "chat-right",
            }];
          repoTargets.forEach((repoTarget) => {
            const actionsDiv = doc.createElement("div");
            actionsDiv.classList.add("toc-actions");

            const ulEl = doc.createElement("ul");
            links.forEach((link) => {
              const a = doc.createElement("a");
              a.setAttribute("href", link.url);
              if (linkTarget) {
                a.setAttribute("target", linkTarget);
              }
              if (linkRel) {
                a.setAttribute("rel", linkRel);
              }
              a.classList.add("toc-action");
              a.innerHTML = link.text;

              const i = doc.createElement("i");
              i.classList.add("bi");
              if (link.icon) {
                i.classList.add(`bi-${link.icon}`);
              } else {
                i.classList.add(`empty`);
              }

              a.prepend(i);

              const liEl = doc.createElement("li");
              liEl.appendChild(a);

              ulEl.appendChild(liEl);
            });
            actionsDiv.appendChild(ulEl);
            repoTarget.el.appendChild(actionsDiv);
            if (repoTarget.clz) {
              repoTarget.clz.forEach((cls) => {
                actionsDiv.classList.add(cls);
              });
            }
          });
        }
      }
      if (elRepoSource && repoInfo) {
        elRepoSource.setAttribute(
          kDataQuartoSourceUrl,
          `${repoInfo.baseUrl}blob/${
            websiteRepoBranch(config)
          }/${repoInfo.path}${source}`,
        );
      }
    } else {
      warnOnce(
        `Repository links require that you specify a ${kSiteRepoUrl}`,
      );
    }
  }
}

function repoActionLinks(
  actions: string[],
  repoInfo: WebsiteRepoInfo,
  branch: string,
  source: string,
  language: FormatLanguage,
  issueUrl?: string,
): Array<{ text: string; url: string; icon?: string }> {
  const firstIcon = repoUrlIcon(repoInfo.baseUrl);
  return actions.map((action, i) => {
    switch (action) {
      case "edit":
        if (!isJupyterNotebook(source)) {
          return {
            text: language[kRepoActionLinksEdit],
            url: `${repoInfo.baseUrl}edit/${branch}/${repoInfo.path}${source}`,
            icon: i === 0 ? firstIcon : undefined,
          };
        } else if (repoInfo.baseUrl.indexOf("github.com") !== -1) {
          return {
            text: language[kRepoActionLinksEdit],
            url: `${
              repoInfo.baseUrl.replace("github.com", "github.dev")
            }blob/${branch}/${repoInfo.path}${source}`,
            icon: i === 0 ? firstIcon : undefined,
          };
        } else {
          return null;
        }
      case "source":
        return {
          text: language[kRepoActionLinksSource],
          url: `${repoInfo.baseUrl}blob/${branch}/${repoInfo.path}${source}`,
          icon: i === 0 ? firstIcon : undefined,
        };
      case "issue":
        return {
          text: language[kRepoActionLinksIssue],
          url: issueUrl || `${repoInfo.baseUrl}issues/new`,
          icon: i === 0 ? firstIcon : undefined,
        };

      default: {
        warnOnce(`Unknown repo action '${action}'`);
        return null;
      }
    }
  }).filter((action) => action !== null) as Array<
    { text: string; url: string; icon: string }
  >;
}

async function resolveFooter(
  project: ProjectContext,
  footer?: NavigationFooter,
) {
  const resolveItems = async (
    contents: string | (string | NavItem)[] | undefined,
  ) => {
    if (Array.isArray(contents)) {
      const resolvedItems = [];
      for (let i = 0; i < contents.length; i++) {
        const item = contents[i];
        const navItem = await navigationItem(project, item);
        resolvedItems.push(navItem);
      }
      return resolvedItems;
    } else {
      return contents;
    }
  };

  if (footer) {
    footer.left = await resolveItems(footer.left);
    footer.center = await resolveItems(footer.center);
    footer.right = await resolveItems(footer.right);
  }
  return footer;
}

function makeBreadCrumbs(doc: Document, clz?: string[]) {
  // Make bootstrap breadcrumbs
  const navEl = doc.createElement("nav");
  navEl.classList.add("quarto-page-breadcrumbs");
  if (clz && clz.length) {
    clz.forEach((cls) => {
      navEl.classList.add(cls);
    });
  }
  navEl.setAttribute("aria-label", "breadcrumb");

  const olEl = doc.createElement("ol");
  olEl.classList.add("breadcrumb");
  navEl.append(olEl);

  const breadCrumbEl = () => {
    const liEl = doc.createElement("li");
    liEl.classList.add("breadcrumb-item");
    return liEl;
  };

  if (navigation.breadCrumbs && navigation.breadCrumbs.length > 0) {
    for (const item of navigation.breadCrumbs) {
      if (item.text || item.icon) {
        const liEl = breadCrumbEl();
        const maybeLink = (liEl: Element, contents: Element | string) => {
          if (item.href) {
            const linkEl = doc.createElement("a");
            linkEl.setAttribute("href", item.href);
            if (typeof contents === "string") {
              linkEl.innerHTML = contents;
            } else {
              linkEl.appendChild(contents);
            }

            liEl.appendChild(linkEl);
            return liEl;
          } else {
            if (typeof contents === "string") {
              liEl.innerHTML = item.text || "";
            } else {
              liEl.appendChild(contents);
            }

            return liEl;
          }
        };

        if (item.text) {
          olEl.appendChild(
            maybeLink(
              liEl,
              item.text || "",
            ),
          );
        } else if (item.icon) {
          const iconEl = doc.createElement("i");
          iconEl.classList.add("bi");
          iconEl.classList.add(`bi-${item.icon}`);

          olEl.appendChild(maybeLink(liEl, iconEl));
        }
      }
    }
  } else {
    const sidebarTitle = doc.querySelector(".sidebar-title a");
    if (sidebarTitle) {
      const liEl = breadCrumbEl();
      liEl.innerHTML = sidebarTitle.innerHTML;
      olEl.appendChild(liEl);
    } else {
      const sidebarTitleBare = doc.querySelector(".sidebar-title");
      if (sidebarTitleBare) {
        const liEl = breadCrumbEl();
        liEl.innerHTML = sidebarTitleBare.innerHTML;
        olEl.appendChild(liEl);
      } else {
        const title = doc.querySelector(
          "header .title .quarto-section-identifier",
        ) || doc.querySelector("header .title");

        if (title) {
          const liEl = breadCrumbEl();
          liEl.innerHTML = title.innerHTML;
          olEl.appendChild(liEl);
        }
      }
    }
  }
  return navEl;
}

async function sidebarsEjsData(project: ProjectContext, sidebars: Sidebar[]) {
  const ejsSidebars: Sidebar[] = [];
  for (let i = 0; i < sidebars.length; i++) {
    ejsSidebars.push(await sidebarEjsData(project, sidebars[i]));
  }
  return Promise.resolve(ejsSidebars);
}

async function sidebarEjsData(project: ProjectContext, sidebar: Sidebar) {
  sidebar = ld.cloneDeep(sidebar);

  // if the sidebar has a title and no id generate the id
  if (sidebar.title && !sidebar.id) {
    sidebar.id = asHtmlId(sidebar.title);
  }

  // ensure title and search are present
  sidebar.title = sidebarTitle(sidebar, project) as string | undefined;
  sidebar.logo = resolveLogo(sidebar.logo);

  const searchOpts = searchOptions(project);
  sidebar.search = sidebar.search !== undefined
    ? sidebar.search
    : searchOpts && searchOpts.location === "sidebar"
    ? searchOpts.type
    : false;

  // ensure collapse & alignment are defaulted
  sidebar[kCollapseLevel] = sidebar[kCollapseLevel] || 2;
  sidebar.aligment = sidebar.aligment || "center";

  sidebar.pinned = sidebar.pinned !== undefined ? !!sidebar.pinned : false;

  await resolveSidebarItems(project, sidebar);
  await resolveSidebarTools(project, sidebar.tools);

  return sidebar;
}

async function resolveSidebarItems(
  project: ProjectContext,
  container: { contents?: SidebarItem[] },
) {
  // no op if no contents
  if (!container.contents) {
    return;
  }

  const context = sidebarContext();

  // see if any 'auto' items need to be expanded
  container.contents = await expandAutoSidebarItems(
    project,
    container.contents || [],
  );
  const items = container.contents;

  for (let i = 0; i < items.length; i++) {
    let item = normalizeSidebarItem(project.dir, items[i], context);

    if (Object.keys(item).includes("contents")) {
      const subItems = item.contents || [];

      // If this item has an href, resolve that
      if (item.href) {
        item = await resolveItem(project, item.href, item, true);
      }

      // Resolve any subitems
      for (let i = 0; i < subItems.length; i++) {
        subItems[i] = await resolveSidebarItem(
          project,
          normalizeSidebarItem(project.dir, subItems[i], context),
        );
      }

      items[i] = item;
    } else {
      items[i] = await resolveSidebarItem(
        project,
        item,
      );
    }
  }
}

async function resolveSidebarItem(
  project: ProjectContext,
  item: SidebarItem,
) {
  if (item.href) {
    item = await resolveItem(
      project,
      item.href,
      item,
      true,
    );
  }

  if (item.contents !== undefined) {
    await resolveSidebarItems(project, item);
    return item;
  } else {
    return item;
  }
}

async function resolveSidebarTools(
  project: ProjectContext,
  tools: SidebarTool[],
) {
  if (tools) {
    for (let i = 0; i < tools.length; i++) {
      if (Object.keys(tools[i]).includes("menu")) {
        const items = tools[i].menu || [];
        for (let i = 0; i < items.length; i++) {
          const toolItem = await navigationItem(project, items[i], 1);
          if (typeof toolItem === "object" && toolItem.href) {
            const tool = await resolveItem(
              project,
              toolItem.href,
              toolItem,
            );
            validateTool(tool);
            items[i] = tool;
          }
        }
      } else {
        const toolItem = tools[i];
        resolveHrefAttribute(toolItem);
        if (toolItem.href) {
          tools[i] = await resolveItem(
            project,
            toolItem.href,
            toolItem,
          );
          validateTool(tools[i]);
        }
      }
    }
  }
}

function validateTool(tool: SidebarTool) {
  if (tool.icon === undefined && tool.text === undefined) {
    warning("A sidebar tool is defined without text or an icon.");
  }
}

function sidebarStyle() {
  if (navigation.sidebars.length > 0) {
    return navigation.sidebars[0].style;
  } else {
    return undefined;
  }
}

function expandedSidebar(href: string, sidebar?: Sidebar): Sidebar | undefined {
  if (sidebar) {
    // Walk through menu and mark any items as 'expanded' if they
    // contain the item with this href
    const resolveExpandedItems = (href: string, items: SidebarItem[]) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        item.active = itemHasNavTarget(item, href);
        if (Object.keys(item).includes("contents")) {
          if (
            resolveExpandedItems(href, item.contents || []) ||
            item.href === href
          ) {
            item.expanded = true;
            return true;
          }
        } else if (item.active) {
          return true;
        }
      }
      return false;
    };

    // Copy and return the sidebar with expanded marked
    const expandedSidebar = ld.cloneDeep(sidebar);
    resolveExpandedItems(href, expandedSidebar.contents);
    return expandedSidebar;
  }
}

function isSeparator(item?: SidebarItem) {
  return !!item && !!item.text?.match(/^\-\-\-[\-\s]*$/);
}

function nextAndPrevious(
  href: string,
  sidebar?: Sidebar,
): NavigationPagination {
  if (sidebar?.contents) {
    const sidebarItems = flattenItems(
      sidebar?.contents,
      (item: SidebarItem) => {
        // Only include items that have a link that isn't external
        return item.href !== undefined && !isExternalPath(item.href) ||
          isSeparator(item);
      },
    );

    // Don't allow the same href to appear in the flattened list multiple times
    const sidebarItemsUniq = ld.uniqBy(
      sidebarItems,
      (sidebarItem: SidebarItem) => {
        return sidebarItem.href || Math.random().toString();
      },
    );

    const index = sidebarItemsUniq.findIndex((item) => item.href === href);
    const nextPage = index > -1 && index < sidebarItemsUniq.length - 1 &&
        !isSeparator(sidebarItemsUniq[index + 1])
      ? sidebarItemsUniq[index + 1]
      : undefined;
    const prevPage = index > -1 && index <= sidebarItemsUniq.length - 1 &&
        !isSeparator(sidebarItemsUniq[index - 1])
      ? sidebarItemsUniq[index - 1]
      : undefined;

    return {
      nextPage,
      prevPage,
    };
  } else {
    return {};
  }
}

async function navbarEjsData(
  project: ProjectContext,
  navbar: Navbar,
): Promise<Navbar> {
  const collapse = navbar.collapse !== undefined ? !!navbar.collapse : true;

  const searchOpts = searchOptions(project);
  const data: Navbar = {
    ...navbar,
    search: searchOpts && searchOpts.location === "navbar"
      ? searchOpts.type
      : false,
    background: navbar.background || "primary",
    logo: resolveLogo(navbar.logo),
    [kLogoAlt]: navbar[kLogoAlt],
    [kLogoHref]: navbar[kLogoHref],
    collapse,
    [kCollapseBelow]: !collapse
      ? ""
      : ("-" + (navbar[kCollapseBelow] || "lg")) as LayoutBreak,
    pinned: navbar.pinned !== undefined ? !!navbar.pinned : false,
  };

  // if there is no navbar title and it hasn't been set to 'false'
  // then use the site title
  if (!data.title && data.title !== false) {
    data.title = websiteTitle(project.config);
  }
  data.title = data.title || "";

  // normalize nav contents
  const sidebarMenus = navbar[kSidebarMenus] !== false;
  if (navbar.left) {
    if (!Array.isArray(navbar.left)) {
      throw new Error("navbar 'left' must be an array of nav items");
    }
    data.left = new Array<NavItem>();
    for (let i = 0; i < navbar.left.length; i++) {
      data.left.push(
        await navigationItem(project, navbar.left[i], 0, sidebarMenus),
      );
    }
  }
  if (navbar.right) {
    if (!Array.isArray(navbar.right)) {
      throw new Error("navbar 'right' must be an array of nav items");
    }
    data.right = new Array<NavItem>();
    for (let i = 0; i < navbar.right.length; i++) {
      data.right.push(
        await navigationItem(project, navbar.right[i], 0, sidebarMenus),
      );
    }
  }

  if (navbar.tools) {
    await resolveSidebarTools(
      project,
      navbar.tools,
    );

    data.tools = navbar.tools;
  }

  return data;
}

function resolveIcon(navItem: NavigationItemObject) {
  // resolve icon
  navItem.icon = navItem.icon
    ? !navItem.icon.startsWith("bi-") ? `bi-${navItem.icon}` : navItem.icon
    : navItem.icon;
}

function resolveSidebarRef(navItem: NavigationItemObject) {
  // see if this is a sidebar link
  const ref = navItem.href || navItem.text;
  if (ref) {
    const id = sidebarTargetId(ref);
    if (id) {
      const sidebar = navigation.sidebars.find(sidebarHasId(id));
      if (sidebar) {
        // wipe out the href and replace with a menu
        navItem.href = undefined;
        navItem.text = sidebar.title || id;
        navItem.menu = new Array<NavItem>();
        for (const item of sidebar.contents) {
          // not fully recursive, we only take the first level of the sidebar
          if (item.text && item.contents) {
            if (navItem.menu.length > 0) {
              navItem.menu.push({
                text: "---",
              });
            }
            navItem.menu.push({
              text: item.text,
            });
            for (const subItem of item.contents) {
              // if this is turn has contents then target the first sub-item of those
              const targetItem = subItem.contents?.length
                ? !subItem.contents[0].contents
                  ? subItem.contents[0]
                  : undefined
                : subItem;
              if (targetItem?.href) {
                navItem.menu.push({
                  text: subItem.text,
                  href: targetItem.href,
                });
              }
            }
          } else if (item.href) {
            navItem.menu.push({
              text: item.text,
              href: item.href,
            });
          }
        }
      }
    }
  }
}

export async function navigationItem(
  project: ProjectContext,
  navItem: NavItem,
  level = 0,
  sidebarMenus = false,
): Promise<NavItem> {
  // make a copy we can mutate
  navItem = ld.cloneDeep(navItem);

  // allow short form syntax
  if (typeof navItem === "string") {
    const navItemPath = join(project.dir, navItem);
    if (safeExistsSync(navItemPath) && Deno.statSync(navItemPath).isFile) {
      navItem = { href: navItem };
    } else {
      navItem = { text: navItem };
    }
  }

  resolveIcon(navItem);

  resolveHrefAttribute(navItem);

  if (level === 0 && sidebarMenus) {
    resolveSidebarRef(navItem);
  }

  if (navItem.href) {
    return await resolveItem(project, navItem.href, navItem);
  } else if (navItem.menu) {
    // no sub-menus
    if (level > 0) {
      throw Error(
        `"${navItem.text || ""}" menu: this menu does not support sub-menus`,
      );
    }

    // recursively normalize nav items
    for (let i = 0; i < navItem.menu.length; i++) {
      navItem.menu[i] = await navigationItem(
        project,
        navItem.menu[i],
        level + 1,
        false,
      );
    }

    // provide id and ensure we have some text
    return {
      ...navItem,
      id: uniqueMenuId(navItem as NavigationItemObject),
      text: navItem.text || "",
    };
  } else {
    return navItem;
  }
}

const menuIds = new Map<string, number>();
function resetMenuIds() {
  menuIds.clear();
}
function uniqueMenuId(navItem: NavigationItemObject) {
  const id = asHtmlId(navItem.text || navItem.icon || "");
  const number = menuIds.get(id) || 0;
  menuIds.set(id, number + 1);
  return `nav-menu-${id}${number ? ("-" + number) : ""}`;
}

async function resolveItem<
  T extends { href?: string; text?: string; icon?: string },
>(
  project: ProjectContext,
  href: string,
  item: T,
  number = false,
): Promise<T> {
  if (!isExternalPath(href)) {
    const resolved = await resolveInputTarget(project, href);
    if (resolved) {
      const inputItem = {
        ...item,
        href: resolved.outputHref,
        text: item.text || resolved.title || basename(resolved.outputHref),
      };

      const projType = projectType(project.config?.project?.[kProjectType]);
      if (projType.navItemText) {
        inputItem.text = await projType.navItemText(
          project,
          href,
          inputItem.text,
          number,
        );
      }
      return inputItem;
    } else if (looksLikeShortCode(href)) {
      return item;
    } else {
      return {
        ...item,
        href: !href.startsWith("/") ? "/" + href : href,
      };
    }
  } else {
    if (!item.text && !item.icon) {
      item.text = item.href;
    }
    return item;
  }
}

function looksLikeShortCode(href: string) {
  return href.startsWith("{{<") && href.endsWith(">}}");
}

function sidebarTitle(sidebar: Sidebar, project: ProjectContext) {
  const { navbar } = websiteNavigationConfig(project);
  if (sidebar.title) {
    // Title was explicitly set
    return sidebar.title;
  } else if (!sidebar.logo) {
    if (!navbar) {
      // If there isn't a logo and there isn't a sidebar, use the project title
      return websiteTitle(project.config);
    } else {
      // The navbar will display the title
      return undefined;
    }
  } else {
    // There is a logo, just let the logo appear
    return undefined;
  }
}

function resolveLogo(logo?: string) {
  if (logo && !isExternalPath(logo) && !logo.startsWith("/")) {
    return "/" + logo;
  } else {
    return logo;
  }
}

function websiteHeadroom(project: ProjectContext) {
  const { navbar, sidebars } = websiteNavigationConfig(project);
  if (navbar || sidebars?.length) {
    const navbarPinned = navbar?.pinned === true;
    const anySidebarPinned = sidebars &&
      sidebars.some((sidebar) => sidebar.pinned === true);
    return !navbarPinned && !anySidebarPinned;
  } else {
    return false;
  }
}

const kDependencyName = "quarto-nav";
function websiteNavigationSassBundle() {
  const scssPath = navigationDependency("quarto-nav.scss").path;
  const navSassLayer = sassLayer(scssPath);
  return {
    dependency: kBootstrapDependencyName,
    key: scssPath,
    quarto: {
      ...navSassLayer,
      name: "quarto-nav.css",
    },
  };
}

function websiteNavigationDependency(project: ProjectContext) {
  const scripts = [navigationDependency("quarto-nav.js")];
  if (websiteHeadroom(project)) {
    scripts.push(navigationDependency("headroom.min.js"));
  }
  return {
    name: kDependencyName,
    scripts,
  };
}

function navigationDependency(resource: string) {
  return {
    name: basename(resource),
    path: resourcePath(`projects/website/navigation/${resource}`),
  };
}

function isExternalPath(path: string) {
  return /^\w+:/.test(path);
}

function resolveNavReferences(
  collection: unknown | Array<unknown> | Record<string, unknown>,
) {
  if (!collection) {
    return collection;
  }

  ld.forEach(
    collection,
    (
      value: unknown,
      index: unknown,
      collection: Array<unknown> | Record<string, unknown>,
    ) => {
      const assign = (value: unknown) => {
        if (typeof index === "number") {
          (collection as Array<unknown>)[index] = value;
        } else if (typeof index === "string") {
          (collection as Record<string, unknown>)[index] = value;
        }
      };
      if (Array.isArray(value)) {
        assign(resolveNavReferences(value));
      } else if (typeof value === "object") {
        assign(resolveNavReferences(value as Record<string, unknown>));
      } else if (typeof value === "string") {
        const navRef = resolveNavReference(value);
        if (navRef) {
          const navItem = collection as Record<string, unknown>;
          navItem["href"] = navRef.href;
          navItem["text"] = navRef.text;
        }
      }
    },
  );
  return collection;
}

function resolveNavReference(href: string) {
  const id = sidebarTargetId(href);
  if (id) {
    const sidebar = navigation.sidebars.find(sidebarHasId(id));
    if (sidebar && sidebar.contents?.length) {
      const item = findFirstItem(sidebar.contents[0]);
      if (item) {
        return {
          href: item.href!,
          text: sidebar.title || id,
        };
      }
    }
  }
  return undefined;
}

function sidebarTargetId(href?: string) {
  if (href) {
    const match = href.match(/^sidebar:([^\s]+).*$/);
    if (match) {
      return match[1];
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

function sidebarHasId(id: string) {
  return (sidebar: Sidebar) => {
    return sidebar.id === id;
  };
}

function findFirstItem(item: SidebarItem): SidebarItem | undefined {
  if (item.contents?.length) {
    return findFirstItem(item.contents[0]);
  } else if (item.href) {
    return item;
  } else {
    return undefined;
  }
}
