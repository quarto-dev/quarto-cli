//TODO Image Attachments

// TODO Diagnostic Logging

//TODO for sites, always have a 'tagged' parent, you can't delete away from that

// TODO only update if changed images
// TODO only update if changed body contents
// Did it change underneath me and setting permissions

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
  ConfluenceParent,
  ConfluenceSpaceChange,
  Content,
  ContentBody,
  ContentChangeType,
  ContentCreate,
  ContentProperty,
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
import { CHANGES_DISABLED, DELETE_DISABLED } from "./constants.ts";
import { trace } from "./confluence-logger.ts";

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

  const fetchExistingSite = async (parentId: string): Promise<any> => {
    const descendants: any[] =
      (await client.getDescendants(parentId))?.results ?? [];

    const contentProperties = await Promise.all(
      descendants.map((page: ContentSummary) =>
        client.getContentProperty(page.id ?? "")
      )
    );

    const contentPropertyResults: ContentProperty[][] = contentProperties.map(
      (wrappedContentProperty: any) => {
        return wrappedContentProperty.results;
      }
    );

    const sitePageList: SitePage[] = mergeSitePages(
      descendants,
      contentPropertyResults
    );
    return sitePageList;
  };

  const uploadAttachments = (
    baseDirectory: string,
    pathList: string[],
    parent: ContentUpdate
  ): Promise<Content>[] => {
    const uploadAttachment = async (pathToUpload: string): Promise<Content> => {
      const fileBuffer = await Deno.readFile(join(baseDirectory, pathToUpload));
      const file = new File([fileBuffer as BlobPart], pathToUpload);
      return await client.createOrUpdateAttachment(parent, file);
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
    const toUpdate: ContentUpdate = {
      contentChangeType: ContentChangeType.update,
      id,
      version: getNextVersion(previousPage),
      title: `${titleParam}`,
      type: PAGE_TYPE,
      status: ContentStatusEnum.current,
      ancestors: null,
      body,
    };

    trace("updateContent", { publishFiles, toUpdate });

    const attachmentsToUpload: string[] = findAttachments(
      toUpdate.body.storage.value
    );
    trace("attachmentsToUpload", attachmentsToUpload, LogPrefix.ATTACHMENT);

    const uploadAttachmentsResult = await Promise.all(
      uploadAttachments(publishFiles.baseDir, attachmentsToUpload, toUpdate)
    );
    trace(
      "uploadAttachmentsResult",
      uploadAttachmentsResult,
      LogPrefix.ATTACHMENT
    );

    const page: Content = await client.updateContent(toUpdate);
    return page;
  };

  const createContent = async (
    publishFiles: PublishFiles,
    body: ContentBody
  ): Promise<Content> => {
    const createTitle = await uniquifyTitle(title);

    const result = await client.createContent({
      contentChangeType: ContentChangeType.create,
      title: createTitle,
      type: PAGE_TYPE,
      space,
      status: ContentStatusEnum.current,
      ancestors: parent?.parent ? [{ id: parent.parent }] : null,
      body,
    });

    return result;
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
    const parentId: string = parent?.parent ?? "";
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

    let changeList: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadata,
      parent,
      space,
      existingSite
    );

    changeList = updateLinks(metadataByFilename, changeList, server, parent);

    const spaceChanges = (
      changeList: ConfluenceSpaceChange[]
    ): Promise<SpaceChangeResult>[] => {
      return changeList.map(async (change: ConfluenceSpaceChange) => {
        const doChanges = async () => {
          if (CHANGES_DISABLED) {
            console.warn("CHANGES DISABELD", change);
            return null;
          }
          if (isContentCreate(change)) {
            const result: Content = await client.createContent(
              change as ContentCreate
            );
            const contentPropertyResult: Content =
              await client.createContentProperty(result.id ?? "", {
                key: "fileName",
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
