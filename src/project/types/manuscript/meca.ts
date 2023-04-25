/*
* meca.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { stringify } from "xml/mod.ts";

export const kTypeArticleMeta = "article-metadata";
export const kMecaVersion = "2.0";

export interface MecaItem {
  id?: string;
  type?: string;
  version?: string;
  metadataId?: string;
  title?: string;
  description?: string;
  order?: number;
  instance: {
    mediaType?: string;
    href: string;
  };
  metadata?: Record<string, string>;
}

export interface MecaManifest {
  version: string;
  items: MecaItem[];
}

export function toXml(manifest: MecaManifest): string {
  const mecaJson = {
    xml: {
      "@version": 1,
      "@encoding": "UTF-8",
    },
    doctype: {
      "@manifest": true,
      "@PUBLIC": true,
      "@-//MECA//DTD Manifest v1.0//en": true,
      "@MECA_manifest.dtd": true,
    },
    manifest: {
      "@manifest-version": manifest.version,
      "@xmlns": "https://www.manuscriptexchange.org/schema/manifest",
      "@xmlns:xlink": "http://www.w3.org/1999/xlink",
      item: manifest.items,
    },
  };
  return stringify(mecaJson);
}
