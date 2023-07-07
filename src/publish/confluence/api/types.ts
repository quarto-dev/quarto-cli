/*
 * types.ts
 *
 * Copyright (C) 2020 by Posit, PBC
 */

import { RenderFlags } from "../../../command/render/types.ts";
import { PublishFiles } from "../../provider-types.ts";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export enum LogPrefix {
  GENERAL = "[General]",
  ATTACHMENT = "[Attach]",
  RENDER = "[Render]",
}

export type User = {
  type: "known" | "unknown" | "anonymous" | "user";
  username: string;
  userKey: string;
  accountId: string;
  accountType: "atlassian" | "app";
  email: string;
  operations: Operation[];
};

export type Operation = {
  operation: string;
};

export type Space = {
  id: string;
  key: string;
  homepage: ContentSummary;
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

export enum ContentChangeType {
  create = "create",
  update = "update",
  delete = "delete",
}

export type ContentChange = {
  contentChangeType: ContentChangeType;
  title: string | null;
  type: string;
  status: ContentStatus;
  ancestors: ContentAncestor[] | null;
  body: ContentBody;
  fileName?: string;
};

export type ContentUpdate = ContentChange & {
  id: string | null;
  version: ContentVersion | null;
};

export type ContentCreate = ContentChange & {
  space: Space;
};

export type ContentDelete = {
  contentChangeType: ContentChangeType;
  id: string;
};

export type SpaceChangeResult = Content | null;

export type Content = {
  id: string | null;
  type: string;
  status: ContentStatus;
  title: string | null;
  space: Space | null;
  version: ContentVersion | null;
  ancestors: ContentAncestor[] | null;
  descendants: any | null;
  body: ContentBody;
};

export interface WrappedResult<T> {
  results: T[];
  start?: number;
  limit?: number;
  size?: number;
}

export enum ContentPropertyKey {
  fileName = "fileName",
  isQuartoSiteParent = "isQuartoSiteParent",
}

export type ContentProperty = {
  key: string;
  value: string | number;
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

export type ConfluenceSpaceChange =
  | ContentCreate
  | ContentUpdate
  | ContentDelete;

export type SiteFileMetadata = {
  fileName: string;
  title: string;
  originalTitle: string;
  contentBody: ContentBody;
};

export type ContentSummary = {
  id: string | null;
  ancestors?: ContentAncestor[] | null;
  title: string | null;
};

export type SitePage = {
  id: string;
  metadata: Record<string, any>;
  title: string | null;
  ancestors?: ContentAncestor[] | null;
};

export type ExtractedLink = {
  link: string;
  file: string;
};

export type AttachmentSummary = {
  id: string;
  title: string;
  metadata: Record<string, any>;
};
