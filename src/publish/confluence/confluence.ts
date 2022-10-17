//TODO Resource bundles

//TODO replace "magic strings" and "k"s

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

import { ApiError, PublishOptions, PublishRecord } from "../types.ts";
import { ConfluenceClient } from "./api/index.ts";
import {
  ConfluenceParent,
  Content,
  ContentBody,
  ContentUpdate,
  kPageType,
  PublishRenderer,
  PublishType,
  PublishTypeEnum,
} from "./api/types.ts";
import { ensureTrailingSlash } from "../../core/path.ts";
import { withSpinner } from "../../core/console.ts";
import {
  isNotFound,
  isUnauthorized,
  transformAtlassianDomain,
  getMessageFromAPIError,
  tokenFilterOut,
  validateEmail,
  validateServer,
  validateToken,
  validateParentURL,
  confluenceParentFromString,
  wrapBodyForConfluence,
  buildPublishRecord,
  doWithSpinner,
  getNextVersion,
  writeTokenComparator,
} from "./confluence-helper.ts";

import {
  verifyAccountToken,
  verifyLocation,
  verifyConfluenceParent,
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

const renderAndLoadDocument = async (render: PublishRenderer) => {
  const flags: RenderFlags = {
    to: "confluence-publish",
  };

  const renderResult = await render(flags);

  const documentValue = Deno.readTextFileSync(
    join(renderResult.baseDir, renderResult.rootFile)
  );

  const body = wrapBodyForConfluence(documentValue);

  return body;
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
      type: kPageType,
      status: "current",
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
      type: kPageType,
      space,
      status: "current",
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

  if (type === PublishTypeEnum.document) {
    return await publishDocument();
  } else {
    throw new Error("Confluence site publishing not implemented");
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
