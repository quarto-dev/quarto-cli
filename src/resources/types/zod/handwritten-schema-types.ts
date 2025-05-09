/*
 * handwritten-schema-types.ts
 *
 * Some Zod schemas that are easier to write by hand than to generate:
 *
 *   - SidebarContents
 *   - NavigationItem
 *
 * If you need to change these, the easiest way is to generate the
 * schema-types.ts file, and then start from the commented-out,
 * slightly incorrect version of the zod schemas to edit.
 *
 * We're using the strategy illustrated in https://zod.dev/?id=recursive-types
 * to solve these recursive types.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { z } from "zod";

import { ZodContentsAuto } from "./schema-types.ts";

import { type ContentsAuto } from "./schema-types.ts";

const Base_ZodSidebarContentsObject = z.object({
  section: z.union([z.string(), z.null()]),
  /* hide the recursive declaration

  contents: z.lazy(() => ZodSidebarContents),
  */
}).strict().partial();

export type SidebarContentsObject =
  & z.infer<typeof Base_ZodSidebarContentsObject>
  & {
    contents: SidebarContents;
  };

const ZodSidebarContentsObject: z.ZodType<SidebarContentsObject> =
  Base_ZodSidebarContentsObject.extend({
    contents: z.lazy(() => ZodSidebarContents),
  });

const Base_ZodSidebarContents = z.union([
  z.string(),
  z.lazy(() => ZodContentsAuto),
  /* hide the recursive declaration

  z.array(z.union([
    z.lazy(() => ZodNavigationItem),
    z.string(),
    z.lazy(() => ZodSidebarContentsObject),
    z.lazy(() => ZodContentsAuto),
  ])),
  */
]);

export type SidebarContents =
  | z.infer<typeof Base_ZodSidebarContents>
  | (NavigationItem | string | SidebarContentsObject | ContentsAuto)[];

export const ZodSidebarContents = z.union([
  Base_ZodSidebarContents,
  z.array(z.union([
    z.lazy(() => ZodNavigationItem),
    z.string(),
    z.lazy(() => ZodSidebarContentsObject),
    z.lazy(() => ZodContentsAuto),
  ])),
]);

/* export type NavigationItem = z.infer<typeof ZodNavigationItem>; */

/* export type NavigationItemObject = z.infer<typeof ZodNavigationItemObject>; */

/* export type SidebarContents = z.infer<typeof ZodSidebarContents>; */

export const Base_ZodNavigationItem = z.string();
/*
   hide the recursive declaration
z.union([
  z.string(),
  z.lazy(() => ZodNavigationItemObject),
]);
*/
export type NavigationItem =
  | z.infer<typeof Base_ZodNavigationItem>
  | NavigationItemObject;

export const ZodNavigationItem = z.union([
  Base_ZodNavigationItem,
  z.lazy(() => ZodNavigationItemObject),
]);

export const Base_ZodNavigationItemObject = z.object({
  "aria-label": z.string(),
  file: z.string(),
  href: z.string(),
  icon: z.string(),
  id: z.string(),
  /* hide the recursive declaration

  menu: z.array(z.lazy(() => ZodNavigationItem)),
  */
  text: z.string(),
  url: z.string(),
  rel: z.string(),
  target: z.string(),
}).strict().partial();

type NavigationItemObject = z.infer<typeof Base_ZodNavigationItemObject> & {
  menu?: NavigationItem[];
};

export const ZodNavigationItemObject: z.ZodType<NavigationItemObject> =
  Base_ZodNavigationItemObject.extend({
    menu: z.array(z.lazy(() => ZodNavigationItem)),
  }).strict().partial();
