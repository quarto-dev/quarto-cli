/*
 * types.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { RenderFlags } from "../../../command/render/types.ts";
import { PublishFiles } from "../../provider.ts";

export type User = {
  type: "known" | "unknown" | "anonymous" | "user";
  username: string;
  userKey: string;
  accountId: string;
  accountType: "atlassian" | "app";
  email: string;
};

export type Space = {
  key: string;
};

export const PAGE_TYPE = "page";

export const EMPTY_PARENT: ConfluenceParent = {
  space: "",
  parent: "",
};

export type ContentVersion = {
  number: number;
};

export type ContentStatus = "current" | "deleted" | "historical" | "draft";

export enum ContentStatusEnum {
  current = "current",
  deleted = "deleted",
  historical = "historical",
  draft = "draft",
}

export type PublishType = "document" | "site";

export type PublishRenderer = (flags?: RenderFlags) => Promise<PublishFiles>;

export enum PublishTypeEnum {
  document = "document",
  site = "site",
}
export type ContentAncestor = {
  id: string;
};

export enum ContentBodyRepresentation {
  storage = "storage",
}

export type ContentBody = {
  storage: {
    value: string;
    representation:
      | "view"
      | "export_view"
      | "styled_view"
      | "storage"
      | "editor"
      | "editor2"
      | "anonymous_export_view"
      | "wiki"
      | "atlas_doc_format"
      | "plain"
      | "raw";
  };
};

export type ContentUpdate = {
  version: ContentVersion | null;
  title: string | null;
  type: string;
  status: ContentStatus;
  ancestors: ContentAncestor[] | null;
  body: ContentBody;
};

export type ContentCreate = {
  id: string | null;
  title: string | null;
  type: string;
  space: Space;
  status: ContentStatus;
  ancestors: ContentAncestor[] | null;
  body: ContentBody;
};

export type Content = {
  id: string | null;
  type: string;
  status: ContentStatus;
  title: string | null;
  space: Space | null;
  version: ContentVersion | null;
  ancestors: ContentAncestor[] | null;
  body: ContentBody;
};

export type LongTask = {
  ari: string;
  id: string;
  links: {
    status: string;
  };
};

export type ConfluenceParent = {
  space: string;
  parent?: string;
};

export type GenericLinks = {
  webui: string;
  self: string;
  tinyui: string;
};

export type ContentArray = {
  results: Content[];
  start: number;
  limit: number;
  size: number;
  _links: GenericLinks;
};

export type ConfluenceSpaceChange = ContentCreate | ContentUpdate;
