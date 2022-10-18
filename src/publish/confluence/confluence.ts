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
  ContentStatus,
  ContentStatusEnum,
  ContentUpdate,
  PAGE_TYPE,
  PublishRenderer,
  PublishType,
  PublishTypeEnum,
  Space,
  SpaceChangeType,
} from "./api/types.ts";
import { withSpinner } from "../../core/console.ts";
import {
  buildPublishRecord,
  confluenceParentFromString,
  doWithSpinner,
  filterFilesForUpdate,
  getNextVersion,
  isContentCreate,
  isNotFound,
  isUnauthorized,
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
  console.log("publish");
  console.log("type", type);
  console.log("_input", _input);
  console.log("title", title);
  console.log("_slug", _slug);
  console.log("_options", _options);
  console.log("publishRecord", publishRecord);

  const client = new ConfluenceClient(account);

  let parentUrl: string = publishRecord?.url ?? (await promptForParentURL());

  const parent: ConfluenceParent = confluenceParentFromString(parentUrl);

  await verifyConfluenceParent(parentUrl, parent);

  const space = await client.getSpace(parent.space);

  const updateContent = async (
    publishRecordId: string,
    body: ContentBody
  ): Promise<Content> => {
    const previousPage = await client.getContent(publishRecordId);
    const toUpdate: ContentUpdate = {
      version: getNextVersion(previousPage),
      title: `${title}`,
      type: PAGE_TYPE,
      status: ContentStatusEnum.current,
      ancestors: null,
      body,
    };

    return await client.updateContent(publishRecordId, toUpdate);
  };

  const createContent = async (body: ContentBody): Promise<Content> => {
    const titleAlreadyExistsInSpace: boolean = await client.isTitleInSpace(
      title,
      space
    );

    //TODO use a smaller hash rather than full UUID
    const createTitle = titleAlreadyExistsInSpace
      ? `${title} ${generateUuid()}`
      : title;

    const result = await client.createContent({
      id: null,
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
    return buildPublishRecord(account?.server ?? "", content);
  };

  const publishSite = async (): Promise<[PublishRecord, URL | undefined]> => {
    const publishFiles: PublishFiles = await renderSite(render);
    console.log("publishFiles", publishFiles);
    const filteredFiles: string[] = filterFilesForUpdate(publishFiles.files);

    const buildSpaceChangesForFiles = (
      fileList: string[],
      baseDir: string
    ): ConfluenceSpaceChange[] => {
      console.log("buildSiteOperationsForFiles");
      console.log("fileList", fileList);
      console.log("baseDir", baseDir);

      const spaceChangesCallback = (
        accumulatedChanges: ConfluenceSpaceChange[],
        currentFileName: string
      ): ConfluenceSpaceChange[] => {
        console.log("accumulatedChanges", accumulatedChanges);
        console.log("currentFileName", currentFileName);

        // Load content
        const body: ContentBody = loadDocument(baseDir, currentFileName);
        console.log("body", body);
        // TODO extract to buildContent(withDefaults)
        const content = {
          id: null,
          title: currentFileName, // FIXME How do I get the title?
          type: PAGE_TYPE,
          space,
          status: ContentStatusEnum.current, //TODO default this
          ancestors: parent?.parent ? [{ id: parent.parent }] : null, //TODO extract to helper
          body,
        };

        const spaceChange: ConfluenceSpaceChange = {
          type: SpaceChangeType.create, //TODO type based on content type so ConfluenceSpaceChange = ContentCreate | ContentUpdate
          content,
        };

        return [...accumulatedChanges, spaceChange];
      };

      const spaceChanges: ConfluenceSpaceChange[] = fileList.reduce(
        spaceChangesCallback,
        []
      );

      return spaceChanges;
    };

    const changeList: ConfluenceSpaceChange[] = buildSpaceChangesForFiles(
      filteredFiles,
      publishFiles.baseDir
    );

    const promisesFromSpaceChanges = (
      changeList: ConfluenceSpaceChange[]
    ): Promise<Content>[] => {
      return changeList.map(async (change: ConfluenceSpaceChange) => {
        console.log("change.content", change.content);
        return await client.createContent(change.content as ContentCreate);
      });
    };

    const changePromiseList: Promise<Content>[] =
      promisesFromSpaceChanges(changeList);

    console.log("changeList.length", changeList.length);
    console.log("changePromiseList.length", changePromiseList.length);
    await Promise.all(changePromiseList);

    //TODO create a promise list
    //TODO publishing with all create from empty

    //TODO only update if changed
    //TODO Diff existing
    //TODO create Publish Record

    throw new Error("Confluence site publishing not implemented");
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
