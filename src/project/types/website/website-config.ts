/*
* website-config.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import * as ld from "../../../core/lodash.ts";

import { kDescription, kMetadataFormat } from "../../../config/constants.ts";
import { isHtmlOutput } from "../../../config/format.ts";
import {
  formatFromMetadata,
  formatKeys,
  metadataAsFormat,
} from "../../../config/metadata.ts";
import { Format, Metadata } from "../../../config/types.ts";
import { mergeConfigs } from "../../../core/config.ts";
import { kComments } from "../../../format/html/format-html-shared.ts";
import { kProjectTitle, Sidebar } from "../../types.ts";
import { RenderFlags } from "../../../command/render/types.ts";
import { ProjectConfig, ProjectContext } from "../../types.ts";
import {
  kBodyFooter,
  kBodyHeader,
  kImage,
  kMarginFooter,
  kMarginHeader,
  kSitePath,
  kSiteRepoBranch,
  kSiteRepoSubdir,
  kSiteRepoUrl,
  kSiteSidebar,
  kSiteSidebarFooter,
  kSiteSidebarHeader,
  kSiteTitle,
  kSiteUrl,
  kWebsite,
} from "./website-constants.ts";
import { ensureTrailingSlash } from "../../../core/path.ts";
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

type WebsiteConfigKey =
  | "title"
  | "image"
  | "description"
  | "favicon"
  | "site-url"
  | "site-path"
  | "repo-url"
  | "repo-subdir"
  | "repo-branch"
  | "repo-actions"
  | "issue-url"
  | "navbar"
  | "sidebar"
  | "page-navigation"
  | "back-to-top-navigation"
  | "bread-crumbs"
  | "page-footer"
  | "margin-header"
  | "margin-footer"
  | "body-header"
  | "body-footer"
  | "search"
  | "comments"
  | "reader-mode";

export function websiteConfigBoolean(
  name: WebsiteConfigKey,
  defaultValue: boolean,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (typeof (config) === "string") {
    return !!config;
  } else if (typeof (config) == "boolean") {
    return config;
  } else {
    return defaultValue;
  }
}

export function websiteConfigString(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (typeof (config) === "string") {
    return config;
  } else {
    return undefined;
  }
}

export function websiteConfigMetadata(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (typeof (config) === "object" && !Array.isArray(config)) {
    return config;
  } else {
    return undefined;
  }
}

export function websiteConfigArray(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const config = websiteConfig(name, project);
  if (Array.isArray(config)) {
    return config;
  } else {
    return undefined;
  }
}

export function websiteConfig(
  name: WebsiteConfigKey,
  project?: ProjectConfig,
) {
  const site = project?.[kWebsite] as
    | Record<string, unknown>
    | undefined;

  if (site) {
    return site[name] as
      | Record<string, unknown>
      | string
      | Array<string>
      | undefined;
  } else {
    return undefined;
  }
}

export function websiteTitle(project?: ProjectConfig): string | undefined {
  return websiteConfigString(kSiteTitle, project);
}

export function websiteBaseurl(project?: ProjectConfig): string | undefined {
  return websiteConfigString(kSiteUrl, project);
}

export function websiteImage(project?: ProjectConfig): string | undefined {
  return websiteConfigString(kImage, project);
}

export function websiteDescription(
  project?: ProjectConfig,
): string | undefined {
  return websiteConfigString(kDescription, project);
}

export function websitePath(project?: ProjectConfig): string {
  let path = websiteConfigString(kSitePath, project);
  if (path) {
    if (!path.endsWith("/")) {
      path = path + "/";
    }
    return path;
  } else {
    const baseUrl = websiteBaseurl(project);
    if (baseUrl) {
      try {
        const url = new URL(baseUrl);
        let path = url.pathname;
        if (!path.endsWith("/")) {
          path = path + "/";
        }
        return path;
      } catch {
        return "/";
      }
    } else {
      return "/";
    }
  }
}

export interface WebsiteRepoInfo {
  baseUrl: string;
  path: string;
}

export function websiteRepoInfo(
  project?: ProjectConfig,
): WebsiteRepoInfo | undefined {
  let repoUrl = websiteConfigString(kSiteRepoUrl, project);
  if (repoUrl) {
    repoUrl = ensureTrailingSlash(repoUrl);
    // is there an explicit subdir?
    const repoSubdir = websiteConfigString(kSiteRepoSubdir, project);
    if ((repoSubdir)) {
      return {
        baseUrl: repoUrl,
        path: ensureTrailingSlash(repoSubdir),
      };
    } else {
      return {
        baseUrl: repoUrl,
        path: "",
      };
    }
  } else {
    return undefined;
  }
}

export function websiteRepoBranch(project?: ProjectConfig): string {
  return websiteConfigString(kSiteRepoBranch, project) || "main";
}

export function websiteMetadataFields(): Array<string | RegExp> {
  return [kWebsite, "site"];
}

export function repoUrlIcon(url: string): string {
  if (url.indexOf("github.com") !== -1) {
    return "github";
  } else {
    return "git";
  }
}

export function websiteConfigActions(
  key: string,
  subkey: string,
  project?: ProjectConfig,
): string[] {
  const book = project?.[subkey] as
    | Record<string, unknown>
    | undefined;
  if (book) {
    const value = book[key];
    if (typeof (value) === "string") {
      if (value === "none") {
        return [];
      } else {
        return [value];
      }
    } else if (Array.isArray(value)) {
      return value.map((x) => String(x));
    } else {
      return [];
    }
  } else {
    return [];
  }
}

// normalize html to first if its included in the formats
export function websiteFormatPreferHtml(
  format: string | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (format !== undefined) {
    if (typeof (format) === "string") {
      return {
        [format]: "default",
      };
    } else {
      const formats = Object.keys(format);
      const orderedFormats = {} as Record<string, Format>;

      const htmlFormatPos = formats.findIndex((format) =>
        isHtmlOutput(format, true)
      );
      if (htmlFormatPos !== -1) {
        const htmlFormatName = formats.splice(htmlFormatPos, 1)[0];
        orderedFormats[htmlFormatName] = format[htmlFormatName] as Format;
      }
      for (const formatName of formats) {
        orderedFormats[formatName] = format[formatName] as Format;
      }
      return orderedFormats;
    }
  } else {
    return {
      html: "default",
    };
  }
}

export function formatsPreferHtml(formats: Record<string, unknown>) {
  const orderedFormats = {} as Record<string, unknown>;
  const formatNames = Object.keys(formats);
  const htmlFormatPos = formatNames.findIndex((format) =>
    isHtmlOutput(format, true)
  );
  if (htmlFormatPos !== -1) {
    const htmlFormatName = formatNames.splice(htmlFormatPos, 1)[0];
    orderedFormats[htmlFormatName] = formats[htmlFormatName];
  }
  for (const formatName of formatNames) {
    orderedFormats[formatName] = formats[formatName];
  }
  return orderedFormats;
}

// provide a project context that elevates html to the default
// format for documents (unless they explicitly declare another format)
export function websiteProjectConfig(
  projectDir: string,
  config: ProjectConfig,
  flags?: RenderFlags,
): Promise<ProjectConfig> {
  config = ld.cloneDeep(config);
  const format = config[kMetadataFormat] as
    | string
    | Record<string, unknown>
    | undefined;

  config[kMetadataFormat] = websiteFormatPreferHtml(format);

  // Resolve elements to be sure they're arrays, they will be resolve later
  const ensureArray = (val: unknown) => {
    if (Array.isArray(val)) {
      return val;
    } else if (typeof (val) === "string") {
      return [val];
    }
  };

  const siteMeta = (config[kWebsite] || {}) as Metadata;

  // get default title from project if requred
  siteMeta[kSiteTitle] = siteMeta[kSiteTitle] || config.project[kProjectTitle];

  if (flags?.siteUrl) {
    siteMeta[kSiteUrl] = flags.siteUrl;
  }
  if (siteMeta[kBodyHeader]) {
    siteMeta[kBodyHeader] = ensureArray(siteMeta[kBodyHeader]);
  }
  if (siteMeta[kBodyFooter]) {
    siteMeta[kBodyFooter] = ensureArray(siteMeta[kBodyFooter]);
  }

  const resolveProjectPaths = (maybePath: string) => {
    if (existsSync(maybePath)) {
      return join(projectDir, maybePath);
    } else {
      return maybePath;
    }
  };
  if (siteMeta[kMarginHeader]) {
    siteMeta[kMarginHeader] = ensureArray(siteMeta[kMarginHeader])?.map(
      resolveProjectPaths,
    );
  }
  if (siteMeta[kMarginFooter]) {
    siteMeta[kMarginFooter] = ensureArray(siteMeta[kMarginFooter])?.map(
      resolveProjectPaths,
    );
  }
  config[kWebsite] = siteMeta;

  const sidebarRaw = siteMeta[kSiteSidebar];
  const sidebars =
    (Array.isArray(sidebarRaw)
      ? sidebarRaw
      : typeof (sidebarRaw) == "object"
      ? [sidebarRaw]
      : undefined) as Sidebar[] | undefined;

  // Resolve any sidebar headers
  sidebars?.forEach((sidebar) => {
    const headerRaw = sidebar[kSiteSidebarHeader];
    if (headerRaw) {
      sidebar[kSiteSidebarHeader] = ensureArray(sidebar[kSiteSidebarHeader]);
    }
  });

  // Resolve any sidebar footer
  sidebars?.forEach((sidebar) => {
    const footerRaw = sidebar[kSiteSidebarFooter];
    if (footerRaw) {
      sidebar[kSiteSidebarFooter] = ensureArray(sidebar[kSiteSidebarFooter]);
    }
  });

  // move any 'comments' config in website into the main config so it is merged w/ formats
  if (
    websiteConfigMetadata(kComments, config) &&
    (config[kComments] === undefined)
  ) {
    config[kComments] = websiteConfigMetadata(kComments, config);
  }

  return Promise.resolve(config);
}

export function websiteHtmlFormat(project: ProjectContext): Format {
  const projConfig: Metadata = project.config || {};
  const baseFormat = metadataAsFormat(projConfig);
  const format = formatFromMetadata(baseFormat, formatKeys(projConfig)[0]);
  return mergeConfigs(baseFormat, format);
}
