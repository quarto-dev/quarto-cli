import { ApiError, PublishRecord } from "../types.ts";
import { ensureTrailingSlash } from "../../core/path.ts";
import { isHttpUrl } from "../../core/url.ts";
import { AccountToken } from "../provider.ts";
import {
  ConfluenceParent,
  ConfluenceSpaceChange,
  Content,
  ContentBody,
  ContentBodyRepresentation,
  ContentCreate,
  ContentStatusEnum,
  ContentUpdate,
  ContentVersion,
  EMPTY_PARENT,
  PAGE_TYPE,
  SiteFileMetadata,
  Space,
} from "./api/types.ts";
import { withSpinner } from "../../core/console.ts";
import { ProjectContext } from "../../project/types.ts";
import { capitalizeWord } from "../../core/text.ts";

export const transformAtlassianDomain = (domain: string) => {
  return ensureTrailingSlash(
    isHttpUrl(domain) ? domain : `https://${domain}.atlassian.net`
  );
};

export const isUnauthorized = (error: Error): boolean => {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  );
};

export const isNotFound = (error: Error): boolean => {
  return error instanceof ApiError && error.status === 404;
};

const exitIfNoValue = (value: string) => {
  if (value?.length === 0) {
    throw new Error("");
  }
};

export const validateServer = (value: string): boolean | string => {
  exitIfNoValue(value);
  try {
    new URL(transformAtlassianDomain(value));
    return true;
  } catch {
    return `Not a valid URL`;
  }
};

export const validateEmail = (value: string): boolean | string => {
  exitIfNoValue(value);

  // TODO use deno validation
  // https://deno.land/x/validation@v0.4.0
  const expression: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const isValid = expression.test(value);

  if (!isValid) {
    return "Invalid email address";
  }

  return true;
};

export const validateToken = (value: string): boolean => {
  exitIfNoValue(value);
  return true;
};

export const validateParentURL = (value: string): boolean => {
  //TODO validate URL
  exitIfNoValue(value);
  return true;
};

export const getMessageFromAPIError = (error: any): string => {
  if (error instanceof ApiError) {
    return `${error.status} - ${error.statusText}`;
  }

  if (error?.message) {
    return error.message;
  }

  return "Unknown error";
};

export const tokenFilterOut = (
  accessToken: AccountToken,
  token: AccountToken
) => {
  return accessToken.server !== token.server && accessToken.name !== token.name;
};

export const confluenceParentFromString = (url: string): ConfluenceParent => {
  const match = url.match(
    /^https.*?wiki\/spaces\/(?:(\w+)|(\w+)\/overview|(\w+)\/pages\/(\d+).*)$/
  );
  if (match) {
    return {
      space: match[1] || match[2] || match[3],
      parent: match[4],
    };
  }
  return EMPTY_PARENT;
};

export const wrapBodyForConfluence = (value: string): ContentBody => {
  const body: ContentBody = {
    storage: {
      value,
      representation: ContentBodyRepresentation.storage,
    },
  };
  return body;
};

export const buildPublishRecordForContent = (
  server: string,
  content: Content | undefined
): [PublishRecord, URL] => {
  if (!content?.id || !content?.space || !(server.length > 0)) {
    throw new Error("Invalid Content");
  }

  const url = `${ensureTrailingSlash(server)}wiki/spaces/${
    content.space.key
  }/pages/${content.id}`;

  const newPublishRecord: PublishRecord = {
    id: content.id,
    url,
  };

  return [newPublishRecord, new URL(url)];
};

export const doWithSpinner = async (
  message: string,
  toDo: () => Promise<any>
) => {
  return await withSpinner(
    {
      message,
    },
    toDo
  );
};

export const getNextVersion = (previousPage: Content): ContentVersion => {
  const previousNumber: number = previousPage.version?.number ?? 0;
  return {
    number: previousNumber + 1,
  };
};

export const writeTokenComparator = (
  a: AccountToken,
  b: AccountToken
): boolean => a.server === b.server && a.name === b.name;

export const isProjectContext = (
  input: ProjectContext | string
): input is ProjectContext => {
  return (input as ProjectContext).files !== undefined;
};

export const filterFilesForUpdate = (allFiles: string[]): string[] => {
  const fileFilter = (fileName: string): boolean => {
    if (!fileName.endsWith(".xml")) {
      return false;
    }

    if (fileName.includes("/")) {
      return false; //No support for nested children, yet
    }

    return true;
  };
  const result: string[] = allFiles.filter(fileFilter);
  return result;
};

export const isContentCreate = (
  content: ContentCreate | ContentUpdate
): content is ContentCreate => {
  return (content as ContentCreate).id !== undefined;
};

export const buildContentCreate = (
  title: string | null,
  space: Space,
  body: ContentBody,
  parent?: string,
  status: ContentStatusEnum = ContentStatusEnum.current,
  id: string | null = null,
  type: string = PAGE_TYPE
): ContentCreate => {
  return {
    id,
    title,
    type,
    space,
    status,
    ancestors: parent ? [{ id: parent }] : null,
    body,
  };
};

export const fileMetadataToSpaceChanges = (
  fileMetadataList: SiteFileMetadata[],
  parent: ConfluenceParent,
  space: Space
): ConfluenceSpaceChange[] => {
  const spaceChangesCallback = (
    accumulatedChanges: ConfluenceSpaceChange[],
    fileMetadata: SiteFileMetadata
  ): ConfluenceSpaceChange[] => {
    const content = buildContentCreate(
      fileMetadata.title,
      space,
      fileMetadata.contentBody,
      parent?.parent
    );

    const spaceChange: ConfluenceSpaceChange = content;

    return [...accumulatedChanges, spaceChange];
  };

  const spaceChanges: ConfluenceSpaceChange[] = fileMetadataList.reduce(
    spaceChangesCallback,
    []
  );

  return spaceChanges;
};
