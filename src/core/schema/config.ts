/*
* config.ts
*
* JSON Schema for _quarto.yml, Quarto's project configuration YAML
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  IntegerSchema as IntegerS,
  BooleanSchema as BooleanS,
  StringSchema as StringS,
  anySchema as anyS,
  arraySchema as arrayS,
  enumSchema as enumS,
  idSchema as withId,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  refSchema as refS,
  documentSchema as doc,
  completeSchema as complete,
} from "./common.ts";

import {
  frontMatterFormatSchema
} from "./front-matter.ts";

const sidebarEntrySchema = objectS({
  properties: {
    text: StringS,
    href: StringS,
    icon: StringS
  },
  completions: {
    text: "entry description",
    href: "URL of the link",
    icon: "font-awesome icon id"
  },
  additionalProperties: false
});

const sectionSchema = withId(
  oneOfS(StringS,
         sidebarEntrySchema,
         objectS({
           properties: {
             section: StringS,
             contents: arrayS(refS("/schemas/section", "be a section object"))
           },
           additionalProperties: false,
           required: ["section", "contents"]
         })),
  "/schemas/section");

const sidebarItemSchema = objectS({
  properties: {
    id: StringS,
    title: StringS,
    sytle: StringS,
    "collapse-level": IntegerS,
    align: StringS,
    contents: arrayS(sectionSchema)
  },
  exhaustive: true
});

const siteSchema = objectS({
  properties: {
    title: doc(StringS, "website title"),
    image: StringS,
    "google-analytics": doc(StringS, "Google analytics key"),
    "open-graph": BooleanS,
    "twitter-card": BooleanS,
    "site-url": doc(StringS, "URL where site will be published"),
    "repo-url": doc(StringS, "URL where site source is hosted"),
    "repo-actions": doc(arrayS(enumS("edit", "issue")), "which github action links to enable"),
    "page-navigation": BooleanS,
    search: objectS({
      properties: {
        algolia: objectS({
          properties: {
            "index-name": StringS,
            "application-id": StringS,
            "search-only-api-key": StringS,
            "analytics-events": BooleanS
          },
          exhaustive: true
        })
      },
      exhaustive: true
    }),
    "navbar": objectS({
      properties: {
        background: StringS, // FIXME?
        logo: StringS,
        title: BooleanS,
        "collapse-below": StringS,
        "sidebar-menus": BooleanS,
        "right": arrayS(oneOfS(
          StringS,
          sidebarEntrySchema
        )),
      },
      exhaustive: true
    }),
    "sidebar": arrayS(sidebarItemSchema),
  },
  exhaustive: true
});

export const configSchema = objectS({
  properties: {
    project: objectS({
      properties: {
        type: doc(enumS("site"), "type of quarto project"),
        "output-dir": doc(StringS, "output directory for the project")
      }
    }),
    site: siteSchema,
    "bibliography": StringS,
    "filters": arrayS(StringS),
    "format": frontMatterFormatSchema
  }
});

