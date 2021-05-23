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

import {
  dirAndStem,
  pathWithForwardSlashes,
  safeExistsSync,
} from "../../../core/path.ts";
import { resourcePath } from "../../../core/resources.ts";
import { renderEjs } from "../../../core/ejs.ts";
import { warnOnce } from "../../../core/log.ts";

import { pandocAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import { kTocTitle } from "../../../config/constants.ts";
import {
  Format,
  FormatDependency,
  FormatExtras,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  SassBundle,
} from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";
import {
  hasTableOfContents,
  hasTableOfContentsTitle,
  kTocFloat,
} from "../../../config/toc.ts";

import {
  kBootstrapDependencyName,
  kPageLayout,
} from "../../../format/html/format-html.ts";

import {
  kProjectType,
  ProjectConfig,
  ProjectContext,
  projectOffset,
  projectOutputDir,
} from "../../project-context.ts";
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
import { resolveResourceRefs } from "./website-resources.ts";

import {
  isGithubRepoUrl,
  kSite,
  kSiteFooter,
  kSiteNavbar,
  kSitePageNavigation,
  kSiteRepoActions,
  kSiteRepoUrl,
  kSiteSidebar,
  websiteConfig,
  websiteConfigActions,
  websiteRepoBranch,
  websiteRepoUrl,
  websiteTitle,
} from "./website-config.ts";

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

export function websiteNavigationConfig(project: ProjectContext) {
  // read navbar
  let navbar = websiteConfig(kSiteNavbar, project.config) as Navbar | undefined;
  if (typeof (navbar) !== "object") {
    navbar = undefined;
  }

  // read sidebar
  const sidebar = websiteConfig(kSiteSidebar, project.config);
  const sidebars =
    (Array.isArray(sidebar)
      ? sidebar
      : typeof (sidebar) == "object"
      ? [sidebar]
      : undefined) as Sidebar[] | undefined;

  // read the page navigation
  const pageNavigation = !!websiteConfig(kSitePageNavigation, project.config);

  // read any footer
  const footer = websiteConfig(kSiteFooter, project.config);

  // return
  return { navbar, sidebars, pageNavigation, footer };
}

export function websiteNavigationExtras(
  project: ProjectContext,
  input: string,
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  // find the relative path for this input
  const inputRelative = relative(project.dir, input);

  // determine dependencies (always include baseline nav dependency)
  const dependencies: FormatDependency[] = [
    websiteNavigationDependency(project),
  ];

  // Determine any sass bundles
  const sassBundles: SassBundle[] = [websiteNavigationSassBundle()];

  const searchDep = websiteSearchDependency(project, input);
  if (searchDep) {
    dependencies.push(searchDep);
    sassBundles.push(websiteSearchSassBundle());
  }

  // determine body envelope
  const href = inputFileHref(inputRelative);
  const sidebar = sidebarForHref(href);
  const nav: Record<string, unknown> = {
    toc: hasTableOfContents(flags, format),
    layout: format.metadata[kPageLayout] !== "none",
    navbar: navigation.navbar,
    sidebar: expandedSidebar(href, sidebar),
  };

  // Determine the previous and next page
  if (navigation.pageNavigation) {
    const pageNavigation = nextAndPrevious(href, sidebar);
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
      [kHtmlPostprocessors]: [navigationHtmlPostprocessor(project, input)],
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
      const resolved = await resolveInputTarget(project, firstInputHref);
      if (resolved) {
        const redirectTemplate = resourcePath(
          "projects/website/templates/redirect.ejs",
        );
        const redirectHtml = renderEjs(redirectTemplate, {
          url: resolved.outputHref,
        });
        Deno.writeTextFileSync(indexPage, redirectHtml);
      }
    }
  }
}

