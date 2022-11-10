//TODO only update if changed
//TODO Diff existing
//TODO Resource bundles
import { join } from "path/mod.ts";
import { generate as generateUuid } from "uuid/v4.ts";
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
  ContentAncestor,
  ContentBody,
  ContentCreate,
  ContentProperty,
  ContentStatus,
  ContentStatusEnum,
  ContentUpdate,
  PAGE_TYPE,
  PublishRenderer,
  PublishType,
  PublishTypeEnum,
  SiteFileMetadata,
  SitePage,
  Space,
  WrappedContentProperty,
} from "./api/types.ts";
import { withSpinner } from "../../core/console.ts";
import {
  buildContentCreate,
  buildPublishRecordForContent,
  confluenceParentFromString,
  doWithSpinner,
  fileMetadataToSpaceChanges,
  filterFilesForUpdate,
  getNextVersion,
  getTitle,
  isContentCreate,
  isNotFound,
  isUnauthorized,
  mergeSitePages,
  tokenFilterOut,
  transformAtlassianDomain,
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
import { capitalizeWord } from "../../core/text.ts";

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

const renderAndLoadDocument = async (
  render: PublishRenderer
): Promise<ContentBody> => {
  const flags: RenderFlags = {
    to: "confluence-publish",
  };

  const renderResult = await render(flags);
  return loadDocument(renderResult.baseDir, renderResult.rootFile);
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

  const updateContent = async (
    id: string,
    body: ContentBody,
    titleParam: string = title
  ): Promise<Content> => {
    const previousPage = await client.getContent(id);
    const toUpdate: ContentUpdate = {
      id,
      version: getNextVersion(previousPage),
      title: `${titleParam}`,
      type: PAGE_TYPE,
      status: ContentStatusEnum.current,
      ancestors: null,
      body,
    };

    return await client.updateContent(toUpdate);
  };

  const uniquifyTitle = async (title: string) => {
    const titleAlreadyExistsInSpace: boolean = await client.isTitleInSpace(
      title,
      space
    );

    const shortUUID = generateUuid().split("-")[0] ?? generateUuid();
    const createTitle = titleAlreadyExistsInSpace
      ? `${title} ${shortUUID}`
      : title;
    return createTitle;
  };

  const createContent = async (body: ContentBody): Promise<Content> => {
    const createTitle = await uniquifyTitle(title);

    const result = await client.createContent({
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
    const body: ContentBody = await renderAndLoadDocument(render);

    let content: Content | undefined;
    let message: string = "";
    let doOperation;
    if (publishRecord) {
      message = `Updating content at ${publishRecord.url}...`;
      doOperation = async () =>
        (content = await updateContent(publishRecord.id, body));
    } else {
      message = `Creating content in space ${parent.space}...`;
      doOperation = async () => (content = await createContent(body));
    }

    await doWithSpinner(message, doOperation);
    return buildPublishRecordForContent(server, content);
  };

  const fetchExistingSite = async (parentId: string): Promise<any> => {
    const shallowSite: Content = await client.getPagesFromParent(parentId);
    const contentProperties = await Promise.all(
      shallowSite.descendants.page.results.map((page: any) =>
        client.getContentProperty(page.id ?? "")
      )
    );
    const contentPropertyResults: ContentProperty[][] = contentProperties.map(
      (wrappedContentProperty: WrappedContentProperty) =>
        wrappedContentProperty.results
    );
    const sitePageList: SitePage[] = mergeSitePages(
      shallowSite?.descendants?.page?.results,
      contentPropertyResults
    );
    return sitePageList;
  };

  const publishSite = async (): Promise<[PublishRecord, URL | undefined]> => {
    const parentId: string = parent?.parent ?? "";
    const existingSite: SitePage[] = await fetchExistingSite(parentId);

    const publishFiles: PublishFiles = await renderSite(render);
    const metadataByInput: Record<string, InputMetadata> =
      publishFiles.metadataByInput ?? {};

    const filteredFiles: string[] = filterFilesForUpdate(publishFiles.files);

    const assembleSiteFileMetadata = async (
      fileName: string
    ): Promise<SiteFileMetadata> => {
      const fileToContentBody = async (
        fileName: string
      ): Promise<ContentBody> => {
        return loadDocument(publishFiles.baseDir, fileName);
      };

      const title = await uniquifyTitle(getTitle(fileName, metadataByInput));

      return await {
        fileName,
        title,
        contentBody: await fileToContentBody(fileName),
      };
    };

    const fileMetadata: SiteFileMetadata[] = await Promise.all(
      filteredFiles.map(assembleSiteFileMetadata)
    );

    const changeList: ConfluenceSpaceChange[] = fileMetadataToSpaceChanges(
      fileMetadata,
      parent,
      space,
      existingSite
    );

    const spaceChanges = (
      changeList: ConfluenceSpaceChange[]
    ): Promise<Content>[] => {
      return changeList.map(async (change: ConfluenceSpaceChange) => {
        const doChanges = async () => {
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
          } else {
            return await updateContent(
              change.id ?? "",
              change.body,
              change.title ?? ""
            );
          }
        };

        return await doChanges();
      });
    };

    const changes: Content[] = await Promise.all(spaceChanges(changeList));
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
