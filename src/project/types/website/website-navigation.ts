/*
* website-navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";
import { ld } from "lodash/mod.ts";

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { safeExistsSync } from "../../../core/path.ts";
import { resourcePath } from "../../../core/resources.ts";
import { renderEjs } from "../../../core/ejs.ts";
import { warnOnce } from "../../../core/log.ts";
import { asHtmlId } from "../../../core/html.ts";

import {
  Format,
  FormatDependency,
  FormatExtras,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
  Metadata,
  PandocFlags,
  SassBundle,
} from "../../../config/types.ts";
import {
  hasTableOfContents,
  hasTableOfContentsTitle,
  kTocFloat,
} from "../../../config/toc.ts";

import { kBootstrapDependencyName } from "../../../format/html/format-html-shared.ts";
import {
  formatDarkMode,
  formatPageLayout,
} from "../../../format/html/format-html-bootstrap.ts";

import { kDataQuartoSourceUrl } from "../../../command/render/codetools.ts";

import { kProjectType, ProjectConfig, ProjectContext } from "../../types.ts";
import { projectOffset, projectOutputDir } from "../../project-shared.ts";
import { resolveInputTarget } from "../../project-index.ts";
import {
  kCollapseBelow,
  kCollapseLevel,
  LayoutBreak,
  Navbar,
  NavbarItem,
  normalizeSidebarItem,
  resolveHrefAttribute,
  Sidebar,
  SidebarItem,
  SidebarTool,
} from "../../project-config.ts";
import { projectType } from "../project-types.ts";

import {
  websiteSearch,
  websiteSearchDependency,
  websiteSearchSassBundle,
} from "./website-search.ts";

import {
  isGithubRepoUrl,
  kSite,
  kSiteNavbar,
  kSiteRepoActions,
  kSiteRepoUrl,
  kSiteSidebar,
  websiteConfigActions,
  websiteRepoBranch,
  websiteRepoUrl,
  websiteTitle,
} from "./website-config.ts";
import { inputFileHref, websiteNavigationConfig } from "./website-shared.ts";
import { kTitle, kTocTitle } from "../../../config/constants.ts";

interface Navigation {
  navbar?: Navbar;
  sidebars: Sidebar[];
  pageNavigation?: boolean;
  footer?: string;
}

// static navigation (initialized during project preRender)
const navigation: Navigation = {
  sidebars: [],
};

export const kSidebarLogo = "logo";

export async function initWebsiteNavigation(project: ProjectContext) {
  // read config
  const { navbar, sidebars, pageNavigation, footer } = websiteNavigationConfig(
    project,
  );
  if (!navbar && !sidebars && !pageNavigation) {
    return;
  }

  // navbar
  if (navbar) {
    navigation.navbar = await navbarEjsData(project, navbar);
  } else {
    navigation.navbar = undefined;
  }

  // sidebars
  if (sidebars) {
    navigation.sidebars = await sidebarsEjsData(project, sidebars);
  } else {
    navigation.sidebars = [];
  }

  // resolve nav references
  navigation.navbar = resolveNavReferences(navigation.navbar) as Navbar;
  navigation.sidebars = resolveNavReferences(navigation.sidebars) as Sidebar[];
  navigation.pageNavigation = pageNavigation;
  navigation.footer = footer as string;
}

export async function websiteNavigationExtras(
  project: ProjectContext,
  source: string,
  flags: PandocFlags,
  format: Format,
): Promise<FormatExtras> {
  // find the relative path for this input
  const inputRelative = relative(project.dir, source);

  // determine dependencies (always include baseline nav dependency)
  const dependencies: FormatDependency[] = [
    websiteNavigationDependency(project),
  ];

  // Determine any sass bundles
  const sassBundles: SassBundle[] = [websiteNavigationSassBundle()];

  const searchDep = websiteSearchDependency(project, source);
  if (searchDep) {
    dependencies.push(searchDep);
    sassBundles.push(websiteSearchSassBundle());
  }

  // Check to see whether the navbar or sidebar have been disabled on this page
  const disableNavbar = format.metadata[kSiteNavbar] !== undefined &&
    format.metadata[kSiteNavbar] === false;
  const disableSidebar = format.metadata[kSiteSidebar] !== undefined &&
    format.metadata[kSiteSidebar] === false;

  // determine body envelope
  const target = await resolveInputTarget(project, inputRelative);
  const href = target?.outputHref || inputFileHref(inputRelative);
  const sidebar = sidebarForHref(href);
  const nav: Record<string, unknown> = {
    toc: hasTableOfContents(flags, format),
    layout: formatPageLayout(format),
    navbar: disableNavbar ? undefined : navigation.navbar,
    sidebar: disableSidebar ? undefined : expandedSidebar(href, sidebar),
  };

  // Determine the previous and next page
  const pageNavigation = nextAndPrevious(href, sidebar);
  if (navigation.pageNavigation) {
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

  const projTemplate = (template: string) =>
    resourcePath(`projects/website/templates/${template}`);
  const bodyEnvelope = {
    before: renderEjs(projTemplate("nav-before-body.ejs"), { nav }),
    after: renderEjs(projTemplate("nav-after-body.ejs"), { nav }),
  };

  // return extras with bodyEnvelope
  return {
    [kTocTitle]: !hasTableOfContentsTitle(flags, format) &&
        format.metadata[kTocFloat] !== false
      ? "On this page"
      : undefined,
    html: {
      [kSassBundles]: sassBundles,
      [kDependencies]: dependencies,
      [kBodyEnvelope]: bodyEnvelope,
      [kHtmlPostprocessors]: [
        navigationHtmlPostprocessor(project, source),
      ],
      [kMarkdownAfterBody]: [
        createMarkdownEnvelope(format, navigation, pageNavigation, sidebar),
      ],
    },
  };
}

const kPageTitleId = "quarto-int-page-title";
const kSidebarTitleId = "quarto-int-sidebar-title";
const kNavbarTitleId = "quarto-int-navbar-title";
const kNavNextId = "quarto-int-next";
const kNavPrevId = "quarto-int-prev";
const kSidebarIdPrefix = "quarto-int-sidebar:";
const kNavbarIdPrefix = "quarto-int-navbar:";

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
  source: string,
) {
  const sourceRelative = relative(project.dir, source);
  const offset = projectOffset(project, source);
  const href = inputFileHref(sourceRelative);

  return async (doc: Document) => {
    // Process any markdown rendered through the render envelope
    processMarkdownEnvelope(doc);

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

    // Hide the title when it will appear in the secondary nav
    // Try to read into the container span, or just take any contents
    const title = doc.querySelector(
      "header .title .quarto-section-identifier",
    ) || doc.querySelector("header .title");

    const sidebar = doc.getElementById("quarto-sidebar");
    if (sidebar) {
      // hide below lg
      if (title) {
        title.classList.add("d-none");
        title.classList.add("d-lg-block");
      }

      // Add the title to the secondary nav bar
      const secondaryNavTitle = doc.querySelector(
        ".quarto-secondary-nav .quarto-secondary-nav-title",
      );

      if (secondaryNavTitle) {
        if (title) {
          secondaryNavTitle.innerHTML = title.innerHTML;
        } else {
          secondaryNavTitle.innerHTML = "(Untitled)";
        }
        // hide the entire title block (encompassing code button) if we have it
        const titleBlock = doc.querySelector("header > .quarto-title-block");
        if (titleBlock) {
          // hide below lg
          titleBlock.classList.add("d-none");
          titleBlock.classList.add("d-lg-block");
        }
      }
    }

    // resolve links to input (src) files
    const links = doc.querySelectorAll("a[href]");
    for (let i = 0; i < links.length; i++) {
      const link = links[i] as Element;
      const href = link.getAttribute("href");
      if (href && !isExternalPath(href)) {
        let projRelativeHref = href.startsWith("/")
          ? href.slice(1)
          : join(dirname(sourceRelative), href);
        const hashLoc = projRelativeHref.indexOf("#");
        const hash = hashLoc !== -1 ? projRelativeHref.slice(hashLoc) : "";
        if (hash) {
          projRelativeHref = projRelativeHref.slice(0, hashLoc);
        }
        const resolved = await resolveInputTarget(project, projRelativeHref);
        if (resolved) {
          link.setAttribute("href", offset + resolved.outputHref + hash);
        }
      }
    }

    // handle repo links
    handleRepoLinks(doc, sourceRelative, project.config);

    return Promise.resolve([]);
  };
}

function handleRepoLinks(
  doc: Document,
  source: string,
  config?: ProjectConfig,
) {
  const repoActions = websiteConfigActions(
    kSiteRepoActions,
    kSite,
    config,
  );

  const elRepoSource = doc.querySelector(
    "[" + kDataQuartoSourceUrl + '="repo"]',
  );

  if (repoActions.length > 0 || elRepoSource) {
    const repoUrl = websiteRepoUrl(config);
    if (repoUrl) {
      if (isGithubRepoUrl(repoUrl)) {
        if (repoActions.length > 0) {
          // find the toc
          const toc = doc.querySelector(`nav[role="doc-toc"]`);
          if (toc) {
            // get the action links
            const links = repoActionLinks(
              repoActions,
              repoUrl,
              websiteRepoBranch(config),
              source,
            );
            const actionsDiv = doc.createElement("div");
            actionsDiv.classList.add("toc-actions");
            const iconDiv = doc.createElement("div");
            const iconEl = doc.createElement("i");
            iconEl.classList.add("bi").add("bi-github");
            iconDiv.appendChild(iconEl);
            actionsDiv.appendChild(iconDiv);
            const linksDiv = doc.createElement("div");
            linksDiv.classList.add("action-links");
            links.forEach((link) => {
              const a = doc.createElement("a");
              a.setAttribute("href", link.url);
              a.innerHTML = link.text;
              const p = doc.createElement("p");
              p.appendChild(a);
              linksDiv.appendChild(p);
            });
            actionsDiv.appendChild(linksDiv);
            toc.appendChild(actionsDiv);
          }
        }
        if (elRepoSource) {
          elRepoSource.setAttribute(
            kDataQuartoSourceUrl,
            `${repoUrl}blob/${websiteRepoBranch(config)}/${source}`,
          );
        }
      } else {
        warnOnce(`Repository links require a github.com ${kSiteRepoUrl}`);
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
  repoUrl: string,
  branch: string,
  source: string,
): Array<{ text: string; url: string }> {
  return actions.map((action) => {
    switch (action) {
      case "edit":
        return {
          text: "Edit this page",
          url: `${repoUrl}edit/${branch}/${source}`,
        };
      case "source":
        return {
          text: "View source",
          url: `${repoUrl}blob/${branch}/${source}`,
        };
      case "issue":
        return {
          text: "Report an issue",
          url: `${repoUrl}issues/new`,
        };

      default: {
        warnOnce(`Unknown repo action '${action}'`);
        return null;
      }
    }
  }).filter((action) => action !== null) as Array<
    { text: string; url: string }
  >;
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
  sidebar.search = websiteSearch(project) === "sidebar"
    ? sidebar.search
    : false;

  // ensure collapse & alignment are defaulted
  sidebar[kCollapseLevel] = sidebar[kCollapseLevel] || 2;
  sidebar.aligment = sidebar.aligment || "center";

  sidebar.pinned = sidebar.pinned !== undefined ? !!sidebar.pinned : false;

  await resolveSidebarItems(project, sidebar.contents);
  await resolveSidebarTools(project, sidebar.tools);

  return sidebar;
}

async function resolveSidebarItems(
  project: ProjectContext,
  items: SidebarItem[],
) {
  for (let i = 0; i < items.length; i++) {
    let item = normalizeSidebarItem(project.dir, items[i]);

    if (Object.keys(item).includes("contents")) {
      const subItems = item.contents || [];

      // If this item has an href, resolve that
      if (item.href) {
        item = await resolveItem(project, item.href, item);
      }

      // Resolve any subitems
      for (let i = 0; i < subItems.length; i++) {
        subItems[i] = await resolveSidebarItem(
          project,
          normalizeSidebarItem(project.dir, subItems[i]),
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

async function resolveSidebarItem(project: ProjectContext, item: SidebarItem) {
  if (item.href) {
    item = await resolveItem(
      project,
      item.href,
      item,
    ) as SidebarItem;
  }

  if (item.contents) {
    await resolveSidebarItems(project, item.contents);
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
          if (toolItem.href) {
            const tool = await resolveItem(
              project,
              toolItem.href,
              toolItem,
            ) as SidebarTool;
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
          ) as SidebarTool;
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

function sidebarForHref(href: string) {
  // if there is a single sidebar then it applies to all hrefs
  if (navigation.sidebars.length === 1) {
    return navigation.sidebars[0];
  } else {
    for (const sidebar of navigation.sidebars) {
      if (containsHref(href, sidebar.contents)) {
        return sidebar;
      }
    }
  }
}

function containsHref(href: string, items: SidebarItem[]) {
  for (let i = 0; i < items.length; i++) {
    if (Object.keys(items[i]).includes("contents")) {
      const subItems = items[i].contents || [];
      const subItemsHasHref = containsHref(href, subItems);
      if (subItemsHasHref) {
        return true;
      }
    } else {
      if (items[i].href === href) {
        return true;
      }
    }
  }
  return false;
}

function expandedSidebar(href: string, sidebar?: Sidebar): Sidebar | undefined {
  if (sidebar) {
    // Walk through menu and mark any items as 'expanded' if they
    // contain the item with this href
    const resolveExpandedItems = (href: string, items: SidebarItem[]) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        item.active = item.href === href;
        if (Object.keys(item).includes("contents")) {
          if (resolveExpandedItems(href, item.contents || [])) {
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

function flattenItems(
  sidebarItems: SidebarItem[],
  includeItem: (item: SidebarItem) => boolean,
) {
  const items: SidebarItem[] = [];
  const flatten = (sidebarItem: SidebarItem) => {
    if (includeItem(sidebarItem)) {
      items.push(sidebarItem);
    }
    if (sidebarItem.contents) {
      items.push(...flattenItems(sidebarItem.contents, includeItem));
    }
  };
  sidebarItems.forEach(flatten);
  return items;
}

function isSeparator(item?: SidebarItem) {
  return !!item && !!item.text?.match(/^\-\-\-[\-\s]*$/);
}

interface NextAndPrevious {
  nextPage?: SidebarItem;
  prevPage?: SidebarItem;
}

function nextAndPrevious(
  href: string,
  sidebar?: Sidebar,
): NextAndPrevious {
  if (sidebar?.contents) {
    const sidebarItems = flattenItems(
      sidebar?.contents,
      (item: SidebarItem) => {
        // Only include items that have a link that isn't external
        return item.href !== undefined && !isExternalPath(item.href) ||
          isSeparator(item);
      },
    );
    const index = sidebarItems.findIndex((item) => item.href === href);
    const nextPage = index > -1 && index < sidebarItems.length - 1 &&
        !isSeparator(sidebarItems[index + 1])
      ? sidebarItems[index + 1]
      : undefined;
    const prevPage = index > -1 && index <= sidebarItems.length - 1 &&
        !isSeparator(sidebarItems[index - 1])
      ? sidebarItems[index - 1]
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
  const data: Navbar = {
    ...navbar,
    search: websiteSearch(project) === "navbar" ? navbar.search : false,
    type: navbar.type || "dark",
    background: navbar.background || "primary",
    logo: resolveLogo(navbar.logo),
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
  if (navbar.left) {
    if (!Array.isArray(navbar.left)) {
      throw new Error("navbar 'left' must be an array of nav items");
    }
    data.left = new Array<NavbarItem>();
    for (let i = 0; i < navbar.left.length; i++) {
      data.left.push(await navigationItem(project, navbar.left[i]));
    }
  }
  if (navbar.right) {
    if (!Array.isArray(navbar.right)) {
      throw new Error("navbar 'right' must be an array of nav items");
    }
    data.right = new Array<NavbarItem>();
    for (let i = 0; i < navbar.right.length; i++) {
      data.right.push(await navigationItem(project, navbar.right[i]));
    }
  }

  return data;
}

async function navigationItem(
  project: ProjectContext,
  navItem: NavbarItem,
  level = 0,
) {
  // make a copy we can mutate
  navItem = ld.cloneDeep(navItem);

  // allow short form syntax
  if (typeof (navItem) === "string") {
    const navItemPath = join(project.dir, navItem);
    if (safeExistsSync(navItemPath) && Deno.statSync(navItemPath).isFile) {
      navItem = { href: navItem };
    } else {
      navItem = { text: navItem };
    }
  }

  // resolve icon
  navItem.icon = navItem.icon
    ? !navItem.icon.startsWith("bi-") ? `bi-${navItem.icon}` : navItem.icon
    : navItem.icon;

  resolveHrefAttribute(navItem);
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
      );
    }

    // provide id and ensure we have some text
    return {
      ...navItem,
      id: uniqueMenuId(navItem),
      text: navItem.text || "",
    };
  } else {
    return navItem;
  }
}

const menuIds = new Map<string, number>();
function uniqueMenuId(navItem: NavbarItem) {
  const id = asHtmlId(navItem.text || navItem.icon || "");
  const number = menuIds.get(id) || 0;
  menuIds.set(id, number + 1);
  return `nav-menu-${id}${number ? ("-" + number) : ""}`;
}

async function resolveItem(
  project: ProjectContext,
  href: string,
  item: { href?: string; text?: string },
): Promise<{ href?: string; text?: string }> {
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
        );
      }
      return inputItem;
    } else {
      return {
        ...item,
        href: !href.startsWith("/") ? "/" + href : href,
      };
    }
  } else {
    return item;
  }
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
  return {
    dependency: kBootstrapDependencyName,
    key: scssPath,
    quarto: {
      name: "quarto-nav.css",
      defaults: "",
      functions: "",
      mixins: "",
      rules: Deno.readTextFileSync(scssPath),
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
        if (typeof (index) === "number") {
          (collection as Array<unknown>)[index] = value;
        } else if (typeof (index) === "string") {
          (collection as Record<string, unknown>)[index] = value;
        }
      };
      if (Array.isArray(value)) {
        assign(resolveNavReferences(value));
      } else if (typeof (value) === "object") {
        assign(resolveNavReferences(value as Record<string, unknown>));
      } else if (typeof (value) === "string") {
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
  const match = href.match(/^sidebar:([^\s]+).*$/);
  if (match) {
    const id = match[1];
    const sidebar = navigation.sidebars.find((sidebar) => sidebar.id === id);
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

function findFirstItem(item: SidebarItem): SidebarItem | undefined {
  if (item.contents?.length) {
    return findFirstItem(item.contents[0]);
  } else if (item.href) {
    return item;
  } else {
    return undefined;
  }
}
interface MarkdownRenderContext {
  format: Format;
  sidebar?: Sidebar;
  navigation?: Navigation;
  nextAndPrev: NextAndPrevious;
}

interface MarkdownRenderHandler {
  getUnrendered: (context: MarkdownRenderContext) => Record<string, string>;
  processRendered: (rendered: Record<string, Element>, doc: Document) => void;
}

function title(format: Format) {
  const site = (format.metadata[kSite] as Metadata);
  if (
    site[kTitle] &&
    typeof (site[kTitle]) !== "object"
  ) {
    return String(site[kTitle]);
  } else if (
    format.metadata[kTitle] &&
    typeof (format.metadata[kTitle]) !== "object"
  ) {
    return String(format.metadata[kTitle]);
  }
}

const sidebarTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.sidebar?.title) {
      return {
        [kSidebarTitleId]: context.sidebar.title,
      };
    } else {
      const mainTitle = title(context.format);
      if (mainTitle) {
        return {
          [kSidebarTitleId]: mainTitle,
        };
      }
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kSidebarTitleId];
    if (renderedEl) {
      const sidebarTitleEl =
        doc.querySelector("#quarto-sidebar .sidebar-title a") ||
        doc.querySelector("#quarto-sidebar .sidebar-title");
      if (sidebarTitleEl && sidebarTitleEl.innerText) {
        sidebarTitleEl.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const navbarTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.navigation?.navbar?.title) {
      return { [kNavbarTitleId]: context.navigation.navbar.title };
    } else {
      const mainTitle = title(context.format);
      if (mainTitle) {
        return {
          [kNavbarTitleId]: mainTitle,
        };
      }
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kNavbarTitleId];
    if (renderedEl) {
      const navbarTitleEl = doc.querySelector(
        "#quarto-header .navbar-brand .navbar-title",
      );
      if (navbarTitleEl && navbarTitleEl.innerText) {
        navbarTitleEl.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const nextPageTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.nextAndPrev.nextPage?.text) {
      return { [kNavNextId]: context.nextAndPrev.nextPage.text };
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kNavNextId];
    if (renderedEl) {
      const el = doc.querySelector(
        `.page-navigation .nav-page-next a`,
      );
      if (el) {
        el.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const prevPageTitleHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.nextAndPrev.prevPage?.text) {
      return { [kNavPrevId]: context.nextAndPrev.prevPage.text };
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const renderedEl = rendered[kNavPrevId];
    if (renderedEl) {
      const el = doc.querySelector(
        `.page-navigation .nav-page-previous a`,
      );
      if (el) {
        el.innerHTML = renderedEl.innerHTML;
      }
    }
  },
};

const sidebarContentsHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.sidebar?.contents) {
      const sidebarItems = flattenItems(context.sidebar?.contents, (_) => {
        return true;
      });

      const markdown: Record<string, string> = {};
      sidebarItems.forEach((item) => {
        if (item.text) {
          markdown[`${kSidebarIdPrefix}${item.href || item.text}`] = item.text;
        }
      });
      return markdown;
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const sidebarItemEls = doc.querySelectorAll(
      "li.sidebar-item > a",
    );
    for (let i = 0; i < sidebarItemEls.length; i++) {
      const link = sidebarItemEls[i] as Element;
      const href = link.getAttribute("href");
      const sidebarText =
        rendered[`${kSidebarIdPrefix}${href || link.innerText}`];
      if (sidebarText) {
        link.innerHTML = sidebarText?.innerHTML;
      }
    }

    const sidebarSectionEls = doc.querySelectorAll(
      "ul.sidebar-section a.sidebar-section-item",
    );
    for (let i = 0; i < sidebarSectionEls.length; i++) {
      const link = sidebarSectionEls[i] as Element;
      const href = link.getAttribute("href");
      const div = link.querySelector("div.sidebar-section-item");

      if (div) {
        const id = href || div.innerText;
        if (id) {
          const sectionText = rendered[`${kSidebarIdPrefix}${id}`];
          if (sectionText) {
            div.innerHTML = sectionText?.innerHTML;
          }
        }
      }
    }
  },
};

const navbarContentsHandler = {
  getUnrendered(context: MarkdownRenderContext) {
    if (context.navigation?.navbar) {
      const markdown: Record<string, string> = {};
      const entries = [
        ...context.navigation.navbar.left || [],
        ...context.navigation.navbar.right || [],
      ];
      entries.forEach((entry) => {
        if (entry.text) {
          markdown[`${kNavbarIdPrefix}${entry.href || entry.text}`] =
            entry.text;
        }
      });
      return markdown;
    }
  },
  processRendered(rendered: Record<string, Element>, doc: Document) {
    const navItemEls = doc.querySelectorAll(
      ".navbar-nav .nav-item a.nav-link",
    );
    for (let i = 0; i < navItemEls.length; i++) {
      const link = navItemEls[i] as Element;
      const href = link.getAttribute("href");
      const id = href || link.innerText;
      if (id) {
        const renderedEl = rendered[`${kNavbarIdPrefix}${id}`];
        if (renderedEl) {
          link.innerHTML = renderedEl?.innerHTML;
        }
      }
    }
  },
};

const handlers = [
  sidebarTitleHandler,
  navbarTitleHandler,
  nextPageTitleHandler,
  prevPageTitleHandler,
  sidebarContentsHandler,
  navbarContentsHandler,
];

function createMarkdownEnvelope(
  format: Format,
  navigation: Navigation,
  nextAndPrev: NextAndPrevious,
  sidebar?: Sidebar,
) {
  const envelope = markdownEnvelopeWriter();
  handlers.forEach((handler) => {
    const markdownRecords: Record<string, string> | undefined = handler
      .getUnrendered({
        format,
        sidebar,
        navigation,
        nextAndPrev,
      });
    if (markdownRecords) {
      Object.keys(markdownRecords).forEach((key) => {
        envelope.add(key, markdownRecords[key]);
      });
    }
  });
  return envelope.toMarkdown();
}

function processMarkdownEnvelope(doc: Document) {
  // Reader for getting rendered elements
  const renderedMarkdown = readEnvelope(doc);
  handlers.forEach((handler) => {
    handler.processRendered(renderedMarkdown, doc);
  });
}

const kQuartoEnvelopeId = "quarto-render-envelope";
const readEnvelope = (doc: Document) => {
  const envelope = doc.getElementById(kQuartoEnvelopeId);
  const contents: Record<string, Element> = {};
  if (envelope) {
    const nodes = envelope.querySelectorAll("span[data-render-id]");
    nodes.forEach((node) => {
      const el = node as Element;
      const id = el.getAttribute("data-render-id");
      if (id) {
        contents[id] = el;
      }
    });
    envelope.remove();
  }
  return contents;
};

const markdownEnvelopeWriter = () => {
  const renderList: string[] = [];
  const hiddenSpan = (id: string, contents: string) => {
    return `[${contents}]{.hidden render-id="${id}"}`;
  };

  return {
    add: (id: string, value: string) => {
      renderList.push(hiddenSpan(id, value));
    },
    toMarkdown: () => {
      const contents = renderList.join("\n");
      return `\n:::{#${kQuartoEnvelopeId} .hidden}\n${contents}\n:::\n`;
    },
  };
};
