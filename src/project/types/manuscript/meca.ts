/*
 * meca.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
      item: manifest.items.map(toMecaXMLItem),
    },
  };
  return stringify(mecaJson);
}

function toMecaXMLItem(item: MecaItem) {
  const xmlItem: Record<string, unknown> = {};

  if (item.id) {
    xmlItem["@id"] = item.id;
  }
  if (item.type) {
    xmlItem["@item-type"] = item.type;
  }
  if (item.version) {
    xmlItem["@version"] = item.version;
  }
  if (item.metadataId) {
    xmlItem["metadata-id"] = item.metadataId;
  }
  if (item.title) {
    xmlItem["item-title"] = item.title;
  }
  if (item.description) {
    xmlItem["item-description"] = item.description;
  }
  if (item.order) {
    xmlItem["file-order"] = item.order;
  }
  if (item.metadata) {
    const metaValues: Record<string, unknown> = {};
    if (item.metadata) {
      for (const key of Object.keys(item.metadata)) {
        const value = item.metadata[key];
        metaValues["metadata"] = {
          ["@metadata-name"]: key,
          ["#text"]: value,
        };
      }
    }
    const itemMetadata = Object.keys(metaValues).length > 0
      ? {
        ["item-metadata"]: metaValues,
      }
      : undefined;

    xmlItem["item-metadata"] = itemMetadata;
  }
  xmlItem["instance"] = {
    ["@media-type"]: item.instance.mediaType,
    ["@xlink:href"]: item.instance.href,
  };

  return xmlItem;
}
