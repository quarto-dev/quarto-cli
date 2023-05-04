import { trace } from "./confluence-logger.ts";
import { ApiError, PublishRecord } from "../types.ts";
import {
  ensureTrailingSlash,
  pathWithForwardSlashes,
} from "../../core/path.ts";
import { join } from "path/mod.ts";
import { isHttpUrl } from "../../core/url.ts";
import { AccountToken, InputMetadata } from "../provider-types.ts";
import {
  ConfluenceParent,
  ConfluenceSpaceChange,
  Content,
  ContentAncestor,
  ContentBody,
  ContentBodyRepresentation,
  ContentChange,
  ContentChangeType,
  ContentCreate,
  ContentDelete,
  ContentProperty,
  ContentStatusEnum,
  ContentSummary,
  ContentUpdate,
  ContentVersion,
  EMPTY_PARENT,
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

export const capitalizeFirstLetter = (value: string = ""): string => {
  if (!value || value.length === 0) {
    return "";
  }
  return value[0].toUpperCase() + value.slice(1);
};

export const transformAtlassianDomain = (domain: string) => {
  return ensureTrailingSlash(
    isHttpUrl(domain) ? domain : `https://${domain}.atlassian.net`,
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
  token: AccountToken,
) => {
  return accessToken.server !== token.server && accessToken.name !== token.name;
};

export const confluenceParentFromString = (url: string): ConfluenceParent => {
  let toMatch = url;
  const urlNoParamsList = url?.split("?");

  if (urlNoParamsList.length === 2) {
    toMatch = urlNoParamsList[0] ?? url;
  }

  const match = toMatch.match(
    /^https.*?wiki\/spaces\/(?:(~?\w+)|(~?\w+)\/overview|(~?.+)\/pages\/(\d+).*)$/,
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
  content: Content | undefined,
): [PublishRecord, URL] => {
  if (!content?.id || !content?.space || !(server.length > 0)) {
    throw new Error("Invalid Content");
  }

  const url = `${
    ensureTrailingSlash(server)
  }wiki/spaces/${content.space.key}/pages/${content.id}`;

  const newPublishRecord: PublishRecord = {
    id: content.id,
    url,
  };

  return [newPublishRecord, new URL(url)];
};

export const doWithSpinner = async (
  message: string,
  toDo: () => Promise<any>,
) => {
  return await withSpinner(
    {
      message,
    },
    toDo,
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
  b: AccountToken,
): boolean => a.server === b.server && a.name === b.name;

export const isProjectContext = (
  input: ProjectContext | string,
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
  content: ConfluenceSpaceChange,
): content is ContentCreate => {
  return content.contentChangeType === ContentChangeType.create;
};

export const isContentUpdate = (
  content: ConfluenceSpaceChange,
): content is ContentUpdate => {
  return content.contentChangeType === ContentChangeType.update;
};

export const isContentDelete = (
  content: ConfluenceSpaceChange,
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
  type: string = PAGE_TYPE,
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
  version: ContentVersion | null = null,
  ancestors: ContentAncestor[] | null = null,
): ContentUpdate => {
  return {
    contentChangeType: ContentChangeType.update,
    id,
    version,
    title,
    type,
    status,
    ancestors: parent ? [{ id: parent }] : ancestors,
    body,
    fileName,
  };
};

export const findPagesToDelete = (
  fileMetadataList: SiteFileMetadata[],
  existingSite: SitePage[] = [],
): SitePage[] => {
  const activeParents = existingSite.reduce(
    (accumulator: ContentAncestor[], page: SitePage): ContentAncestor[] => {
      return [...accumulator, ...(page.ancestors ?? [])];
    },
    [],
  );

  const isActiveParent = (id: string): boolean =>
    !!activeParents.find((parent) => parent.id === id);

  return existingSite.reduce((accumulator: SitePage[], page: SitePage) => {
    if (
      !fileMetadataList.find(
        (file) =>
          pathWithForwardSlashes(file.fileName) === page?.metadata?.fileName ??
            "",
      ) &&
      !isActiveParent(page.id)
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
  existingSite: SitePage[] = [],
): ConfluenceSpaceChange[] => {
  const spaceChangesCallback = (
    accumulatedChanges: ConfluenceSpaceChange[],
    fileMetadata: SiteFileMetadata,
  ): ConfluenceSpaceChange[] => {
    const findPageInExistingSite = (fileName: string) =>
      existingSite.find(
        (page: SitePage) => page?.metadata?.fileName === fileName,
      );

    const universalFileName = pathWithForwardSlashes(fileMetadata.fileName);
    const existingPage = findPageInExistingSite(universalFileName);

    let spaceChangeList: ConfluenceSpaceChange[] = [];

    const pathList = universalFileName.split("/");

    let pageParent = pathList.length > 1
      ? pathList.slice(0, pathList.length - 1).join("/")
      : parent?.parent;

    const checkCreateParents = (): SitePage | null => {
      if (pathList.length < 2) {
        return null;
      }

      let existingSiteParent = null;

      const parentsList = pathList.slice(0, pathList.length - 1);

      parentsList.forEach((parentFileName, index) => {
        const ancestorFilePath = parentsList.slice(0, index).join("/");

        const ancestor = index > 0 ? ancestorFilePath : parent?.parent;

        let fileName = `${ancestorFilePath}/${parentFileName}`;

        if (fileName.startsWith("/")) {
          fileName = parentFileName;
        }

        const existingParentCreateChange = accumulatedChanges.find(
          (spaceChange: any) => {
            if (spaceChange.fileName) {
              return spaceChange?.fileName === fileName;
            }
            return false;
          },
        );

        existingSiteParent = existingSite.find((page: SitePage) => {
          if (page?.metadata?.fileName) {
            return page.metadata.fileName === fileName;
          }
          return false;
        });

        if (!existingParentCreateChange && !existingSiteParent) {
          // Create a new parent page

          const existingAncestor = findPageInExistingSite(ancestor ?? "");

          spaceChangeList = [
            ...spaceChangeList,
            buildContentCreate(
              capitalizeFirstLetter(parentFileName),
              space,
              {
                storage: {
                  value: "",
                  representation: "storage",
                },
              },
              fileName,
              existingAncestor ? existingAncestor.id : ancestor,
              ContentStatusEnum.current,
            ),
          ];
        }
      });

      return existingSiteParent;
    };

    const existingParent: SitePage | null = checkCreateParents();

    pageParent = existingParent ? existingParent.id : pageParent;

    if (existingPage) {
      spaceChangeList = [
        buildContentUpdate(
          existingPage.id,
          fileMetadata.title,
          fileMetadata.contentBody,
          universalFileName,
          pageParent,
        ),
      ];
    } else {
      spaceChangeList = [
        ...spaceChangeList,
        buildContentCreate(
          fileMetadata.title,
          space,
          fileMetadata.contentBody,
          universalFileName,
          pageParent,
          ContentStatusEnum.current,
        ),
      ];
    }

    return [...accumulatedChanges, ...spaceChangeList];
  };

  const pagesToDelete: SitePage[] = findPagesToDelete(
    fileMetadataList,
    existingSite,
  );

  const deleteChanges: ContentDelete[] = pagesToDelete.map(
    (toDelete: SitePage) => {
      return { contentChangeType: ContentChangeType.delete, id: toDelete.id };
    },
  );

  let spaceChanges: ConfluenceSpaceChange[] = fileMetadataList.reduce(
    spaceChangesCallback,
    deleteChanges,
  );

  const activeAncestorIds = spaceChanges.reduce(
    (accumulator: any, change: any) => {
      if (change?.ancestors?.length) {
        const idList = change.ancestors.map(
          (ancestor: ContentAncestor) => ancestor?.id ?? "",
        );

        return [...accumulator, ...idList];
      }

      return accumulator;
    },
    [],
  );

  spaceChanges = spaceChanges.filter((change: ConfluenceSpaceChange) => {
    if (isContentDelete(change) && activeAncestorIds.includes(change.id)) {
      return false;
    }
    return true;
  });

  return spaceChanges;
};

export const flattenIndexes = (
  changes: ConfluenceSpaceChange[],
  metadataByFileName: Record<string, SitePage>,
  siteParentId: string,
): ConfluenceSpaceChange[] => {
  const getFileNameForChange = (change: ConfluenceSpaceChange) => {
    if (isContentDelete(change)) {
      return "";
    }

    return pathWithForwardSlashes(change?.fileName ?? "");
  };

  const isIndexFile = (change: ConfluenceSpaceChange) => {
    return getFileNameForChange(change)?.endsWith("/index.xml");
  };

  const toIndexPageLookup = (
    accumulator: Record<string, ConfluenceSpaceChange>,
    change: ConfluenceSpaceChange,
  ): Record<string, any> => {
    if (isContentDelete(change)) {
      return accumulator;
    }
    const fileName = getFileNameForChange(change);
    const isIndex = isIndexFile(change);

    if (isIndex) {
      const folderFileName = fileName.replace("/index.xml", "");
      return {
        ...accumulator,
        [folderFileName]: change,
      };
    }

    return accumulator;
  };

  const indexLookup: Record<string, ConfluenceSpaceChange> = changes.reduce(
    toIndexPageLookup,
    {},
  );

  const toFlattenedIndexes = (
    accumulator: ConfluenceSpaceChange[],
    change: ConfluenceSpaceChange,
  ): ConfluenceSpaceChange[] => {
    if (isContentDelete(change)) {
      return [...accumulator, change];
    }

    const fileName = getFileNameForChange(change);

    if (fileName === "index.xml") {
      const rootUpdate = buildContentUpdate(
        siteParentId,
        change.title,
        change.body,
        "index.xml",
      );
      return [...accumulator, rootUpdate];
    }

    const parentFileName = fileName.replace("/index.xml", "");
    const parentSitePage: SitePage = metadataByFileName[parentFileName];
    if (isIndexFile(change)) {
      if (parentSitePage) {
        // The parent has already been created, this index create
        // is actually an index parent update update the folder with
        // index contents
        const parentUpdate = buildContentUpdate(
          parentSitePage.id,
          change.title,
          change.body,
          parentSitePage.metadata.fileName ?? "",
          "",
          ContentStatusEnum.current,
          PAGE_TYPE,
          null,
          parentSitePage.ancestors,
        );

        return [...accumulator, parentUpdate];
      } else {
        return [...accumulator]; //filter out index file creates
      }
    }

    const indexCreateChange: ConfluenceSpaceChange = indexLookup[fileName];

    if (indexCreateChange && !isContentDelete(indexCreateChange)) {
      change.title = indexCreateChange.title ?? change.title;
      change.body = indexCreateChange.body ?? change.body;
    }

    return [...accumulator, change];
  };

  const flattenedIndexes = changes.reduce(toFlattenedIndexes, []);

  return flattenedIndexes;
};

export const replaceExtension = (
  fileName: string,
  oldExtension: string,
  newExtension: string,
) => {
  return fileName.replace(oldExtension, newExtension);
};

export const getTitle = (
  fileName: string,
  metadataByInput: Record<string, InputMetadata>,
): string => {
  const qmdFileName = replaceExtension(fileName, ".xml", ".qmd");

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
    {},
  );

  return result;
};

export const mergeSitePages = (
  shallowPages: ContentSummary[] = [],
  contentProperties: ContentProperty[][] = [],
): SitePage[] => {
  const result: SitePage[] = shallowPages.map(
    (contentSummary: ContentSummary, index) => {
      const sitePage: SitePage = {
        title: contentSummary.title,
        id: contentSummary.id ?? "",
        metadata: flattenMetadata(contentProperties[index]),
        ancestors: contentSummary.ancestors ?? [],
      };
      return sitePage;
    },
  );
  return result;
};

export const buildFileToMetaTable = (
  fileMetadata: SitePage[],
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
    {},
  );
};

export const updateLinks = (
  fileMetadataTable: Record<string, SitePage>,
  spaceChanges: ConfluenceSpaceChange[],
  server: string,
  parent: ConfluenceParent,
): {
  pass1Changes: ConfluenceSpaceChange[];
  pass2Changes: ConfluenceSpaceChange[];
} => {
  const root = `${server}`;
  const url = `${
    ensureTrailingSlash(server)
  }wiki/spaces/${parent.space}/pages/`;

  let collectedPass2Changes: ConfluenceSpaceChange[] = [];

  const changeMapper = (
    changeToProcess: ConfluenceSpaceChange,
  ): ConfluenceSpaceChange => {
    const replacer = (match: string): string => {
      let documentFileName = "";
      if (
        isContentUpdate(changeToProcess) ||
        isContentCreate(changeToProcess)
      ) {
        documentFileName = changeToProcess.fileName ?? "";
      }

      const docFileNamePathList = documentFileName.split("/");

      let updated: string = match;
      const linkFileNameMatch = FILE_FINDER.exec(match);

      const linkFileName = linkFileNameMatch ? linkFileNameMatch[0] ?? "" : "";

      const fileNamePathList = linkFileName.split("/");

      const linkFullFileName = `${linkFileName}.qmd`;

      let siteFilePath = linkFullFileName;
      const isAbsolute = siteFilePath.startsWith("/");
      if (!isAbsolute && docFileNamePathList.length > 1) {
        const relativePath = docFileNamePathList
          .slice(0, docFileNamePathList.length - 1)
          .join("/");

        if (siteFilePath.startsWith("./")) {
          siteFilePath = siteFilePath.replace("./", `${relativePath}/`);
        } else {
          siteFilePath = `${relativePath}/${linkFullFileName}`;
        }
      }

      if (isAbsolute) {
        siteFilePath = siteFilePath.slice(1); //remove '/'
      }

      if (siteFilePath.endsWith("/index.qmd")) {
        //flatten child index links to the parent
        const siteFilePathParent = siteFilePath.replace("/index.qmd", "");
        if (fileMetadataTable[siteFilePathParent]) {
          siteFilePath = siteFilePathParent;
        }
      }

      if (!documentFileName.endsWith(".xml")) {
        //this is a flattened index in a folder with contents
        const siteFilePathParent = `${documentFileName}/${linkFullFileName}`;
        if (fileMetadataTable[siteFilePathParent]) {
          siteFilePath = siteFilePathParent;
        }
      }

      const sitePage: SitePage | null = fileMetadataTable[siteFilePath] ?? null;

      if (sitePage) {
        updated = match.replace('href="', `href="${url}`);
        const pagePath: string = `${url}${sitePage.id}`;
        updated = updated.replace(linkFullFileName, pagePath);
      } else {
        if (!collectedPass2Changes.includes(changeToProcess)) {
          collectedPass2Changes = [...collectedPass2Changes, changeToProcess];
        }
      }

      return updated;
    };

    if (isContentUpdate(changeToProcess) || isContentCreate(changeToProcess)) {
      const valueToProcess = changeToProcess?.body?.storage?.value;

      if (valueToProcess) {
        const replacedLinks: string = valueToProcess.replaceAll(
          LINK_FINDER,
          replacer,
        );

        changeToProcess.body.storage.value = replacedLinks;
      }
    }
    return changeToProcess;
  };

  const updatedChanges: ConfluenceSpaceChange[] = spaceChanges.map(
    changeMapper,
  );

  return { pass1Changes: updatedChanges, pass2Changes: collectedPass2Changes };
};

export const convertForSecondPass = (
  fileMetadataTable: Record<string, SitePage>,
  spaceChanges: ConfluenceSpaceChange[],
  server: string,
  parent: ConfluenceParent,
): ConfluenceSpaceChange[] => {
  const toUpdatesReducer = (
    accumulator: ConfluenceSpaceChange[],
    change: ConfluenceSpaceChange,
  ) => {
    if (isContentUpdate(change)) {
      accumulator = [...accumulator, change];
    }

    if (isContentCreate(change)) {
      const qmdFileName = replaceExtension(
        change.fileName ?? "",
        ".xml",
        ".qmd",
      );
      const updateId = fileMetadataTable[qmdFileName]?.id;

      if (updateId) {
        const convertedUpdate = buildContentUpdate(
          updateId,
          change.title,
          change.body,
          change.fileName ?? "",
          "",
          ContentStatusEnum.current,
          PAGE_TYPE,
          null,
          change.ancestors,
        );
        accumulator = [...accumulator, convertedUpdate];
      } else {
        trace("update ID not found for", change.fileName);
      }
    }

    return accumulator;
  };

  const changesAsUpdates = spaceChanges.reduce(toUpdatesReducer, []);

  const updateLinkResults = updateLinks(
    fileMetadataTable,
    changesAsUpdates,
    server,
    parent,
  );

  return updateLinkResults.pass1Changes;
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
    replacer,
  );

  body.storage.value = withReplacedImages;
  return body;
};

export const findAttachments = (
  bodyValue: string,
  publishFiles: string[] = [],
  filePathParam: string = "",
): string[] => {
  const filePath = pathWithForwardSlashes(filePathParam);

  const pathList = filePath.split("/");
  const parentPath = pathList.slice(0, pathList.length - 1).join("/");

  const result = bodyValue.match(IMAGE_FINDER);
  let uniqueResult = [...new Set(result)];

  if (publishFiles.length > 0) {
    uniqueResult = uniqueResult.map((assetFileName: string) => {
      const assetInPublishFiles = publishFiles.find((assetPathParam) => {
        const assetPath = pathWithForwardSlashes(assetPathParam);

        const toCheck = pathWithForwardSlashes(join(parentPath, assetFileName));

        return assetPath === toCheck;
      });

      return assetInPublishFiles ?? assetFileName;
    });
  }

  return uniqueResult ?? [];
};

const buildConfluenceAnchor = (id: string) =>
  `<ac:structured-macro ac:name="anchor" ac:schema-version="1" ac:local-id="a6aa6f25-0bee-4a7f-929b-71fcb7eba592" ac:macro-id="d2cb5be1217ae6e086bc60005e9d27b7"><ac:parameter ac:name="">${id}</ac:parameter></ac:structured-macro>`;

export const footnoteTransform = (bodyValue: string): string => {
  const BACK_ANCHOR_FINDER: RegExp = /<a href="#fn(\d)"/g;
  const ANCHOR_FINDER: RegExp = /<a href="#fnref(\d)"/g;
  const CONFLUENCE_ANCHOR_FINDER: RegExp =
    /ac:macro-id="d2cb5be1217ae6e086bc60005e9d27b7"><ac:parameter ac:name="">fn/g;

  if (bodyValue.search(CONFLUENCE_ANCHOR_FINDER) !== -1) {
    //the footnote transform has already happened
    return bodyValue;
  }

  const replacer = (prefix: string) => (match: string, p1: string): string =>
    `${buildConfluenceAnchor(`${prefix}${p1}`)}${match}`;

  let replacedBody: string = bodyValue.replaceAll(
    BACK_ANCHOR_FINDER,
    replacer("fnref"),
  );

  replacedBody = replacedBody.replaceAll(ANCHOR_FINDER, replacer("fn"));

  return replacedBody;
};
