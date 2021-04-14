/*
* project-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { safeExistsSync } from "../core/path.ts";
import { ProjectContext } from "./project-context.ts";

export const kAriaLabel = "aria-label";
export const kCollapseLevel = "collapse-level";
export const kCollapseBelow = "collapse-below";

export type LayoutBreak = "" | "sm" | "md" | "lg" | "xl" | "xxl";

export interface Navbar {
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

export interface NavbarItem {
  id?: string;
  text?: string;
  href?: string;
  icon?: string;
  [kAriaLabel]?: string;
  menu?: NavbarItem[];
}

export interface Sidebar {
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
  contents: SidebarItem[];
  tools: SidebarTool[];
  style: "anchored" | "floating";
  pinned?: boolean;
}

export interface SidebarItem {
  href?: string;
  text?: string;
  section?: string;
  contents?: SidebarItem[];
  [kAriaLabel]?: string;
  expanded?: boolean;
  active?: boolean;
}

export interface SidebarTool {
  icon: string;
  text?: string;
  href?: string;
  menu?: NavbarItem[];
}

export function normalizeSidebarItem(
  project: ProjectContext,
  item: SidebarItem,
): SidebarItem {
  // clone so we can mutate
  item = ld.cloneDeep(item);

  if (typeof (item) === "string") {
    if (safeExistsSync(join(project.dir, item))) {
      return {
        href: item,
      };
    } else {
      return {
        text: item,
      };
    }
  } else {
    // section is a special key that can provide either text or href
    // for an item with 'contents'
    if (item.section) {
      if (safeExistsSync(join(project.dir, item.section))) {
        item.href = item.section;
      } else {
        item.text = item.section;
      }
      delete item.section;
    }

    // handle subitems
    if (item.contents) {
      for (let i = 0; i < item.contents.length; i++) {
        item.contents[i] = normalizeSidebarItem(project, item.contents[i]);
      }
    }

    return item;
  }
}
