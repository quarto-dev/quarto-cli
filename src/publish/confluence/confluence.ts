// TODO enable new editor experience by default
// https://tinyurl.com/2ds6rq8a
// TODO Resource bundles

import { join } from "path/mod.ts";
import { Input, Secret } from "cliffy/prompt/mod.ts";
import { RenderFlags } from "../../command/render/types.ts";

import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../common/account.ts";

import {
  AccountToken,
  AccountTokenType,
  InputMetadata,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";

import { PublishOptions, PublishRecord } from "../types.ts";
import { ConfluenceClient } from "./api/index.ts";
import {
  AttachmentSummary,
  ConfluenceParent,
  ConfluenceSpaceChange,
  Content,
  ContentAncestor,
  ContentBody,
  ContentBodyRepresentation,
  ContentChangeType,
  ContentCreate,
  ContentProperty,
  ContentPropertyKey,
  ContentStatusEnum,
  ContentSummary,
  ContentUpdate,
  LogPrefix,
  PAGE_TYPE,
  PublishRenderer,
  PublishType,
  PublishTypeEnum,
  SiteFileMetadata,
  SitePage,
  SpaceChangeResult,
} from "./api/types.ts";
import { withSpinner } from "../../core/console.ts";
import {
  buildFileToMetaTable,
  buildPublishRecordForContent,
  buildSpaceChanges,
  confluenceParentFromString,
  doWithSpinner,
  filterFilesForUpdate,
  findAttachments,
  getNextVersion,
  getTitle,
  isContentCreate,
  isContentDelete,
  isContentUpdate,
  isNotFound,
  isUnauthorized,
  mergeSitePages,
  tokenFilterOut,
  transformAtlassianDomain,
  updateImagePaths,
  updateLinks,
  validateEmail,
  validateParentURL,
  validateServer,
  validateToken,
  wrapBodyForConfluence,
  writeTokenComparator,
} from "./confluence-helper.ts";

import {
  verifyAccountToken,
  verifyConfluenceParent,
  verifyLocation,
} from "./confluence-verify.ts";
import { DELETE_DISABLED } from "./constants.ts";
import { logError, trace } from "./confluence-logger.ts";
import { md5Hash } from "../../core/hash.ts";

export const CONFLUENCE_ID = "confluence";

const getAccountTokens = (): Promise<AccountToken[]> => {
  const getConfluenceEnvironmentAccount = () => {
    const server = Deno.env.get("CONFLUENCE_DOMAIN");
    const name = Deno.env.get("CONFLUENCE_USER_EMAIL");
    const token = Deno.env.get("CONFLUENCE_AUTH_TOKEN");
    if (server && name && token) {
      return {
        type: AccountTokenType.Environment,
        name,
        server: transformAtlassianDomain(server),
        token,
      };
    }
  };

  const readConfluenceAccessTokens = (): AccountToken[] => {
    const result = readAccessTokens<AccountToken>(CONFLUENCE_ID) ?? [];
    return result;
  };

  let accounts: AccountToken[] = [];

  const envAccount = getConfluenceEnvironmentAccount();
  if (envAccount) {
    accounts = [...accounts, envAccount];
  }

  const tempStoredAccessTokens = readConfluenceAccessTokens();
  accounts = [...accounts, ...tempStoredAccessTokens];
  return Promise.resolve(accounts);
};

const removeToken = (token: AccountToken) => {
  const existingTokens = readAccessTokens<AccountToken>(CONFLUENCE_ID) ?? [];

  const toWrite: Array<AccountToken> = existingTokens.filter((accessToken) =>
    tokenFilterOut(accessToken, token)
  );

  writeAccessTokens(CONFLUENCE_ID, toWrite);
};

const promptAndAuthorizeToken = async () => {
  const server: string = await Input.prompt({
    indent: "",
    message: "Confluence Domain:",
    hint: "e.g. https://mydomain.atlassian.net/",
    validate: validateServer,
    transform: transformAtlassianDomain,
  });

  await verifyLocation(server);

  const name = await Input.prompt({
    indent: "",
    message: `Confluence Account Email:`,
    validate: validateEmail,
  });

  const token = await Secret.prompt({
    indent: "",
    message: "Confluence API Token:",
    hint: "Create an API token at https://id.atlassian.com/manage/api-tokens",
    validate: validateToken,
  });

  const accountToken: AccountToken = {
    type: AccountTokenType.Authorized,
    name,
    server,
    token,
  };
  await withSpinner({ message: "Verifying account..." }, () =>
    verifyAccountToken(accountToken)
  );
  writeAccessToken<AccountToken>(
    CONFLUENCE_ID,
    accountToken,
    writeTokenComparator
  );

  return Promise.resolve(accountToken);
};

const promptForParentURL = async () => {
  return await Input.prompt({
    indent: "",
    message: `Space or Parent Page URL:`,
    hint: "Browse in Confluence to the space or parent, then copy the URL",
    validate: validateParentURL,
  });
};

const resolveTarget = async (
  accountToken: AccountToken,
  target: PublishRecord
): Promise<PublishRecord> => {
  return Promise.resolve(target);
};

const loadDocument = (baseDirectory: string, rootFile: string): ContentBody => {
  const documentValue = Deno.readTextFileSync(join(baseDirectory, rootFile));

  const body: ContentBody = wrapBodyForConfluence(documentValue);

  return body;
};

const renderDocument = async (
  render: PublishRenderer
): Promise<PublishFiles> => {
  const flags: RenderFlags = {
    to: "confluence-publish",
  };

  return await render(flags);
};

const renderSite = async (render: PublishRenderer): Promise<PublishFiles> => {
  const flags: RenderFlags = {
    to: "confluence-publish",
  };

  const renderResult: PublishFiles = await render(flags);
  return renderResult;
};

async function publish(
  account: AccountToken,
  type: PublishType,
  _input: string,
  title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  _options: PublishOptions,
  publishRecord?: PublishRecord
): Promise<[PublishRecord, URL | undefined]> {
  trace("publish", {
    account,
    type,
    _input,
    title,
    _slug,
    _options,
    publishRecord,
  });

  const client = new ConfluenceClient(account);

  let parentUrl: string = publishRecord?.url ?? (await promptForParentURL());

  const parent: ConfluenceParent = confluenceParentFromString(parentUrl);

  const server = account?.server ?? "";

  await verifyConfluenceParent(parentUrl, parent);

  const space = await client.getSpace(parent.space);

  trace("publish", { parent, server, space });

  const uniquifyTitle = async (title: string) => {
    const titleAlreadyExistsInSpace: boolean = await client.isTitleInSpace(
      title,
      space
    );
    const uuid = globalThis.crypto.randomUUID();
    const shortUUID = uuid.split("-")[0] ?? uuid;
    const createTitle = titleAlreadyExistsInSpace
      ? `${title} ${shortUUID}`
      : title;
    return createTitle;
  };

  const fetchExistingSite = async (parentId: string): Promise<SitePage[]> => {
    const descendants: any[] =
      (await client.getDescendants(parentId))?.results ?? [];

    const contentProperties: ContentProperty[][] = await Promise.all(
      descendants.map((page: ContentSummary) =>
        client.getContentProperty(page.id ?? "")
      )
    );

    const sitePageList: SitePage[] = mergeSitePages(
      descendants,
      contentProperties
    );

    return sitePageList;
  };

  const uploadAttachments = (
    baseDirectory: string,
    pathList: string[],
    parentId: string,
    existingAttachments: AttachmentSummary[] = []
  ): Promise<AttachmentSummary | null>[] => {
    const uploadAttachment = async (
      pathToUpload: string
    ): Promise<AttachmentSummary | null> => {
      trace(
        "uploadAttachment",
        { baseDirectory, pathList, parentId, existingAttachments },
        LogPrefix.ATTACHMENT
      );
      let fileBuffer: Uint8Array;
      let fileHash: string;
      const path = join(baseDirectory, pathToUpload);
      try {
        fileBuffer = await Deno.readFile(path);
        fileHash = md5Hash(fileBuffer.toString());
      } catch (error) {
        logError(`${path} not found`, error);
        return null;
      }

      const fileName = pathToUpload;

      const existingDuplicateAttachment = existingAttachments.find(
        (attachment: AttachmentSummary) => {
          return attachment?.metadata?.comment === fileHash;
        }
      );

      if (existingDuplicateAttachment) {
        trace(
          "existing duplicate attachment found",
          existingDuplicateAttachment.title,
          LogPrefix.ATTACHMENT
        );
        return existingDuplicateAttachment;
      }

      const file = new File([fileBuffer as BlobPart], fileName);
      const attachment: AttachmentSummary =
        await client.createOrUpdateAttachment(parentId, file, fileHash);

      trace("attachment", attachment, LogPrefix.ATTACHMENT);

      return attachment;
    };

    return pathList.map(uploadAttachment);
  };

  const updateContent = async (
    publishFiles: PublishFiles,
    id: string,
    body: ContentBody,
    titleParam: string = title
  ): Promise<Content> => {
    const previousPage = await client.getContent(id);

    const attachmentsToUpload: string[] = findAttachments(body.storage.value);

    trace("attachmentsToUpload", attachmentsToUpload, LogPrefix.ATTACHMENT);

    const updatedBody: ContentBody = updateImagePaths(body);
    const toUpdate: ContentUpdate = {
      contentChangeType: ContentChangeType.update,
      id,
      version: getNextVersion(previousPage),
      title: `${titleParam}`,
      type: PAGE_TYPE,
      status: ContentStatusEnum.current,
      ancestors: null,
      body: updatedBody,
    };

    trace("updateContent", toUpdate);
    trace("updateContent body", toUpdate?.body?.storage?.value);

    const updatedContent: Content = await client.updateContent(toUpdate);

    if (toUpdate.id) {
      const existingAttachments: AttachmentSummary[] =
        await client.getAttachments(toUpdate.id);
      trace(
        "attachments",
        { existingAttachments, attachmentsToUpload },
        LogPrefix.ATTACHMENT
      );

      const uploadAttachmentsResult = await Promise.all(
        uploadAttachments(
          publishFiles.baseDir,
          attachmentsToUpload,
          toUpdate.id,
          existingAttachments
        )
      );
      trace(
        "uploadAttachmentsResult",
        uploadAttachmentsResult,
        LogPrefix.ATTACHMENT
      );
    }

    return updatedContent;
  };

  const createSiteParent = async (
    title: string,
    body: ContentBody
  ): Promise<Content> => {
    let ancestors: ContentAncestor[] = [];

    if (parent?.parent) {
      ancestors = [{ id: parent.parent }];
    } else if (space.homepage?.id) {
      ancestors = [{ id: space.homepage?.id }];
    }

    const toCreate: ContentCreate = {
      contentChangeType: ContentChangeType.create,
      title,
      type: PAGE_TYPE,
      space,
      status: ContentStatusEnum.current,
      ancestors,
      body,
    };

    trace("createSiteParent", toCreate);

    const createdContent = await client.createContent(toCreate);
    return createdContent;
  };

  const checkToCreateSiteParent = async (
    parentId: string = ""
  ): Promise<string> => {
    let isQuartoSiteParent = false;

    const existingSiteParent: any = await client.getContent(parentId);

    if (existingSiteParent?.id) {
      const siteParentContentProperties: ContentProperty[] =
        await client.getContentProperty(existingSiteParent.id ?? "");

      isQuartoSiteParent =
        siteParentContentProperties.find(
          (property: ContentProperty) =>
            property.key === ContentPropertyKey.isQuartoSiteParent
        ) !== undefined;
    }

    if (!isQuartoSiteParent) {
      const body: ContentBody = {
        storage: {
          value: "",
          representation: ContentBodyRepresentation.storage,
        },
      };

      const siteParentTitle = await uniquifyTitle(title);
      const siteParent: ContentSummary = await createSiteParent(
        siteParentTitle,
        body
      );

      const newSiteParentId: string = siteParent.id ?? "";

      const contentProperty: Content = await client.createContentProperty(
        newSiteParentId,
        { key: ContentPropertyKey.isQuartoSiteParent, value: true }
      );

      parentId = newSiteParentId;
    }
    return parentId;
  };

  const createContent = async (
    publishFiles: PublishFiles,
    body: ContentBody,
    titleToCreate: string = title,
    createParent: ConfluenceParent = parent
  ): Promise<Content> => {
    const createTitle = await uniquifyTitle(titleToCreate);

    const attachmentsToUpload: string[] = findAttachments(body.storage.value);
    trace("attachmentsToUpload", attachmentsToUpload, LogPrefix.ATTACHMENT);
    const updatedBody: ContentBody = updateImagePaths(body);

    const toCreate: ContentCreate = {
      contentChangeType: ContentChangeType.create,
      title: createTitle,
      type: PAGE_TYPE,
      space,
      status: ContentStatusEnum.current,
      ancestors: createParent?.parent ? [{ id: createParent.parent }] : null,
      body: updatedBody,
    };

    trace("createContent", { publishFiles, toCreate });
    const createdContent = await client.createContent(toCreate);

    if (createdContent.id) {
      const uploadAttachmentsResult = await Promise.all(
        uploadAttachments(
          publishFiles.baseDir,
          attachmentsToUpload,
          createdContent.id
        )
      );
      trace(
        "uploadAttachmentsResult",
        uploadAttachmentsResult,
        LogPrefix.ATTACHMENT
      );
    }

    return createdContent;
  };

  const publishDocument = async (): Promise<
    [PublishRecord, URL | undefined]
  > => {
    const publishFiles: PublishFiles = await renderDocument(render);

    const body: ContentBody = loadDocument(
      publishFiles.baseDir,
      publishFiles.rootFile
    );

    trace("publishDocument", { publishFiles, body }, LogPrefix.RENDER);

    let content: Content | undefined;
    let message: string = "";
    let doOperation;

    if (publishRecord) {
      message = `Updating content at ${publishRecord.url}...`;
      doOperation = async () =>
        (content = await updateContent(publishFiles, publishRecord.id, body));
    } else {
      message = `Creating content in space ${parent.space}...`;
      doOperation = async () =>
        (content = await createContent(publishFiles, body));
    }

    await doWithSpinner(message, doOperation);
    return buildPublishRecordForContent(server, content);
  };

  const publishSite = async (): Promise<[PublishRecord, URL | undefined]> => {
    let parentId: string = parent?.parent ?? space.homepage.id ?? "";

    parentId = await checkToCreateSiteParent(parentId);

    const siteParent: ConfluenceParent = {
      space: parent.space,
      parent: parentId,
    };

    const existingSite: SitePage[] = await fetchExistingSite(parentId);

    const publishFiles: PublishFiles = await renderSite(render);
    const metadataByInput: Record<string, InputMetadata> =
      publishFiles.metadataByInput ?? {};

    trace("publishSite", {
      parentId,
      existingSite,
      publishFiles,
      metadataByInput,
    });

    const filteredFiles: string[] = filterFilesForUpdate(publishFiles.files);

    const assembleSiteFileMetadata = async (
      fileName: string
    ): Promise<SiteFileMetadata> => {
      const fileToContentBody = async (
        fileName: string
      ): Promise<ContentBody> => {
        return loadDocument(publishFiles.baseDir, fileName);
      };

      const originalTitle = getTitle(fileName, metadataByInput);
      const title = await uniquifyTitle(originalTitle);

      const matchingPages = await client.fetchMatchingTitlePages(
        originalTitle,
        space
      );

      return await {
        fileName,
        title,
        originalTitle,
        matchingPages,
        contentBody: await fileToContentBody(fileName),
      };
    };

    const fileMetadata: SiteFileMetadata[] = await Promise.all(
      filteredFiles.map(assembleSiteFileMetadata)
    );

    const metadataByFilename = buildFileToMetaTable(existingSite);

    trace("metadataByFilename", metadataByFilename);

    let changeList: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadata,
      siteParent,
      space,
      existingSite
    );

    trace("changelist", changeList);

    changeList = updateLinks(
      metadataByFilename,
      changeList,
      server,
      siteParent
    );

    trace("update links changelist", changeList);

    const spaceChanges = (
      changeList: ConfluenceSpaceChange[]
    ): Promise<SpaceChangeResult>[] => {
      return changeList.map(async (change: ConfluenceSpaceChange) => {
        const doChanges = async () => {
          if (isContentCreate(change)) {
            const result = await createContent(
              publishFiles,
              change.body,
              change.title ?? "",
              siteParent
            );
            const contentPropertyResult: Content =
              await client.createContentProperty(result.id ?? "", {
                key: ContentPropertyKey.fileName,
                value: (change as ContentCreate).fileName,
              });

            return result;
          } else if (isContentUpdate(change)) {
            const update = change as ContentUpdate;
            return await updateContent(
              publishFiles,
              update.id ?? "",
              update.body,
              update.title ?? ""
            );
          } else if (isContentDelete(change)) {
            if (DELETE_DISABLED) {
              console.warn("DELETE DISABELD");
              return null;
            }
            const result = await client.deleteContent(change);
            return result;
          } else {
            console.error("Space Change not defined");
            return null;
          }
        };

        return await doChanges();
      });
    };

    const changes: SpaceChangeResult[] = await Promise.all(
      spaceChanges(changeList)
    );
    const parentPage: Content = await client.getContent(parentId);

    return buildPublishRecordForContent(server, parentPage);
  };

  if (type === PublishTypeEnum.document) {
    return await publishDocument();
  } else {
    return await publishSite();
  }
}

export const confluenceProvider: PublishProvider = {
  name: CONFLUENCE_ID,
  description: "Confluence",
  requiresServer: true,
  requiresRender: true,
  accountTokens: getAccountTokens,
  authorizeToken: promptAndAuthorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};