function navigationHtmlPostprocessor(project: ProjectContext, input: string) {
  const inputRelative = relative(project.dir, input);
  const offset = projectOffset(project, input);
  const href = inputFileHref(inputRelative);

  return async (doc: Document) => {
    // latch active nav link
    const navLinks = doc.querySelectorAll("a.nav-link");
    for (let i = 0; i < navLinks.length; i++) {
      const navLink = navLinks[i] as Element;
      const navLinkHref = navLink.getAttribute("href");

      const sidebarLink = doc.querySelector(
        '.sidebar-navigation a[href="' + href + '"]',
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
    const title = doc.querySelector("header > .title");
    const sidebar = doc.getElementById("quarto-sidebar");
    if (title && sidebar) {
      // hide below lg
      title.classList.add("d-none");
      title.classList.add("d-lg-block");

      // Add the title to the secondary nav bar
      const secondaryNavTitle = doc.querySelector(
        ".quarto-secondary-nav .quarto-secondary-nav-title",
      );
      if (secondaryNavTitle) {
        secondaryNavTitle.innerHTML = title.innerHTML;
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
          : join(dirname(inputRelative), href);
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

    // append repo actions to toc
    addRepoActions(doc, inputRelative, project.config);

    // resolve resource refs
    return Promise.resolve(resolveResourceRefs(doc, offset));
  };
}

function addRepoActions(doc: Document, input: string, config?: ProjectConfig) {
  const repoActions = websiteConfigActions(
    kSiteRepoActions,
    kSite,
    config,
  );
  if (repoActions.length > 0) {
    const repoUrl = websiteRepoUrl(config);
    if (repoUrl) {
      if (isGithubRepoUrl(repoUrl)) {
        // find the toc
        const toc = doc.querySelector(`nav[role="doc-toc"]`);
        if (toc) {
          // get the action links
          const links = repoActionLinks(
            repoActions,
            repoUrl,
            websiteRepoBranch(config),
            input,
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
      } else {
        warnOnce(`${kSiteRepoActions} requires a github.com ${kSiteRepoUrl}`);
      }
    } else {
      warnOnce(
        `${kSiteRepoActions} requires that you also specify a ${kSiteRepoUrl}`,
      );
    }
  }
}

function repoActionLinks(
  actions: string[],
  repoUrl: string,
  branch: string,
  input: string,
): Array<{ text: string; url: string }> {
  return actions.map((action) => {
    switch (action) {
      case "edit":
        return {
          text: "Edit this page",
          url: `${repoUrl}edit/${branch}/${input}`,
        };
      case "source":
        return {
          text: "View source",
          url: `${repoUrl}blob/${branch}/${input}`,
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
    sidebar.id = pandocAutoIdentifier(sidebar.title, false);
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
    return await resolveItem(
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

function nextAndPrevious(
  href: string,
  sidebar?: Sidebar,
): { prevPage?: SidebarItem; nextPage?: SidebarItem } {
  if (sidebar?.contents) {
    const sidebarItems = flattenItems(
      sidebar?.contents,
      (item: SidebarItem) => {
        // Only include items that have a link that isn't external
        return item.href !== undefined && !isExternalPath(item.href);
      },
    );
    const index = sidebarItems.findIndex((item) => item.href === href);
    return {
      nextPage: index > -1 && index < sidebarItems.length - 1
        ? sidebarItems[index + 1]
        : undefined,
      prevPage: index > 0 && index < sidebarItems.length
        ? sidebarItems[index - 1]
        : undefined,
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
    title: navbar.title !== undefined
      ? navbar.title
      : websiteTitle(project.config) || "",
    search: websiteSearch(project) === "navbar" ? navbar.search : false,
    type: navbar.type || "dark",
    background: navbar.background || "primary",
    logo: resolveLogo(navbar.logo),
    collapse,
    [kCollapseBelow]: !collapse ? ""
    : ("-" + (navbar[kCollapseBelow] || "lg")) as LayoutBreak,
    pinned: navbar.pinned !== undefined ? !!navbar.pinned : false,
  };

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
    if (safeExistsSync(join(project.dir, navItem))) {
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

    // text or icon is required
    if (!navItem.text && !navItem.icon) {
      throw Error(
        `"${navItem.text ||
          ""}" menu: you must specify a 'text' or 'icon' option for menus`,
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
  const id = pandocAutoIdentifier(navItem.text || navItem.icon || "", false);
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

function inputFileHref(href: string) {
  const [hrefDir, hrefStem] = dirAndStem(href);
  const htmlHref = "/" + join(hrefDir, `${hrefStem}.html`);
  return pathWithForwardSlashes(htmlHref);
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
      } else if (index === "href" && typeof (value) === "string") {
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
