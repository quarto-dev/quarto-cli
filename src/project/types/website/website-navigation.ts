/*
* website-navigation.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { Document, Element } from "deno_dom/deno-dom-wasm.ts";

import { dirAndStem, pathWithForwardSlashes } from "../../../core/path.ts";
import { resourcePath } from "../../../core/resources.ts";
import { renderEjs } from "../../../core/ejs.ts";

import { pandocAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import { kOutputFile, kTitle, kTocTitle } from "../../../config/constants.ts";
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
  kBootstrapDependencyName,
  kPageLayout,
  kTocFloat,
} from "../../../format/format-html.ts";

import { ProjectContext, projectOffset } from "../../project-context.ts";
import { inputTargetIndex } from "../../project-index.ts";

import {
  websiteSearch,
  websiteSearchDependency,
  websiteSearchSassBundle,
} from "./website-search.ts";
import { resolveResourceRefs } from "./website-resources.ts";

export const kNavbar = "nav-top";
export const kSidebar = "nav-side";

const kAriaLabel = "aria-label";
const kCollapseLevel = "collapse-level";
const kCollapseBelow = "collapse-below";

type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

interface Navigation {
  navbar?: Navbar;
  sidebars: Sidebar[];
}

interface Sidebar {
  id?: string;
  title?: string;
  subtitle?: string;
  logo?: string;
  aligment?: "left" | "right" | "center";
  background?:
    | "none"
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark"
    | "white";
  type?: "light" | "dark";
  search?: boolean | string;
  [kCollapseLevel]?: number;
  items: SidebarItem[];
  tools: SidebarTool[];
  style: "anchored" | "floating";
  pinned?: boolean;
}

interface SidebarItem {
  href?: string;
  items?: SidebarItem[];
  text?: string;
  [kAriaLabel]?: string;
  expanded?: boolean;
  active?: boolean;
}

interface SidebarTool {
  icon: string;
  text?: string;
  href?: string;
  items?: SidebarToolItem[];
}

interface SidebarToolItem {
  icon: string;
  text?: string;
  href?: string;
}

interface Navbar {
  title?: string;
  logo?: string;
  type?: "dark" | "light";
  background:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark";
  search?: boolean | string;
  left?: NavbarItem[];
  right?: NavbarItem[];
  collapse?: boolean;
  pinned?: boolean;
  [kCollapseBelow]?: LayoutBreak;
}

interface NavbarItem {
  id?: string;
  text?: string;
  href?: string;
  icon?: string;
  [kAriaLabel]?: string;
  menu?: NavbarItem[];
}

// static navigation (initialized during project preRender)
const navigation: Navigation = {
  sidebars: [],
};

export async function initWebsiteNavigation(project: ProjectContext) {
  // read config
  const { navbar, sidebars } = websiteNavigationConfig(project);
  if (!navbar && !sidebars) {
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
}

export function websiteNavigationConfig(project: ProjectContext) {
  // read navbar
  let navbar = project.metadata?.[kNavbar] as Navbar | undefined;
  if (typeof (navbar) !== "object") {
    navbar = undefined;
  }

  // read sidebar
  const sidebar = project.metadata?.[kSidebar];
  const sidebars =
    (Array.isArray(sidebar)
      ? sidebar
      : typeof (sidebar) == "object"
      ? [sidebar]
      : undefined) as Sidebar[] | undefined;

  // return
  return { navbar, sidebars };
}

export function websiteNavigationExtras(
  project: ProjectContext,
  input: string,
  flags: PandocFlags,
  format: Format,
): FormatExtras {
  // find the href and offset for this input
  const inputRelative = relative(project.dir, input);
  const offset = projectOffset(project, input);

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
  const nav = {
    toc: hasTableOfContents(flags, format),
    layout: format.metadata[kPageLayout] !== "none",
    navbar: navigation.navbar,
    sidebar: expandedSidebar(href, sidebarForHref(href)),
  };
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

    [kSassBundles]: sassBundles,
    [kDependencies]: dependencies,
    [kBodyEnvelope]: bodyEnvelope,
    [kHtmlPostprocessors]: [navigationHtmlPostprocessor(href, offset)],
  };
}

function navigationHtmlPostprocessor(href: string, offset: string) {
  return (doc: Document) => {
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

    // resolve resource refs
    return resolveResourceRefs(doc, offset);
  };
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
  sidebar.title = sidebarTitle(sidebar, project);
  sidebar.logo = resolveLogo(sidebar.logo);
  sidebar.search = websiteSearch(project) === "sidebar"
    ? sidebar.search
    : false;

  // ensure collapse & alignment are defaulted
  sidebar[kCollapseLevel] = sidebar[kCollapseLevel] || 2;
  sidebar.aligment = sidebar.aligment || "center";

  sidebar.pinned = sidebar.pinned !== undefined ? !!sidebar.pinned : false;

  await resolveSidebarItems(project, sidebar.items);
  await resolveSidebarTools(project, sidebar.tools);

  return sidebar;
}

async function resolveSidebarItems(
  project: ProjectContext,
  items: SidebarItem[],
) {
  for (let i = 0; i < items.length; i++) {
    if (Object.keys(items[i]).includes("items")) {
      const subItems = items[i].items || [];
      for (let i = 0; i < subItems.length; i++) {
        subItems[i] = await resolveSidebarItem(project, subItems[i]);
      }
    } else {
      items[i] = await resolveSidebarItem(
        project,
        items[i] as SidebarItem,
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
  } else if (item.items) {
    await resolveSidebarItems(project, item.items);
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
      if (Object.keys(tools[i]).includes("items")) {
        const items = tools[i].items || [];
        for (let i = 0; i < items.length; i++) {
          const toolItem = items[i];
          if (toolItem.href) {
            items[i] = await resolveItem(
              project,
              toolItem.href,
              toolItem,
            ) as SidebarTool;
          }
        }
      } else {
        const toolItem = tools[i];
        if (toolItem.href) {
          tools[i] = await resolveItem(
            project,
            toolItem.href,
            toolItem,
          ) as SidebarTool;
        }
      }
    }
  }
}

function sidebarForHref(href: string) {
  // if there is a single sidebar then it applies to all hrefs
  if (navigation.sidebars.length === 1) {
    return navigation.sidebars[0];
  } else {
    for (const sidebar of navigation.sidebars) {
      if (containsHref(href, sidebar.items)) {
        return sidebar;
      }
    }
  }
}

function containsHref(href: string, items: SidebarItem[]) {
  for (let i = 0; i < items.length; i++) {
    if (Object.keys(items[i]).includes("items")) {
      const subItems = items[i].items || [];
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
    // Walk through items and mark any items as 'expanded' if they
    // contain the item with this href
    const resolveExpandedItems = (href: string, items: SidebarItem[]) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (Object.keys(item).includes("items")) {
          if (resolveExpandedItems(href, item.items || [])) {
            item.expanded = true;
            return true;
          }
        } else if (item.href === href) {
          item.active = true;
          return true;
        }
      }
      return false;
    };

    // Copy and return the sidebar with expanded marked
    const expandedSidebar = ld.cloneDeep(sidebar);
    resolveExpandedItems(href, expandedSidebar.items);
    return expandedSidebar;
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
      : project.metadata?.project?.title || "",
    search: websiteSearch(project) === "navbar" ? navbar.search : false,
    type: navbar.type || "dark",
    background: navbar.background || "primary",
    logo: resolveLogo(navbar.logo),
    collapse,
    [kCollapseBelow]: !collapse ? ""
    : ("-" + (navbar[kCollapseBelow] || "lg")) as LayoutBreak,
    pinned: navbar.pinned !== undefined ? !!navbar.pinned : false,
  };

  // normalize nav items
  if (navbar.left) {
    if (!Array.isArray(navbar.left)) {
      throw new Error("navbar 'left' must be an array of menu items");
    }
    data.left = new Array<NavbarItem>();
    for (let i = 0; i < navbar.left.length; i++) {
      data.left.push(await navigationItem(project, navbar.left[i]));
    }
  }
  if (navbar.right) {
    if (!Array.isArray(navbar.right)) {
      throw new Error("navbar 'right' must be an array of menu items");
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

  // resolve icon
  navItem.icon = navItem.icon
    ? !navItem.icon.startsWith("bi-") ? `bi-${navItem.icon}` : navItem.icon
    : navItem.icon;

  if (navItem.href) {
    return await resolveItem(project, navItem.href, navItem);
  } else if (navItem.menu) {
    // no sub-menus
    if (level > 0) {
      throw Error(
        `"${navItem.text || ""}" menu: navbar menus do not support sub-menus`,
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
    const index = await inputTargetIndex(project, href);
    if (index) {
      const format = Object.values(index.formats)[0];
      const [hrefDir, hrefStem] = dirAndStem(href);
      const outputFile = format?.pandoc[kOutputFile] || `${hrefStem}.html`;
      const htmlHref = pathWithForwardSlashes(
        "/" + join(hrefDir, outputFile),
      );
      const title = format.metadata?.[kTitle] as string ||
        ((hrefDir === "." && hrefStem === "index")
          ? project.metadata?.project?.title
          : undefined);

      return {
        ...item,
        href: htmlHref,
        text: item.text || title,
      };
    } else {
      return {
        ...item,
        href: "/" + href,
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
      return project.metadata?.project?.title;
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
    name: "quarto-nav.css",
    variables: "",
    declarations: "",
    rules: Deno.readTextFileSync(scssPath),
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
  const match = href.match(/^nav:([^\s]+).*$/);
  if (match) {
    const id = match[1];
    const sidebar = navigation.sidebars.find((sidebar) => sidebar.id === id);
    if (sidebar && sidebar.items?.length) {
      const item = findFirstItem(sidebar.items[0]);
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
  if (item.items?.length) {
    return findFirstItem(item.items[0]);
  } else if (item.href) {
    return item;
  } else {
    return undefined;
  }
}
