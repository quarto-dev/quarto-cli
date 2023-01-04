import { ApiError, PublishRecord } from "../types.ts";
import { ensureTrailingSlash } from "../../core/path.ts";
import { isHttpUrl } from "../../core/url.ts";
import { AccountToken, InputMetadata } from "../provider.ts";
import {
  ConfluenceParent,
  ConfluenceSpaceChange,
  Content,
  ContentBody,
  ContentBodyRepresentation,
  ContentChangeType,
  ContentCreate,
  ContentDelete,
  ContentProperty,
  ContentStatusEnum,
  ContentSummary,
  ContentUpdate,
  ContentVersion,
  EMPTY_PARENT,
  LogLevel,
  LogPrefix,
  PAGE_TYPE,
  SiteFileMetadata,
  SitePage,
  Space,
} from "./api/types.ts";
import { withSpinner } from "../../core/console.ts";
import { ProjectContext } from "../../project/types.ts";
import { capitalizeWord } from "../../core/text.ts";

export const LINK_FINDER: RegExp = /(\S*.qmd'|\S*.qmd#\S*')/g;
export const FILE_FINDER: RegExp = /(?<=href=\')(.*)(?=\.qmd)/;
const IMAGE_FINDER: RegExp =
  /(?<=ri:attachment ri:filename=["\'])[^"\']+?\.(?:jpe?g|png|gif|m4a|mp3|txt)(?=["\'])/g;

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
    return true;
  };
  const result: string[] = allFiles.filter(fileFilter);
  return result;
};

export const isContentCreate = (
  content: ConfluenceSpaceChange
): content is ContentCreate => {
  return content.contentChangeType === ContentChangeType.create;
};

export const isContentUpdate = (
  content: ConfluenceSpaceChange
): content is ContentUpdate => {
  return content.contentChangeType === ContentChangeType.update;
};

export const isContentDelete = (
  content: ConfluenceSpaceChange
): content is ContentDelete => {
  return content.contentChangeType === ContentChangeType.delete;
};

export const buildContentCreate = (
  title: string | null,
  space: Space,
  body: ContentBody,
  fileName: string,
  parent?: string,
  status: ContentStatusEnum = ContentStatusEnum.current,
  id: string | null = null,
  type: string = PAGE_TYPE
): ContentCreate => {
  return {
    contentChangeType: ContentChangeType.create,
    title,
    type,
    space,
    status,
    ancestors: parent ? [{ id: parent }] : null,
    body,
    fileName,
  };
};

export const buildContentUpdate = (
  id: string | null,
  title: string | null,
  body: ContentBody,
  fileName: string,
  parent?: string,
  status: ContentStatusEnum = ContentStatusEnum.current,
  type: string = PAGE_TYPE,
  version: ContentVersion | null = null
): ContentUpdate => {
  return {
    contentChangeType: ContentChangeType.update,
    id,
    version,
    title,
    type,
    status,
    ancestors: parent ? [{ id: parent }] : null,
    body,
    fileName,
  };
};

export const findPagesToDelete = (
  fileMetadataList: SiteFileMetadata[],
  existingSite: SitePage[] = []
): SitePage[] => {
  return existingSite.reduce((accumulator: SitePage[], page: SitePage) => {
    if (
      !fileMetadataList.find(
        (file) => file.fileName === page?.metadata?.fileName ?? ""
      )
    ) {
      return [...accumulator, page];
    }

    return accumulator;
  }, []);
};

export const buildSpaceChanges = (
  fileMetadataList: SiteFileMetadata[],
  parent: ConfluenceParent,
  space: Space,
  existingSite: SitePage[] = []
): ConfluenceSpaceChange[] => {
  console.log("fileMetadataList", fileMetadataList);
  console.log("exisitingSite", existingSite);

  const spaceChangesCallback = (
    accumulatedChanges: ConfluenceSpaceChange[],
    fileMetadata: SiteFileMetadata
  ): ConfluenceSpaceChange[] => {
    const existingPage = existingSite.find(
      (page: SitePage) => page?.metadata?.fileName === fileMetadata.fileName
    );

    let spaceChangeList: ConfluenceSpaceChange[] = [];

    if (existingPage) {
      let useOriginalTitle = false;
      if (fileMetadata.matchingPages.length === 1) {
        if (fileMetadata.matchingPages[0].id === existingPage.id) {
          useOriginalTitle = true;
        }
      }

      spaceChangeList = [
        buildContentUpdate(
          existingPage.id,
          useOriginalTitle ? fileMetadata.originalTitle : fileMetadata.title,
          fileMetadata.contentBody,
          fileMetadata.fileName,
          parent?.parent
        ),
      ];
    } else {
      console.log("fileMetadata.fileName", fileMetadata.fileName);

      const path = fileMetadata.fileName.split("/");
      console.log("path", path);
      if (path.length > 1) {
        const parents = path.slice(0, path.length - 1);
        console.log("parents", parents);
        parents.forEach((parentPath, index) => {
          console.log("create page for", parentPath);
          console.log("index", index);
          let ancestor = parent?.parent;
          if (index > 0) {
            ancestor = parents[index - 1];
          }
          console.log("ancestor", ancestor);

          let fileName = `${parents.slice(0, index).toString()}/${parentPath}`;

          if (fileName.startsWith("/")) {
            fileName = parentPath;
          }

          console.log("fileName", fileName);

          spaceChangeList = [
            ...spaceChangeList,
            buildContentCreate(
              parentPath,
              space,
              {
                storage: {
                  value: "",
                  representation: "storage",
                },
              },
              fileName,
              ancestor,
              ContentStatusEnum.current
            ),
          ];
        });
      }

      const pageParent =
        path.length > 1 ? path[path.length - 2] : parent?.parent;

      console.log("path.length", path.length);
      console.log("pageParent", pageParent);

      spaceChangeList = [
        ...spaceChangeList,
        buildContentCreate(
          fileMetadata.title,
          space,
          fileMetadata.contentBody,
          fileMetadata.fileName,
          pageParent,
          ContentStatusEnum.current
        ),
      ];
    }

    return [...accumulatedChanges, ...spaceChangeList];
  };

  const pagesToDelete: SitePage[] = findPagesToDelete(
    fileMetadataList,
    existingSite
  );

  // TODO prompt as a sanity check and limiter to prevent any major run-away deletes
  const deleteChanges: ContentDelete[] = pagesToDelete.map(
    (toDelete: SitePage) => {
      return { contentChangeType: ContentChangeType.delete, id: toDelete.id };
    }
  );

  const spaceChanges: ConfluenceSpaceChange[] = fileMetadataList.reduce(
    spaceChangesCallback,
    deleteChanges
  );

  return spaceChanges;
};

export const getTitle = (
  fileName: string,
  metadataByInput: Record<string, InputMetadata>
): string => {
  const qmdFileName = fileName.replace(".xml", ".qmd");
  const metadataTitle = metadataByInput[qmdFileName]?.title;

  const titleFromFilename = capitalizeWord(fileName.split(".")[0] ?? fileName);
  const title = metadataTitle ?? titleFromFilename;
  return title;
};

const flattenMetadata = (list: ContentProperty[] = []): Record<string, any> => {
  const result: Record<string, any> = list.reduce(
    (accumulator: any, currentValue: ContentProperty) => {
      const updated: any = accumulator;
      updated[currentValue.key] = currentValue.value;
      return updated;
    },
    {}
  );

  return result;
};

export const mergeSitePages = (
  shallowPages: ContentSummary[] = [],
  contentProperties: ContentProperty[][] = []
): SitePage[] => {
  const result: SitePage[] = shallowPages.map(
    (contentSummary: ContentSummary, index) => {
      const sitePage: SitePage = {
        title: contentSummary.title,
        id: contentSummary.id ?? "",
        metadata: flattenMetadata(contentProperties[index]),
      };
      return sitePage;
    }
  );
  return result;
};

export const buildFileToMetaTable = (
  fileMetadata: SitePage[]
): Record<string, SitePage> => {
  return fileMetadata.reduce(
    (accumulator: Record<string, SitePage>, page: SitePage) => {
      const fileName: string = page?.metadata?.fileName ?? "";
      const fileNameQMD = fileName.replace("xml", "qmd");
      if (fileName.length === 0) {
        return accumulator;
      }

      accumulator[fileNameQMD] = page;
      return accumulator;
    },
    {}
  );
};

export const updateLinks = (
  fileMetadataTable: Record<string, SitePage>,
  spaceChanges: ConfluenceSpaceChange[],
  server: string,
  parent: ConfluenceParent
): ConfluenceSpaceChange[] => {
  const root = `${server}`;
  const url = `${ensureTrailingSlash(server)}wiki/spaces/${
    parent.space
  }/pages/`;

  const replacer = (match: string): string => {
    let updated: string = match;
    const fileNameMatch = FILE_FINDER.exec(match);
    const fileName = fileNameMatch ? fileNameMatch[0] ?? "" : "";

    const fileNameExtension = `${fileName}.qmd`;

    const sitePage: SitePage | null =
      fileMetadataTable[fileNameExtension] ?? null;
    if (sitePage) {
      updated = match.replace('href="', `href="${url}`);
      const pagePath: string = `${url}${sitePage.id}/${encodeURI(
        sitePage.title ?? ""
      )}`;

      updated = updated.replace(fileNameExtension, pagePath);
    }

    return updated;
  };

  const changeMapper = (
    changeToProcess: ConfluenceSpaceChange
  ): ConfluenceSpaceChange => {
    if (isContentUpdate(changeToProcess) || isContentCreate(changeToProcess)) {
      const valueToProcess = changeToProcess?.body?.storage?.value;
      if (valueToProcess) {
        const replacedLinks: string = valueToProcess.replaceAll(
          LINK_FINDER,
          replacer
        );

        changeToProcess.body.storage.value = replacedLinks;
      }
    }
    return changeToProcess;
  };

  const updatedChanges: ConfluenceSpaceChange[] =
    spaceChanges.map(changeMapper);

  return updatedChanges;
};

export const updateImagePaths = (body: ContentBody): ContentBody => {
  const replacer = (match: string): string => {
    let updated: string = match.replace(/^.*[\\\/]/, "");
    return updated;
  };

  const bodyValue: string = body?.storage?.value;
  if (!bodyValue) {
    return body;
  }

  const attachments = findAttachments(bodyValue);

  const withReplacedImages: string = bodyValue.replaceAll(
    IMAGE_FINDER,
    replacer
  );

  body.storage.value = withReplacedImages;
  return body;
};

export const findAttachments = (bodyValue: string): string[] => {
  const result = bodyValue.match(IMAGE_FINDER);
  const uniqueResult = [...new Set(result)];

  return uniqueResult ?? [];
};
