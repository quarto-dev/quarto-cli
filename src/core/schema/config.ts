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
  }
});

const sectionSchema = withId(objectS({
  properties: {
    section: StringS,
    contents: oneOfS(
      StringS,
      sidebarEntrySchema,
      refS("/schemas/section", "be a section object")
    )
  }
}), "/schemas/section");

const sidebarItemSchema = objectS({
  properties: {
    id: StringS,
    title: StringS,
    sytle: StringS,
    "collapse-level": IntegerS,
    align: StringS,
    contents: sectionSchema
  }
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
          }
        })
      }
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
      }
    }),
    "sidebar": arrayS(sidebarItemSchema),
  }
});

export const configSchema = objectS({
  properties: {
    project: objectS({
      properties: {
        type: doc(enumS("site"), "type of quarto project"),
        "output-dir": doc(StringS, "output directory for the project"),
        "bibliography": StringS,
        "filters": arrayS(StringS)
      }
    }),
    site: siteSchema
  }
});

