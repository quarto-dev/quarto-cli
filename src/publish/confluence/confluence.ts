import { join } from "path/mod.ts";
import { Confirm, Input, Secret } from "cliffy/prompt/mod.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";

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
} from "../provider-types.ts";

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
  ContentChange,
  ContentChangeType,
  ContentCreate,
  ContentProperty,
  ContentPropertyKey,
  ContentStatusEnum,
  ContentSummary,
  ContentUpdate,
  LogPrefix,
  PAGE_TYPE,
  PublishContentResult,
  PublishRenderer,
  PublishType,
  PublishTypeEnum,
  SiteFileMetadata,
  SitePage,
  SpaceChangeResult,
  User,
  WrappedResult,
} from "./api/types.ts";
import { withSpinner } from "../../core/console.ts";
import {
  buildFileToMetaTable,
  buildPublishRecordForContent,
  buildSpaceChanges,
  confluenceParentFromString,
  convertForSecondPass,
  doWithSpinner,
  filterFilesForUpdate,
  findAttachments,
  flattenIndexes,
  footnoteTransform,
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
  verifyOrWarnManagePermissions,
} from "./confluence-verify.ts";
import {
  DELETE_DISABLED,
  DELETE_SLEEP_MILLIS,
  DESCENDANT_PAGE_SIZE,
  EXIT_ON_ERROR,
  MAX_PAGES_TO_LOAD,
} from "./constants.ts";
import { logError, trace } from "./confluence-logger.ts";
import { md5Hash } from "../../core/hash.ts";
import { sleep } from "../../core/async.ts";
import { info } from "log/mod.ts";

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
  await withSpinner(
    { message: "Verifying account..." },
    () => verifyAccountToken(accountToken),
  );
  writeAccessToken<AccountToken>(
    CONFLUENCE_ID,
    accountToken,
    writeTokenComparator,
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
  target: PublishRecord,
): Promise<PublishRecord> => {
  return Promise.resolve(target);
};

const loadDocument = (baseDirectory: string, rootFile: string): ContentBody => {
  const documentValue = Deno.readTextFileSync(join(baseDirectory, rootFile));

  const body: ContentBody = wrapBodyForConfluence(documentValue);

  return body;
};

const renderDocument = async (
  render: PublishRenderer,
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
  publishRecord?: PublishRecord,
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

  const user: User = await client.getUser();

  let parentUrl: string = publishRecord?.url ?? (await promptForParentURL());

  const parent: ConfluenceParent = confluenceParentFromString(parentUrl);

  const server = account?.server ?? "";

  await verifyConfluenceParent(parentUrl, parent);

  const space = await client.getSpace(parent.space);

  trace("publish", { parent, server, id: space.id, key: space.key });

  await verifyOrWarnManagePermissions(client, space, parent, user);

  const uniquifyTitle = async (title: string, idToIgnore: string = "") => {
    trace("uniquifyTitle", title);

    const titleIsUnique: boolean = await client.isTitleUniqueInSpace(
      title,
      space,
      idToIgnore,
    );

    if (titleIsUnique) {
      return title;
    }

    const uuid = globalThis.crypto.randomUUID();
    const shortUUID = uuid.split("-")[0] ?? uuid;
    const uuidTitle = `${title} ${shortUUID}`;

    return uuidTitle;
  };

  const fetchExistingSite = async (parentId: string): Promise<SitePage[]> => {
    let descendants: ContentSummary[] = [];
    let start = 0;

    for (let i = 0; i < MAX_PAGES_TO_LOAD; i++) {
      const result: WrappedResult<ContentSummary> = await client
        .getDescendantsPage(parentId, start);
      if (result.results.length === 0) {
        break;
      }

      descendants = [...descendants, ...result.results];

      start = start + DESCENDANT_PAGE_SIZE;
    }

    trace("descendants.length", descendants);

    const contentProperties: ContentProperty[][] = await Promise.all(
      descendants.map((page: ContentSummary) =>
        client.getContentProperty(page.id ?? "")
      ),
    );

    const sitePageList: SitePage[] = mergeSitePages(
      descendants,
      contentProperties,
    );

    return sitePageList;
  };

  const uploadAttachments = (
    baseDirectory: string,
    attachmentsToUpload: string[],
    parentId: string,
    filePath: string,
    existingAttachments: AttachmentSummary[] = [],
  ): Promise<AttachmentSummary | null>[] => {
    const uploadAttachment = async (
      attachmentPath: string,
    ): Promise<AttachmentSummary | null> => {
      let fileBuffer: Uint8Array;
      let fileHash: string;
      const path = join(baseDirectory, attachmentPath);

      trace(
        "uploadAttachment",
        {
          baseDirectory,
          attachmentPath,
          attachmentsToUpload,
          parentId,
          existingAttachments,
          path,
        },
        LogPrefix.ATTACHMENT,
      );

      try {
        fileBuffer = await Deno.readFile(path);
        fileHash = md5Hash(fileBuffer.toString());
      } catch (error) {
        logError(`${path} not found`, error);
        return null;
      }

      const fileName = pathWithForwardSlashes(attachmentPath);

      const existingDuplicateAttachment = existingAttachments.find(
        (attachment: AttachmentSummary) => {
          return attachment?.metadata?.comment === fileHash;
        },
      );

      if (existingDuplicateAttachment) {
        trace(
          "existing duplicate attachment found",
          existingDuplicateAttachment.title,
          LogPrefix.ATTACHMENT,
        );
        return existingDuplicateAttachment;
      }

      const file = new File([fileBuffer as BlobPart], fileName);
      const attachment: AttachmentSummary = await client
        .createOrUpdateAttachment(parentId, file, fileHash);

      trace("attachment", attachment, LogPrefix.ATTACHMENT);

      return attachment;
    };

    return attachmentsToUpload.map(uploadAttachment);
  };

  const updateContent = async (
    user: User,
    publishFiles: PublishFiles,
    id: string,
    body: ContentBody,
    titleToUpdate: string = title,
    fileName: string = "",
    uploadFileAttachments: boolean = true,
  ): Promise<PublishContentResult> => {
    const previousPage = await client.getContent(id);

    const attachmentsToUpload: string[] = findAttachments(
      body.storage.value,
      publishFiles.files,
      fileName,
    );

    let uniqueTitle = titleToUpdate;

    if (previousPage.title !== titleToUpdate) {
      uniqueTitle = await uniquifyTitle(titleToUpdate, id);
    }

    trace("attachmentsToUpload", attachmentsToUpload, LogPrefix.ATTACHMENT);

    const updatedBody: ContentBody = updateImagePaths(body);
    updatedBody.storage.value = footnoteTransform(updatedBody.storage.value);

    const toUpdate: ContentUpdate = {
      contentChangeType: ContentChangeType.update,
      id,
      version: getNextVersion(previousPage),
      title: uniqueTitle,
      type: PAGE_TYPE,
      status: ContentStatusEnum.current,
      ancestors: null,
      body: updatedBody,
    };

    trace("updateContent", toUpdate);
    trace("updateContent body", toUpdate?.body?.storage?.value);

    const updatedContent: Content = await client.updateContent(user, toUpdate);

    if (toUpdate.id && uploadFileAttachments) {
      const existingAttachments: AttachmentSummary[] = await client
        .getAttachments(toUpdate.id);

      trace(
        "attachments",
        { existingAttachments, attachmentsToUpload },
        LogPrefix.ATTACHMENT,
      );

      const uploadAttachmentsResult = await Promise.all(
        uploadAttachments(
          publishFiles.baseDir,
          attachmentsToUpload,
          toUpdate.id,
          fileName,
          existingAttachments,
        ),
      );
      trace(
        "uploadAttachmentsResult",
        uploadAttachmentsResult,
        LogPrefix.ATTACHMENT,
      );
    }

    return {
      content: updatedContent,
      hasAttachments: attachmentsToUpload.length > 0,
    };
  };

  const createSiteParent = async (
    title: string,
    body: ContentBody,
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

    const createdContent = await client.createContent(user, toCreate);
    return createdContent;
  };

  const checkToCreateSiteParent = async (
    parentId: string = "",
  ): Promise<string> => {
    let isQuartoSiteParent = false;

    const existingSiteParent: any = await client.getContent(parentId);

    if (existingSiteParent?.id) {
      const siteParentContentProperties: ContentProperty[] = await client
        .getContentProperty(existingSiteParent.id ?? "");

      isQuartoSiteParent = siteParentContentProperties.find(
        (property: ContentProperty) =>
          property.key === ContentPropertyKey.isQuartoSiteParent,
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
        body,
      );

      const newSiteParentId: string = siteParent.id ?? "";

      const contentProperty: Content = await client.createContentProperty(
        newSiteParentId,
        { key: ContentPropertyKey.isQuartoSiteParent, value: true },
      );

      parentId = newSiteParentId;
    }
    return parentId;
  };

  const createContent = async (
    publishFiles: PublishFiles,
    body: ContentBody,
    titleToCreate: string = title,
    createParent: ConfluenceParent = parent,
    fileNameParam: string = "",
  ): Promise<PublishContentResult> => {
    const createTitle = await uniquifyTitle(titleToCreate);

    const fileName = pathWithForwardSlashes(fileNameParam);

    const attachmentsToUpload: string[] = findAttachments(
      body.storage.value,
      publishFiles.files,
      fileName,
    );

    trace("attachmentsToUpload", attachmentsToUpload, LogPrefix.ATTACHMENT);
    const updatedBody: ContentBody = updateImagePaths(body);
    updatedBody.storage.value = footnoteTransform(updatedBody.storage.value);

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
    const createdContent = await client.createContent(user, toCreate);

    if (createdContent.id) {
      const uploadAttachmentsResult = await Promise.all(
        uploadAttachments(
          publishFiles.baseDir,
          attachmentsToUpload,
          createdContent.id,
          fileName,
        ),
      );
      trace(
        "uploadAttachmentsResult",
        uploadAttachmentsResult,
        LogPrefix.ATTACHMENT,
      );
    }

    return {
      content: createdContent,
      hasAttachments: attachmentsToUpload.length > 0,
    };
  };

  const publishDocument = async (): Promise<
    [[PublishRecord, URL | undefined], boolean]
  > => {
    const publishFiles: PublishFiles = await renderDocument(render);

    const body: ContentBody = loadDocument(
      publishFiles.baseDir,
      publishFiles.rootFile,
    );

    trace("publishDocument", { publishFiles, body }, LogPrefix.RENDER);

    let publishResult: PublishContentResult | undefined;
    let message: string = "";
    let doOperation;

    if (publishRecord) {
      message = `Updating content at ${publishRecord.url}...`;
      doOperation = async () => {
        const result = await updateContent(
          user,
          publishFiles,
          publishRecord.id,
          body,
        );
        publishResult = result;
      };
    } else {
      message = `Creating content in space ${parent.space}...`;
      doOperation = async () => {
        const result = await createContent(publishFiles, body);
        publishResult = result;
      };
    }
    try {
      await doWithSpinner(message, doOperation);
      return [
        buildPublishRecordForContent(server, publishResult?.content),
        !!publishResult?.hasAttachments,
      ];
    } catch (error: any) {
      trace("Error Performing Operation", error);
      trace("Value to Update", body?.storage?.value);
      throw error;
    }
  };

  const publishSite = async (): Promise<
    [[PublishRecord, URL | undefined], boolean]
  > => {
    let parentId: string = parent?.parent ?? space.homepage.id ?? "";

    parentId = await checkToCreateSiteParent(parentId);

    const siteParent: ConfluenceParent = {
      space: parent.space,
      parent: parentId,
    };

    let existingSite: SitePage[] = await fetchExistingSite(parentId);
    trace("existingSite", existingSite);

    const publishFiles: PublishFiles = await renderSite(render);
    const metadataByInput: Record<string, InputMetadata> =
      publishFiles.metadataByInput ?? {};

    trace("metadataByInput", metadataByInput);

    trace("publishSite", {
      parentId,
      publishFiles,
    });

    const filteredFiles: string[] = filterFilesForUpdate(publishFiles.files);

    trace("filteredFiles", filteredFiles);

    const assembleSiteFileMetadata = async (
      fileName: string,
    ): Promise<SiteFileMetadata> => {
      const fileToContentBody = async (
        fileName: string,
      ): Promise<ContentBody> => {
        return loadDocument(publishFiles.baseDir, fileName);
      };

      const originalTitle = getTitle(fileName, metadataByInput);
      const title = originalTitle;

      return await {
        fileName,
        title,
        originalTitle,
        contentBody: await fileToContentBody(fileName),
      };
    };

    const fileMetadata: SiteFileMetadata[] = await Promise.all(
      filteredFiles.map(assembleSiteFileMetadata),
    );

    trace("fileMetadata", fileMetadata);

    let metadataByFilename = buildFileToMetaTable(existingSite);

    trace("metadataByFilename", metadataByFilename);

    let changeList: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadata,
      siteParent,
      space,
      existingSite,
    );

    changeList = flattenIndexes(changeList, metadataByFilename, parentId);

    const { pass1Changes, pass2Changes } = updateLinks(
      metadataByFilename,
      changeList,
      server,
      siteParent,
    );

    changeList = pass1Changes;

    trace("changelist Pass 1", changeList);

    let pathsToId: Record<string, string> = {}; // build from existing site

    const handleChangeError = (
      label: string,
      currentChange: ConfluenceSpaceChange,
      error: any,
    ) => {
      if (isContentUpdate(currentChange) || isContentCreate(currentChange)) {
        trace("currentChange.fileName", currentChange.fileName);
        trace("Value to Update", currentChange.body.storage.value);
      }
      if (EXIT_ON_ERROR) {
        throw error;
      }
    };
    let hasAttachments = false;

    const doChange = async (
      change: ConfluenceSpaceChange,
      uploadFileAttachments: boolean = true,
    ) => {
      if (isContentCreate(change)) {
        if (change.fileName === "sitemap.xml") {
          trace("sitemap.xml skipped", change);
          return;
        }

        let ancestorId = (change?.ancestors && change?.ancestors[0]?.id) ??
          null;

        if (ancestorId && pathsToId[ancestorId]) {
          ancestorId = pathsToId[ancestorId];
        }

        const ancestorParent: ConfluenceParent = {
          space: parent.space,
          parent: ancestorId ?? siteParent.parent,
        };

        const universalPath = pathWithForwardSlashes(change.fileName ?? "");

        const result = await createContent(
          publishFiles,
          change.body,
          change.title ?? "",
          ancestorParent,
          universalPath,
        );

        if (universalPath) {
          pathsToId[universalPath] = result.content.id ?? "";
        }

        const contentPropertyResult: Content = await client
          .createContentProperty(result.content.id ?? "", {
            key: ContentPropertyKey.fileName,
            value: (change as ContentCreate).fileName,
          });
        hasAttachments = hasAttachments || result.hasAttachments;
        return result;
      } else if (isContentUpdate(change)) {
        const update = change as ContentUpdate;
        const result = await updateContent(
          user,
          publishFiles,
          update.id ?? "",
          update.body,
          update.title ?? "",
          update.fileName ?? "",
          uploadFileAttachments,
        );
        hasAttachments = hasAttachments || result.hasAttachments;
        return result;
      } else if (isContentDelete(change)) {
        if (DELETE_DISABLED) {
          console.warn("DELETE DISABELD");
          return null;
        }
        const result = await client.deleteContent(change);
        await sleep(DELETE_SLEEP_MILLIS); // TODO replace with polling
        return { content: result, hasAttachments: false };
      } else {
        console.error("Space Change not defined");
        return null;
      }
    };

    let pass1Count = 0;
    for (let currentChange of changeList) {
      try {
        pass1Count = pass1Count + 1;
        const doOperation = async () => await doChange(currentChange);
        await doWithSpinner(
          `Site Updates [${pass1Count}/${changeList.length}]`,
          doOperation,
        );
      } catch (error: any) {
        handleChangeError(
          "Error Performing Change Pass 1",
          currentChange,
          error,
        );
      }
    }

    if (pass2Changes.length) {
      //PASS #2 to update links to newly created pages

      trace("changelist Pass 2", pass2Changes);

      existingSite = await fetchExistingSite(parentId);
      metadataByFilename = buildFileToMetaTable(existingSite);

      const linkUpdateChanges: ConfluenceSpaceChange[] = convertForSecondPass(
        metadataByFilename,
        pass2Changes,
        server,
        parent,
      );

      let pass2Count = 0;
      for (let currentChange of linkUpdateChanges) {
        try {
          pass2Count = pass2Count + 1;
          const doOperation = async () => await doChange(currentChange, false);
          await doWithSpinner(
            `Updating Links [${pass2Count}/${linkUpdateChanges.length}]`,
            doOperation,
          );
        } catch (error: any) {
          handleChangeError(
            "Error Performing Change Pass 2",
            currentChange,
            error,
          );
        }
      }
    }

    const parentPage: Content = await client.getContent(parentId);
    return [buildPublishRecordForContent(server, parentPage), hasAttachments];
  };

  if (type === PublishTypeEnum.document) {
    const [publishResult, hasAttachments] = await publishDocument();
    if (hasAttachments) {
      info(
        "\nNote: The published content includes attachments or images. You may see a placeholder for a few moments while Confluence processes the image or atachment.\n",
      );
    }
    return publishResult;
  } else {
    const [publishResult, hasAttachments] = await publishSite();
    if (hasAttachments) {
      info(
        "\nNote: The published content includes attachments or images. You may see a placeholder for a few moments while Confluence processes the image or atachment.\n",
      );
    }
    return publishResult;
  }
}

export const confluenceProvider: PublishProvider = {
  name: CONFLUENCE_ID,
  description: "Confluence",
  hidden: false,
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
